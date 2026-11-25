"""On-disk evidence for actual core CLI calls. Run as a module to inspect archive coverage."""
from datetime import datetime, timezone
from functools import lru_cache
import fcntl
import hashlib
import json
from pathlib import Path
import re
import subprocess
import tempfile

from .scoring import digest, read, save


def text_hash(value):
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def object_hash(value):
    return text_hash(json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")))


def now():
    return datetime.now(timezone.utc).isoformat()


def subject_id(subject):
    return object_hash(subject)


def contract_prompt(spec, root, kind, subject):
    """Render from the frozen literal instructions, not from the current prompting code."""
    if kind == "writer":
        return spec["writers"][subject["brief"]]
    text = spec["readers"][subject["reader"]][subject["mode"]]
    if spec["track"] == "inline":
        for delimiter, model in zip(spec["document_delimiters"][subject["mode"]], subject["authors"], strict=True):
            doc = root / "works" / subject["brief"] / model / "document.txt"
            text += delimiter + doc.read_text()
    return text


def freeze(root, manifest, spec):
    """Never label an earlier CLI execution as having a contemporaneous receipt."""
    destination = root / "frozen-prompts.json"
    coverage = root / "provenance" / "boundary.json"
    if destination.exists() and read(destination) != spec:
        raise ValueError("Frozen prompt contract differs. Resume with the original prompts or use a new archive.")
    if not coverage.exists():
        legacy_writers = []
        for b in manifest["briefs"]:
            for m in manifest["models"]:
                if (root / "works" / b["id"] / m).is_dir():
                    legacy_writers.append(dict(brief=b["id"], writer=m))
        legacy_readers = []
        for p in sorted((root / ".state" / "judgments").glob("*.json")):
            row = read(p)
            legacy_readers.append({k: row[k] for k in ("brief","reader","opponent","mode","authors")})
        if manifest.get("prompt_contract_sha256") and (legacy_writers or legacy_readers):
            raise ValueError("Unreceipted work already present in a new archive")
        save(coverage, dict(version=1, first_recording_at=now(), legacy_writers=legacy_writers,
                            legacy_readers=legacy_readers, prompt_contract_sha256=object_hash(spec)))
    elif read(coverage)["prompt_contract_sha256"] != object_hash(spec):
        raise ValueError("Prompt contract differs from this archive's original provenance boundary")
    if not destination.exists():
        save(destination, spec)


@lru_cache(maxsize=8)
def cli_version(exe):
    try:
        result = subprocess.run([exe, "--version"], capture_output=True, text=True, timeout=10)
        version = result.stdout.strip()
        if result.returncode == 0 and re.fullmatch(r"[\w .+()/:-]{1,120}",version):
            return version
    except (OSError, subprocess.TimeoutExpired):
        pass
    return None


# Fingerprint code as loaded, including when another process later edits the checkout.
CODE = {p.name: digest(p) for p in (Path(__file__),Path(__file__).with_name("runner.py"))}


def _replace_workspace(value, folder):
    for base in sorted({str(folder), str(folder.resolve())}, key=len, reverse=True):
        value = value.replace(base+"/", "./")
        if value == base:
            value = "."
    return value


def excursion(command):
    """Conservative indicators, not an OS access boundary or a complete shell parser."""
    # Codex may shell-quote this quoted rg glob again when it logs a zsh -lc wrapper.
    # Remove just the inert literal; keep inspecting every other command and argument.
    command = re.sub(r"""(\brg --files --hidden -g )['"]+!\*\*/\.git/\*\*['"]+(?=\s|$)""",
                     r"\1EXCLUDED_GIT_GLOB",command)
    patterns = (
        ("credential or operator metadata", r"(?:^|[/\s'\"])(?:\.codex|\.claude|\.ssh|\.aws|auth\.json|\.netrc|\.env|id_ed25519)(?=$|[/\s'\"])|\$(?:\{)?(?:HOME|CODEX_HOME)(?:\}|\b)|(?:^|[\s'\"])(?:~|/Users/|/home/)"),
        ("release or process metadata", r"(?:^|[/\s'\"])(?:\.state|\.git)(?=$|[/\s'\"])|(?:^|[\s;|&'\"/])(?:ps|pgrep|lsof|printenv)(?=[\s;|&'\"]|$)|/proc/"),
        ("explicit parent traversal", r"(?:^|[\s/=:(\x27\x22\x60])\.\.(?:/|$|[\s;\x27\x22])"),
    )
    for label, pattern in patterns:
        if re.search(pattern,command,re.I):
            return label
    return None


def event_summary(stdout, folder):
    threads=set()
    reported=set()
    commands=[]
    tool_types=set()
    reasons=set()
    agent_messages=[]
    for line in stdout.splitlines():
        if not line.startswith("{"):
            continue
        try:
            event=json.loads(line)
        except (TypeError,ValueError):
            continue
        if not isinstance(event,dict):
            continue
        typ=event.get("type")
        if typ in ("thread.started","turn.started","turn.completed"):
            sid=event.get("thread_id")
            if isinstance(sid,str) and sid:
                threads.add(text_hash(sid))
            # Only CLI event metadata, never fields found in a model answer or command output.
            for key in ("model","model_id"):
                value=event.get(key)
                if isinstance(value,str) and 0 < len(value) <= 150:
                    reported.add(value)
        item=event.get("item",{})
        if not isinstance(item,dict) or typ not in ("item.started","item.completed"):
            continue
        kind=item.get("type")
        if kind=="agent_message" and typ=="item.completed" and isinstance(item.get("text"),str):
            agent_messages.append(item["text"])
        if kind=="command_execution":
            cmd=_replace_workspace(str(item.get("command","")),folder)
            reason=excursion(cmd)
            if reason:
                reasons.add(reason)
            tool_types.add(kind)
            if typ=="item.completed":
                commands.append(cmd)
        elif kind in ("mcp_tool_call","collab_tool_call","web_search","file_change"):
            tool_types.add(kind)
            if kind!="file_change":
                reasons.add("non-terminal external tool")
    return dict(thread_hashes=sorted(threads),cli_reported_models=sorted(reported),commands=commands,
                tools=sorted(tool_types),boundary_indicators=sorted(reasons)),agent_messages


def content_blob(root, text):
    checksum=text_hash(text)
    path=root/"provenance"/"prompts"/(checksum+".txt")
    if path.exists():
        if digest(path)!=checksum:
            raise ValueError("Corrupt prompt blob")
    else:
        path.parent.mkdir(parents=True,exist_ok=True)
        with tempfile.NamedTemporaryFile(dir=path.parent,delete=False) as tmp:
            tmp.write(text.encode("utf-8"))
        Path(tmp.name).replace(path)
    return checksum


class AttemptLog:
    def __init__(self, root, kind, subject, contract_hash, input_files=None):
        self.root=root
        self.kind=kind
        self.subject=subject
        self.contract_hash=contract_hash
        self.input_files=input_files or {}
        self.group=root/"provenance"/"attempts"/kind/subject_id(subject)
        self.path=None
        self.data=None

    def last(self):
        files=sorted(self.group.glob("*.json"))
        return (files[-1],read(files[-1])) if files else (None,None)

    def start(self, prompt, exe, model, sandbox, inline):
        last_path,prev=self.last()
        if prev and prev["status"]!="no_answer_failure":
            raise RuntimeError(f"Prior {self.kind} attempt needs review before another session: {last_path}")
        n=1 if not prev else prev["attempt"]+1
        self.path=self.group/f"{n:06d}.json"
        self.data=dict(version=1,kind=self.kind,subject=self.subject,attempt=n,status="started",started_at=now(),
                       prompt_contract_sha256=self.contract_hash,prompt_sha256=content_blob(self.root,prompt),
                       input_files=self.input_files,requested_model=model,codex_cli_version=cli_version(exe),
                       code_sha256=CODE,ephemeral=True,sandbox=sandbox,inline=inline,reasoning_effort="medium")
        save(self.path,self.data)

    def update(self,status,**fields):
        self.data.update(status=status,updated_at=now(),**fields)
        save(self.path,self.data)

    def invalidate_artifact(self, reason):
        private=self.root/".state"/"quarantine"/self.kind/subject_id(self.subject)/self.path.name
        save(private,dict(reply=self.data.pop("reply",""),reason=reason,commands=self.data.get("commands",[])))
        self.update("invalid_artifact",commands=[],validation_error="Writer artifact failed validation")

    def observed(self, raw, error, reply, folder, *, rc=None, timeout=False):
        events,messages=event_summary(raw,folder)
        evidence=reply or (messages[-1] if messages else "")
        issues=events["boundary_indicators"] if self.kind=="reader" else []
        if self.data["inline"] and events["tools"]:
            issues=[*issues,"tool used in inline session"]
        fields=dict(**events,returncode=rc,timeout=timeout,stdout_sha256=text_hash(raw),
                    stderr_sha256=text_hash(error),observed_reply=bool(evidence),reply_sha256=text_hash(evidence) if evidence else None)
        if issues:
            # Do not publish a potentially sensitive reply or a command that embedded outside data.
            fields["commands"]=[]
            fields["quarantine_reasons"]=sorted(set(issues))
            private=self.root/".state"/"quarantine"/self.kind/subject_id(self.subject)/self.path.name
            save(private,dict(raw_reply=evidence,commands=events["commands"]))
            self.update("quarantined",**fields)
            raise RuntimeError(f"Session quarantined for input-boundary review: {self.path}")
        fields["reply"]=evidence
        if timeout or rc!=0 or not reply.strip():
            self.update("observed_failure" if evidence else "no_answer_failure",**fields)
            return None
        self.update("response_recorded",**fields)
        return events["commands"]


def mark_reader_miss(root, sid):
    """Retain a quarantined reader receipt and record its score disposition offline."""
    if not re.fullmatch(r"[0-9a-f]{64}",sid):
        raise ValueError("Expected a reader subject ID")
    with (root/".state"/"run.lock").open("a") as lock:
        fcntl.flock(lock,fcntl.LOCK_EX | fcntl.LOCK_NB)
        receipts=sorted((root/"provenance"/"attempts"/"reader"/sid).glob("*.json"))
        if not receipts:
            raise ValueError("Reader receipt not found")
        path=receipts[-1]
        a=read(path)
        if (a["kind"]!="reader" or a["status"]!="quarantined" or not a.get("quarantine_reasons")
                or subject_id(a["subject"])!=sid):
            raise ValueError("Only quarantined readers may be adjudicated as misses")
        disposition=root/"provenance"/"adjudications"/(sid+".json")
        if not disposition.exists():
            save(disposition,dict(action="invalid_miss",receipt_sha256=digest(path),decided_at=now()))
        return adjudicated_row(root,path,a)


def adjudicated_row(root,path,attempt):
    sid=subject_id(attempt["subject"])
    disposition=root/"provenance"/"adjudications"/(sid+".json")
    if not disposition.is_file():
        raise ValueError(f"Quarantined reader has no recorded disposition: {sid}")
    decision=read(disposition)
    if (attempt["kind"]!="reader" or attempt["status"]!="quarantined" or not attempt.get("quarantine_reasons")
            or decision["action"]!="invalid_miss" or decision["receipt_sha256"]!=digest(path)):
        raise ValueError("Disposition differs from the quarantined reader receipt")
    return dict(**attempt["subject"],answer=None,reply="",commands=[],disposition="invalid_miss",
                session_receipt=str(path.relative_to(root)))


def verify_provenance(root):
    """Validate receipts and frozen inputs when present; describe genuine historical gaps."""
    root=Path(root)
    m=read(root/"manifest.json"); rows=read(root/"judgments.json") if (root/"judgments.json").exists() else []
    inv=read(root/"inventory.json") if (root/"inventory.json").exists() else []
    writers={(x["brief"],x["writer"]):x["files"] for x in inv}
    subject_fields=("brief","reader","opponent","mode","authors")
    subjects={subject_id({k:r[k] for k in subject_fields}):r for r in rows}
    for row in rows:
        for cmd in row.get("commands",[]):
            if excursion(cmd):
                raise ValueError("Archived reader command flagged for review; do not treat this archive as verified")
        if m["track"]=="inline" and row.get("commands"):
            raise ValueError("Inline reader used a tool")
    archive=root/"provenance"
    spec_path=root/"frozen-prompts.json"
    if not archive.exists() and not spec_path.exists():
        if m.get("prompt_contract_sha256") or any(r.get("session_receipt") for r in rows):
            raise ValueError("Missing required prompt/session provenance")
        return dict(status="historical-unreceipted",writers_with_receipts=0,readers_with_receipts=0,
                    writers_without_receipts=len(inv),readers_without_receipts=len(rows))
    spec=read(spec_path);boundary=read(archive/"boundary.json");ch=object_hash(spec)
    if m.get("prompt_contract_sha256",ch)!=ch or boundary["prompt_contract_sha256"]!=ch:
        raise ValueError("Frozen prompts do not match contract hash")
    ok_w=set();ok_r=set();seen_threads=set();states={}
    previous={}
    adjudications=set()
    model_metadata_count=0
    thread_metadata_count=0
    known_w={subject_id(dict(brief=b,writer=w)) for b,w in writers}
    for path in sorted((archive/"attempts").glob("*/*/*.json")):
        a=read(path);s=a["subject"];sid=subject_id(s);kind=a["kind"];st=a["status"]
        states[st]=states.get(st,0)+1
        if (kind not in ("writer","reader") or path.parent.name!=sid or path.parent.parent.name!=kind
                or path.name!=f"{a['attempt']:06d}.json" or a["prompt_contract_sha256"]!=ch):
            raise ValueError("Attempt identity or frozen contract mismatch")
        if (kind,sid) in previous:
            number,prior_state=previous[kind,sid]
            if prior_state!="no_answer_failure" or a["attempt"]!=number+1:
                raise ValueError("Unexpected resample or gap in the attempt history")
        elif a["attempt"]!=1:
            raise ValueError("First attempt receipt missing")
        previous[kind,sid]=(a["attempt"],st)
        if ((kind=="writer" and sid not in known_w) or (kind=="reader" and sid not in subjects)):
            raise ValueError("Receipt does not belong to a scheduled session")
        prompt=contract_prompt(spec,root,kind,s)
        if a["prompt_sha256"]!=text_hash(prompt) or digest(archive/"prompts"/(a["prompt_sha256"]+".txt"))!=a["prompt_sha256"]:
            raise ValueError("Receipt prompt differs from the actual archived input")
        requested=s["writer"] if kind=="writer" else s["reader"]
        if (a["sandbox"]!=("workspace-write" if kind=="writer" and m["track"]=="projects" else "read-only")
                or not a["ephemeral"] or a["inline"]!=(m["track"]=="inline") or a["reasoning_effort"]!="medium"):
            raise ValueError("Unexpected harness configuration in receipt")
        if a["requested_model"]!=requested:
            raise ValueError("Unexpected requested model in receipt")
        if a.get("observed_reply") and st not in ("quarantined","invalid_artifact") and text_hash(a["reply"])!=a["reply_sha256"]:
            raise ValueError("Recorded reply digest mismatch")
        if st not in ("complete","no_answer_failure") and not (st=="quarantined" and kind=="reader"):
            raise ValueError(f"Unresolved {st} attempt: {path}")
        ids=a.get("thread_hashes",[])
        if len(ids)>1 or seen_threads.intersection(ids):
            raise ValueError("Expected a distinct ephemeral thread for every session")
        seen_threads.update(ids)
        thread_metadata_count+=bool(ids)
        model_metadata_count+=bool(a.get("cli_reported_models"))
        if st=="complete" and (a.get("boundary_indicators") and kind=="reader" or a["inline"] and a.get("tools")):
            raise ValueError("Completed receipt reports a disallowed tool interaction")
        if st=="no_answer_failure":
            if a.get("observed_reply"):raise ValueError("Failed attempt contains an unadjudicated answer")
            continue
        if kind=="reader":
            row=subjects.get(sid)
            if st=="quarantined":
                if row!=adjudicated_row(root,path,a):
                    raise ValueError("Quarantined trial must be scored as an invalid miss")
                adjudications.add(sid)
            elif (not row or row.get("disposition") or row.get("session_receipt")!=str(path.relative_to(root))
                    or a["reply"]!=row["reply"] or a["commands"]!=row["commands"] or sid in ok_r):
                raise ValueError("Reader receipt does not match the scored record")
            expected={}
            if m["track"]=="projects":
                for side,w in zip("AB",s["authors"]):
                    prefix=side+"/" if s["mode"]=="ab" else ""
                    expected.update({prefix+k:v for k,v in writers[s["brief"],w].items()})
            if a["input_files"]!=expected:raise ValueError("Reader workspace differs from frozen artifacts")
            ok_r.add(sid)
        else:
            if a["files"]!=writers[s["brief"],s["writer"]] or sid in ok_w:
                raise ValueError("Writer receipt does not match work inventory")
            ok_w.add(sid)
    if {p.stem for p in (archive/"adjudications").glob("*.json")}!=adjudications:
        raise ValueError("Unexpected adjudication record")
    excluded_w={subject_id(s) for s in boundary["legacy_writers"]}
    excluded_r={subject_id(s) for s in boundary["legacy_readers"]}
    if m.get("prompt_contract_sha256") and (excluded_w or excluded_r):
        raise ValueError("Unexpected historical exemptions in a new archive")
    copied={subject_id(dict(brief=b,writer=w)) for b,w in writers if m.get("reference_manifest_sha256") and w in m.get("panel",[])}
    if known_w-ok_w-excluded_w-copied or set(subjects)-ok_r-excluded_r:
        raise ValueError("An expected writer or reader session receipt is missing")
    return dict(status="verified",states=states,adjudicated_invalid_misses=len(adjudications),writers_with_receipts=len(ok_w),readers_with_receipts=len(ok_r),
                writers_without_receipts=len(known_w-ok_w-copied),readers_without_receipts=len(subjects)-len(ok_r),
                reference_works_without_local_calls=len(copied),attempts_with_thread_metadata=thread_metadata_count,
                attempts_with_cli_model_metadata=model_metadata_count)


if __name__=="__main__":
    import argparse
    ap=argparse.ArgumentParser(description=__doc__);ap.add_argument("archive",type=Path)
    ap.add_argument("--mark-reader-miss",metavar="SUBJECT_ID",
                    help="Record an invalid miss for a quarantined reader before resuming an archive")
    args=ap.parse_args()
    result=mark_reader_miss(args.archive,args.mark_reader_miss) if args.mark_reader_miss else verify_provenance(args.archive)
    print(json.dumps(result,indent=2))
