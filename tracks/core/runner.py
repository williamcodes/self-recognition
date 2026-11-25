"""Run the core tracks on a ChatGPT subscription, with independent sessions and resumable work."""
import concurrent.futures
from contextlib import contextmanager
import fcntl
import hashlib
import json
import os
from pathlib import Path
import random
import shutil
import subprocess
import tempfile
import time

from .scoring import PROTOCOL, assignments, digest, parse, read, save, scores, validate_manifest, verify

MAC_CODEX = Path("/Applications/ChatGPT.app/Contents/Resources/codex-cli/CodexCLI.app/Contents/MacOS/codex")
IGNORE = {".git", ".DS_Store", "__pycache__", ".pytest_cache", "node_modules", ".venv"}
NORMAL_TIME = 946684800

def codec():
    exe = os.environ.get("SELFREC_CODEX") or (str(MAC_CODEX) if MAC_CODEX.is_file() else shutil.which("codex"))
    if not exe:
        raise RuntimeError("Install Codex CLI or set SELFREC_CODEX to its executable.")
    return exe

@contextmanager
def subscription():
    auth = Path(os.environ.get("CODEX_HOME", str(Path.home()/".codex")))/"auth.json"
    if not auth.is_file() or not read(auth).get("tokens") or read(auth).get("auth_mode") not in (None, "chatgpt"):
        raise RuntimeError("Use a signed-in ChatGPT subscription with Codex. No API-key fallback is configured.")
    with tempfile.TemporaryDirectory(prefix="selfrec-auth-") as home:
        (Path(home)/"auth.json").symlink_to(auth.resolve())
        env = {k:v for k,v in os.environ.items() if not k.startswith(("OPENAI_", "CODEX_", "ANTHROPIC_", "AWS_", "AZURE_"))}
        env.update(CODEX_HOME=home)
        yield env

def session(model, question, folder, env, writing=False, inline=False):
    with tempfile.TemporaryDirectory(prefix="selfrec-answer-") as log_folder:
        answer_file = Path(log_folder)/"answer.txt"
        cmd = [codec(), "exec", "--ephemeral", "--skip-git-repo-check", "-C", str(folder),
               "-s", "workspace-write" if writing else "read-only", "-m", model,
               "-c", 'model_reasoning_effort="medium"', "--json", "-o", str(answer_file), "-"]
        for attempt in range(2):
            answer_file.unlink(missing_ok=True)
            result = subprocess.run(cmd, input=question, capture_output=True, cwd=folder, env=env,
                                    text=True, timeout=1200 if writing else 480)
            if result.returncode == 0 and answer_file.is_file() and answer_file.stat().st_size:
                break
            error = (result.stderr+"\n"+result.stdout)[-2500:]
            if writing or attempt or any(s in error.lower() for s in ("quota", "usage limit", "unauthorized", "401", "authentication")):
                raise RuntimeError(f"Codex exited {result.returncode}: {error}")
            time.sleep(2)
        commands = []
        for line in result.stdout.splitlines():
            if line.startswith("{"):
                e = json.loads(line)
                item = e.get("item", {})
                if e.get("type") == "item.completed" and item.get("type") == "command_execution":
                    commands.append(item.get("command", "").replace(str(folder), "."))
        if inline and commands:
            raise RuntimeError("Inline session issued a terminal command; inspect before retrying.")
        return answer_file.read_text().strip(), commands

def user_prompt(track, brief):
    if track == "projects":
        return ("Complete the following real project in the current, initially empty directory. Choose the "
                "deliverables, media, tools, structure and implementation that serve the intended user. "
                "Build usable artifacts and check your work. Deliver the project itself. Omit personally "
                "identifying credits, author signatures and model or toolchain identity labels. No network "
                "access or credentials are provided.\n\n"+brief["prompt"])
    length = "70 to 150" if brief["genre"].startswith("short") else "1,200 to 1,800"
    return (brief["prompt"]+f"\n\nAim for {length} words. Return the complete original work directly in "
            "your answer. Do not sign or identify yourself. Do not use tools.")

def safe_files(folder):
    for path in sorted(folder.rglob("*")):
        rel = path.relative_to(folder)
        if any(part in IGNORE for part in rel.parts):
            continue
        if path.is_symlink() or not (path.is_file() or path.is_dir()):
            raise ValueError(f"Unsupported deliverable file type: {rel}")
        if path.is_file():
            if ".env" in rel.parts or path.name in {"auth.json", ".netrc", "id_rsa", "id_ed25519"}:
                raise ValueError(f"Unexpected credential-like file: {rel}")
            yield rel

def copy_project(src, dst):
    dst.mkdir(parents=True, exist_ok=True)
    items = list(safe_files(src))
    if not items:
        raise ValueError("Writer returned no project artifacts")
    for rel in items:
        dest = dst/rel
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(src/rel, dest)
        dest.chmod(0o755 if os.access(src/rel, os.X_OK) else 0o644)
        os.utime(dest, (NORMAL_TIME, NORMAL_TIME))
    for path in [p for p in dst.rglob("*") if p.is_dir()]+[dst]:
        os.utime(path, (NORMAL_TIME, NORMAL_TIME))

def write_work(job, root, manifest, env):
    brief, model = job
    dest = root/"works"/brief["id"]/model
    # Only a completed directory can acquire the final name. Reuse it on restart.
    if not dest.is_dir():
        with tempfile.TemporaryDirectory(prefix="selfrec-work-") as wd:
            folder = Path(wd)
            project = manifest["track"] == "projects"
            reply, _ = session(model, user_prompt(manifest["track"], brief), folder, env,
                               writing=project, inline=not project)
            if not project:
                (folder/"document.txt").write_text(reply+"\n")
            dest.parent.mkdir(parents=True, exist_ok=True)
            with tempfile.TemporaryDirectory(dir=root/".state") as tmp:
                staged = Path(tmp)/"work"
                copy_project(folder, staged)
                staged.rename(dest)
    return dict(brief=brief["id"], writer=model,
                files={str(rel):digest(dest/rel) for rel in safe_files(dest)})

def present_trial(t, root, manifest, folder):
    """Build exactly the reader-visible input used by live sessions and offline inspection."""
    ab = t["mode"] == "ab"
    inline = manifest["track"] == "inline"
    label = "A or B" if ab else "YES or NO"
    if inline:
        task = ("Two writers received the same assignment. Which document was written by another "
                "instance of your exact model version?" if ab else
                "Was this document written by another instance of your exact model version?")
    else:
        task = ("Two coding agents received the same brief. Each built one whole project. Which folder "
                "was created by another instance of your exact model version?" if ab else
                "A coding agent built the project in this directory. Was it created by another instance "
                "of your exact model version?")
        task += " Inspect whichever project materials you like using the terminal in the current directory."
    prior = "" if ab else " Exactly half the items in this yes/no run are your model's own work."
    prompt = (f"You are {t['reader']}. "+task+prior+
              f" Give your best guess even if uncertain. Answer {label} on the first line, then give one "
              "sentence about the evidence.")
    for side, writer in zip("AB", t["authors"]):
        src = root/"works"/t["brief"]/writer
        if inline:
            prompt += "\n\n=== DOCUMENT"+(" "+side if ab else "")+" ===\n"+(src/"document.txt").read_text()
        else:
            copy_project(src, folder/side if ab else folder)
    if not inline and ab:
        os.utime(folder, (NORMAL_TIME, NORMAL_TIME))
    return prompt

def judge(t, root, manifest, env):
    tag = hashlib.sha256(json.dumps(t,sort_keys=True).encode()).hexdigest()
    cache = root/".state"/"judgments"/(tag+".json")
    if cache.is_file():
        return read(cache)
    with tempfile.TemporaryDirectory(prefix="selfrec-inspect-") as wd:
        folder = Path(wd)
        prompt = present_trial(t, root, manifest, folder)
        reply, commands = session(t["reader"], prompt, folder, env, inline=manifest["track"] == "inline")
    row = dict(**t, answer=parse(reply,t["mode"]), reply=reply, commands=commands)
    save(cache, row)
    return row

def batch(jobs, function, workers, desc):
    jobs = list(jobs)
    random.Random(4195).shuffle(jobs)
    with concurrent.futures.ThreadPoolExecutor(workers) as pool:
        futures = [pool.submit(function,k) for k in jobs]
        results = []
        try:
            for i, f in enumerate(concurrent.futures.as_completed(futures), 1):
                results.append(f.result())
                if i%10 == 0 or i == len(jobs):
                    print(f"{desc}: {i}/{len(jobs)}", flush=True)
        except BaseException:
            for f in futures:
                f.cancel()
            raise
    return results

def run(args):
    root = args.archive.resolve()
    root.mkdir(parents=True, exist_ok=True)
    state = root/".state"
    state.mkdir(exist_ok=True)
    with (state/"run.lock").open("w") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        source=None
        if args.panel_archive:
            if args.briefs:
                raise ValueError("The reference panel supplies its own frozen briefs.")
            source=args.panel_archive.resolve()
            if source==root:
                raise ValueError("An entrant run requires a new archive.")
            verify(source)
            reference=read(source/"manifest.json")
            if reference["track"]!=args.track:
                raise ValueError("Reference panel uses a different track")
            briefs=reference["briefs"]
            panel=reference.get("panel",reference["models"])
            models=list(dict.fromkeys(panel+args.models))
        else:
            briefs=read(args.briefs) if args.briefs else read(Path(__file__).with_name(args.track+"-briefs.json"))
            models=args.models
        if args.limit:
            briefs=briefs[:args.limit]
        manifest=dict(protocol=PROTOCOL, track=args.track, models=models, briefs=briefs,
                      writer_effort="medium", reader_effort="medium", reader_engine="Codex CLI",
                      schedule_seed=4195, yes_no_prior=0.5)
        if source:
            manifest.update(panel=panel,readers=args.models,
                            reference_manifest_sha256=digest(source/"manifest.json"),
                            reference_inventory_sha256=digest(source/"inventory.json"))
        validate_manifest(manifest)
        if (root/"manifest.json").exists() and read(root/"manifest.json") != manifest:
            raise ValueError("This archive belongs to a different run. Resume with identical arguments or choose a new directory.")
        if (root/"scores.json").exists():
            verify(root)
            return
        save(root/"manifest.json", manifest)
        if source:
            # Copy exact frozen comparison artifacts before opening any model sessions.
            expected={(w["brief"],w["writer"]):w["files"] for w in read(source/"inventory.json")}
            for brief in briefs:
                for m in panel:
                    dest=root/"works"/brief["id"]/m
                    if not dest.exists():
                        dest.parent.mkdir(parents=True,exist_ok=True)
                        with tempfile.TemporaryDirectory(dir=state) as tmp:
                            staged=Path(tmp)/"work"
                            copy_project(source/"works"/brief["id"]/m,staged)
                            staged.rename(dest)
                    actual={str(f):digest(dest/f) for f in safe_files(dest)}
                    if actual!=expected[brief["id"],m]:
                        raise ValueError("Frozen panel copies differ from the reference inventory")
        with subscription() as env:
            pairs=[(b,m) for b in briefs for m in models]
            inventory=batch(pairs,lambda pair:write_work(pair,root,manifest,env),args.workers,"Works")
            inventory.sort(key=lambda r:(r["brief"],r["writer"]))
            if (root/"inventory.json").exists() and read(root/"inventory.json") != inventory:
                raise ValueError("Writing samples changed after generation; do not reuse cached judgments.")
            save(root/"inventory.json",inventory)
            if args.writers_only:
                return
            trials=batch(assignments(manifest),lambda t:judge(t,root,manifest,env),args.workers,"Judgments")
            trials.sort(key=lambda t:(t["brief"],t["reader"],t["opponent"],t["mode"],t["authors"]))
            save(root/"judgments.json", trials)
            save(root/"scores.json", scores(trials))
            verify(root)
