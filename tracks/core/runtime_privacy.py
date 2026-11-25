"""Remove per-session operating-system identifiers from public writer receipts."""
import argparse
import json
import re
from pathlib import Path

from .scoring import read, save
from .writer_privacy import command_hash, private_copy

PATTERNS = (
    (re.compile(r"/(?:private/)?var/folders/[\w-]{2}/[\w-]{10,}"), "<TEMP>"),
    (re.compile(r"(?<=/)selfrec-(inspect|work|auth)-[\w]{6,}"), r"selfrec-\1-<SESSION>"),
    (re.compile(r"(?<=generated_images/)[a-f0-9]{8}-[a-f0-9-]{27,}"), "<SESSION>"),
)


def scrub(text):
    for pattern, replacement in PATTERNS:
        text = pattern.sub(replacement, text)
    return text


def migrate(archive):
    count = 0
    for path in sorted((archive / "provenance/attempts/writer").glob("*/*.json")):
        row = read(path)
        commands = [scrub(c) for c in row.get("commands", [])]
        reply = scrub(row.get("reply", ""))
        if commands == row.get("commands", []) and reply == row.get("reply", ""):
            continue
        private_copy(archive / ".state/runtime-originals" / path.parent.name / path.name, path.read_bytes())
        row["runtime_redaction"] = {
            "rule": "anonymous-runtime-paths-v1",
            "prior_commands_sha256": command_hash(row["commands"]),
            "public_commands_sha256": command_hash(commands),
        }
        row["commands"] = commands
        if reply != row.get("reply", ""):
            import hashlib
            row["runtime_redaction"]["original_reply_sha256"] = row["reply_sha256"]
            row["reply"] = reply
            row["reply_sha256"] = hashlib.sha256(reply.encode()).hexdigest()
        save(path, row)
        count += 1
    return count


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("archive", type=Path)
    print(json.dumps({"receipts_updated": migrate(parser.parse_args().archive)}))
