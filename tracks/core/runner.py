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

from .provenance import AttemptLog, QuarantinedSession, mark_locked_reader_miss, adjudicated_row, contract_prompt, freeze, object_hash, text_hash
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

def session(model, question, folder, env, audit, writing=False, inline=False):
    sandbox = "workspace-write" if writing else "read-only"
    with tempfile.TemporaryDirectory(prefix="selfrec-answer-") as log_folder:
        answer_file = Path(log_folder)/"answer.txt"
        cmd = [codec(), "exec", "--ephemeral", "--skip-git-repo-check", "-C", str(folder),
               "-s", sandbox, "-m", model, "-c", 'model_reasoning_effort="medium"',
               "--json", "-o", str(answer_file), "-"]
        for attempt in range(2):
            answer_file.unlink(missing_ok=True)
            audit.start(question, cmd[0], model, sandbox, inline)
            timeout = False
            try:
                result = subprocess.run(cmd, input=question, capture_output=True, cwd=folder, env=env,
                                        text=True, timeout=1200 if writing else 480)
                raw, error, rc = result.stdout, result.stderr, result.returncode
            except subprocess.TimeoutExpired as exc:
                def decoded(v):
                    return v.decode(errors="replace") if isinstance(v, bytes) else (v or "")
                raw, error, rc, timeout = decoded(exc.stdout), decoded(exc.stderr), None, True
            except OSError as exc:
                raw, error, rc = "", str(exc), None
            reply = answer_file.read_text().strip() if answer_file.is_file() else ""
            commands = audit.observed(raw, error, reply, folder, rc=rc, timeout=timeout)
            if commands is not None:
                return reply, commands
            if (audit.data["observed_reply"] or writing or attempt or
                any(v in (error+raw).lower() for v in ("quota","usage limit","unauthorized","401","authentication"))):
                raise RuntimeError(f"Unsuccessful Codex call. See {audit.path}")
            time.sleep(2)

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
    spec = read(root/"frozen-prompts.json")
    subject = dict(brief=brief["id"], writer=model)
    audit = AttemptLog(root,"writer",subject,object_hash(spec))
    audit.path, audit.data = audit.last()
    if not dest.is_dir():
        with tempfile.TemporaryDirectory(prefix="selfrec-work-") as wd:
            folder = Path(wd)
            project = manifest["track"] == "projects"
            prompt = contract_prompt(spec,root,"writer",subject)
            if not project and audit.data and audit.data["status"] in ("response_recorded","artifact_validated"):
                if audit.data["prompt_sha256"] != text_hash(prompt):
                    raise ValueError("Writer prompt changed during recovery")
                reply = audit.data["reply"]
            else:
                reply, _ = session(model, prompt, folder, env, audit, writing=project, inline=not project)
            if not project:
                (folder/"document.txt").write_text(reply+"\n")
            dest.parent.mkdir(parents=True, exist_ok=True)
            with tempfile.TemporaryDirectory(dir=root/".state") as tmp:
                staged = Path(tmp)/"work"
                try:
                    copy_project(folder, staged)
                except ValueError as exc:
                    audit.invalidate_artifact(str(exc))
                    raise
                files = {str(f):digest(staged/f) for f in safe_files(staged)}
                audit.update("artifact_validated",files=files)
                staged.rename(dest)
    files = {str(rel):digest(dest/rel) for rel in safe_files(dest)}
    if audit.data:
        if audit.data["status"] not in ("artifact_validated","complete") or audit.data["files"] != files:
            raise ValueError("Existing work does not match its attempt receipt")
        if audit.data["status"] != "complete":
            audit.update("complete")
    return dict(**subject,files=files)

def reader_instruction(track, reader, mode):
    ab = mode == "ab"
    inline = track == "inline"
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
    prompt = (f"You are {reader}. "+task+prior+
              f" Give your best guess even if uncertain. Answer {label} on the first line, then give one "
              "sentence about the evidence.")
    return prompt

def prompt_contract(manifest):
    return dict(version=1,track=manifest["track"],
                writers={b["id"]:user_prompt(manifest["track"],b) for b in manifest["briefs"]},
                readers={r:{mode:reader_instruction(manifest["track"],r,mode) for mode in ("ab","yn")}
                         for r in manifest.get("readers",manifest["models"])},
                document_delimiters=DELIMITERS)

DELIMITERS = {"ab":["\n\n=== DOCUMENT A ===\n","\n\n=== DOCUMENT B ===\n"],"yn":["\n\n=== DOCUMENT ===\n"]}

def present_trial(t, root, manifest, folder):
    """Build the reader-visible input using historical instructions when available."""
    frozen = root/"frozen-prompts.json"
    if frozen.exists():
        spec = read(frozen)
    else:
        spec = dict(track=manifest["track"], document_delimiters=DELIMITERS,
                    readers={t["reader"]:{t["mode"]:reader_instruction(manifest["track"],t["reader"],t["mode"])}})
    prompt = contract_prompt(spec,root,"reader",t)
    if manifest["track"] == "projects":
        for side, writer in zip("AB",t["authors"]):
            src = root/"works"/t["brief"]/writer
            copy_project(src,folder/side if t["mode"]=="ab" else folder)
        if t["mode"] == "ab":
            os.utime(folder,(NORMAL_TIME,NORMAL_TIME))
    return prompt

def judge(t, root, manifest, env, quarantined_as_misses=False):
    tag = hashlib.sha256(json.dumps(t,sort_keys=True).encode()).hexdigest()
    cache = root/".state"/"judgments"/(tag+".json")
    if cache.is_file():
        return read(cache)
    with tempfile.TemporaryDirectory(prefix="selfrec-inspect-") as wd:
        folder = Path(wd)
        prompt = present_trial(t, root, manifest, folder)
        inputs = {str(f):digest(folder/f) for f in safe_files(folder)}
        spec = read(root/"frozen-prompts.json")
        audit = AttemptLog(root,"reader",t,object_hash(spec),inputs)
        audit.path, audit.data = audit.last()
        if audit.data and audit.data["status"] in ("response_recorded","complete"):
            if audit.data["prompt_sha256"] != text_hash(prompt) or audit.data["input_files"] != inputs:
                raise ValueError("Reader inputs changed during recovery")
            reply, commands = audit.data["reply"], audit.data["commands"]
        elif not audit.data or audit.data["status"]!="quarantined":
            try:
                reply, commands = session(t["reader"],prompt,folder,env,audit,inline=manifest["track"] == "inline")
            except QuarantinedSession:
                if not quarantined_as_misses:
                    raise
        if audit.data["status"]=="quarantined":
            resolve=mark_locked_reader_miss if quarantined_as_misses else adjudicated_row
            row=resolve(root,audit.path,audit.data)
            save(cache,row)
            return row
        if audit.data["status"] != "complete":
            audit.update("complete")
    row = dict(**t, answer=parse(reply,t["mode"]), reply=reply, commands=commands,
               session_receipt=str(audit.path.relative_to(root)))
    save(cache, row)
    return row

def batch(jobs, function, workers, desc, include=None):
    jobs = list(jobs)
    random.Random(4195).shuffle(jobs)
    if include is not None:
        jobs = [job for job in jobs if include(job)]
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
        contract = prompt_contract(manifest)
        existing = root/"manifest.json"
        if not existing.exists() or "prompt_contract_sha256" in read(existing):
            manifest["prompt_contract_sha256"] = object_hash(contract)
        validate_manifest(manifest)
        if (root/"manifest.json").exists() and read(root/"manifest.json") != manifest:
            raise ValueError("This archive belongs to a different run. Resume with identical arguments or choose a new directory.")
        quarantined_as_misses = getattr(args,"quarantined_readers_as_misses",False)
        selected = getattr(args,"judge_reader",None)
        if selected:
            if args.writers_only or selected not in manifest.get("readers",models):
                raise ValueError("--judge-reader requires a scheduled reader and cannot be combined with --writers-only")
            if not existing.is_file() or not (root/"inventory.json").is_file() or not (root/"frozen-prompts.json").is_file():
                raise ValueError("--judge-reader requires an existing archive with frozen works and prompts")
        if (root/"scores.json").exists():
            verify(root)
            return
        if selected:
            if read(root/"frozen-prompts.json") != contract:
                raise ValueError("Frozen prompt contract differs from the selected run")
            expected={(b["id"],m) for b in briefs for m in models}
            inventory=read(root/"inventory.json")
            if len(inventory)!=len(expected) or {(w["brief"],w["writer"]) for w in inventory}!=expected:
                raise ValueError("Frozen work inventory is incomplete")
            for w in inventory:
                folder=root/"works"/w["brief"]/w["writer"]
                files={str(f):digest(folder/f) for f in safe_files(folder)}
                if not files or files!=w["files"]:
                    raise ValueError("Writing samples differ from the frozen inventory")
            with subscription() as env:
                batch(assignments(manifest),lambda t:judge(t,root,manifest,env,quarantined_as_misses),args.workers,
                      "Judgments",include=lambda t:t["reader"]==selected)
            print(f"Cached judgments for {selected}. Run without --judge-reader to verify and assemble the full archive.")
            return
        save(root/"manifest.json", manifest)
        freeze(root,manifest,contract)
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
            trials=batch(assignments(manifest),lambda t:judge(t,root,manifest,env,quarantined_as_misses),args.workers,"Judgments")
            trials.sort(key=lambda t:(t["brief"],t["reader"],t["opponent"],t["mode"],t["authors"]))
            save(root/"judgments.json", trials)
            save(root/"scores.json", scores(trials))
            verify(root)
