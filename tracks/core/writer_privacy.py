"""Inspect completed writer receipts, or migrate their home prefixes without touching readers."""
import argparse
from collections import Counter
import fcntl
import hashlib
import json
from pathlib import Path
import re
import tempfile

from .scoring import digest, read, save


PLACEHOLDER="<OPERATOR_HOME>"
RULE="literal-home-prefix-v1"


def command_hash(commands):
    stream=json.dumps(commands,ensure_ascii=False,sort_keys=True,separators=(",",":"))
    return hashlib.sha256(stream.encode()).hexdigest()


def redact(commands,home):
    # A sibling account name with the same initial characters is a different path.
    pattern=re.compile(re.escape(str(home))+r"(?=$|[/\s\x22\x27:;)])")
    return [pattern.sub(PLACEHOLDER,c) for c in commands]


def private_path(root,path):
    return root/".state"/"writer-originals"/path.parent.name/path.name


def private_copy(path,raw):
    """Keep the first byte-for-byte copy, including across interrupted migrations."""
    import os
    path.parent.mkdir(mode=0o700,parents=True,exist_ok=True)
    with tempfile.NamedTemporaryFile(dir=path.parent,delete=False) as f:
        f.write(raw)
    temp=Path(f.name)
    try:
        try:
            os.link(temp,path)
        except FileExistsError:
            if path.read_bytes()!=raw:
                raise ValueError("Existing private copy differs from original")
    finally:
        temp.unlink()


def public_fields(root,path,commands,home,original=None):
    public=redact(commands,home)
    if public==commands:
        return {}
    backup=private_path(root,path)
    if original is None:
        original=json.dumps({"commands":commands},ensure_ascii=False).encode()
    private_copy(backup,original)
    return dict(commands=public,command_redaction=dict(rule=RULE,substitutions=sum(c.count(PLACEHOLDER)-
                orig.count(PLACEHOLDER) for c,orig in zip(public,commands)),original_sha256=command_hash(commands),
                public_sha256=command_hash(public)))


def verify_redaction(root,path,a):
    mark=a.get("command_redaction")
    if not mark: return
    if (a["kind"]!="writer" or mark["rule"]!=RULE or mark["public_sha256"]!=command_hash(a["commands"])
        or not re.fullmatch(r"[0-9a-f]{64}",mark["original_sha256"]) or mark["substitutions"]<1
        or sum(c.count(PLACEHOLDER) for c in a["commands"])<mark["substitutions"]):
        raise ValueError("Invalid command redaction metadata")
    private=private_path(root,path)
    if private.is_file():
        original=read(private)
        if command_hash(original["commands"])!=mark["original_sha256"]:
            raise ValueError("Private original command list differs")
        locally_redacted=redact(original["commands"],Path.home())
        if locally_redacted!=original["commands"] and locally_redacted!=a["commands"]:
            raise ValueError("Redacted commands differ from the saved originals")
        for k in ("stdout_sha256","stderr_sha256"):
            if k in original and original[k]!=a[k]:
                raise ValueError("Original CLI stream digest differs")


def migrate(root,apply=False):
    writers=root/"provenance"/"attempts"/"writer"
    inv={(r["brief"],r["writer"]):r["files"] for r in read(root/"inventory.json")}
    counts=Counter()
    for path in sorted(writers.glob("*/*.json")):
        a=read(path)
        if a.get("status")!="complete": continue
        s=a["subject"]
        if a["kind"]!="writer" or inv.get((s["brief"],s["writer"]))!=a["files"]:
            raise ValueError("Completed writer receipt does not match frozen inventory")
        counts["completed_receipts"]+=1
        if a.get("command_redaction"):
            verify_redaction(root,path,a)
            counts["already_redacted"]+=1
            continue
        commands=a.get("commands",[])
        if redact(commands,Path.home())==commands: continue
        counts["eligible"]+=1
        if apply:
            raw=path.read_bytes()
            if json.loads(raw)!=a: raise ValueError("Writer receipt changed during the scan")
            a.update(public_fields(root,path,commands,Path.home(),original=raw))
            save(path,a)
            verify_redaction(root,path,a)
    return counts


if __name__=="__main__":
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument("archive",type=Path)
    p.add_argument("--apply",action="store_true",help="Migrate completed immutable writer receipts after inventory freeze")
    args=p.parse_args()
    if args.apply:
        with (args.archive/".state"/"writer-redaction.lock").open("a") as lock:
            fcntl.flock(lock,fcntl.LOCK_EX | fcntl.LOCK_NB)
            counts=migrate(args.archive,apply=True)
    else:
        counts=migrate(args.archive)
    print(json.dumps(counts,sort_keys=True))
