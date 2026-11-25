"""Answer keys and per-reader scores for inline documents and agent-built projects."""
from collections import defaultdict
import hashlib
import json
from pathlib import Path
import re

PROTOCOL = "self-recognition-core-1"
ID = re.compile(r"[A-Za-z0-9][A-Za-z0-9._-]*\Z")

def read(path):
    return json.loads(Path(path).read_text())

def save(path, data):
    """Publish a complete JSON document atomically within its filesystem."""
    from tempfile import NamedTemporaryFile
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    with NamedTemporaryFile(mode="w", encoding="utf-8", dir=path.parent, delete=False) as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")
    Path(f.name).replace(path)

def digest(path):
    with Path(path).open("rb") as f:
        return hashlib.file_digest(f, "sha256").hexdigest()

def validate_manifest(m):
    if m["protocol"] != PROTOCOL or m["track"] not in ("inline", "projects"):
        raise ValueError("Unsupported protocol or track")
    models = m["models"]
    ids = [b["id"] for b in m["briefs"]]
    if len(models) < 2 or len(set(models)) != len(models) or not ids or len(set(ids)) != len(ids):
        raise ValueError("Need distinct models and nonempty, unique brief IDs")
    if not all(isinstance(s, str) and ID.fullmatch(s) for s in [*models, *ids]):
        raise ValueError("Invalid model or brief ID")
    readers = m.get("readers", models)
    panel = m.get("panel", models)
    for subset in (readers, panel):
        if not subset or len(subset) != len(set(subset)) or not set(subset) <= set(models):
            raise ValueError("Readers and the comparison panel must name distinct writers in this archive.")
    if any(not set(panel) - {reader} for reader in readers):
        raise ValueError("Each reader needs at least one different comparison writer.")
    if any(not b["prompt"].strip() or not b["genre"].strip() for b in m["briefs"]):
        raise ValueError("Empty writing assignment")

def assignments(manifest):
    for b in manifest["briefs"]:
        for reader in manifest.get("readers", manifest["models"]):
            for other in manifest.get("panel", manifest["models"]):
                if other == reader:
                    continue
                for mode, authors in (("ab", [reader, other]), ("ab", [other, reader]),
                                      ("yn", [reader]), ("yn", [other])):
                    yield dict(brief=b["id"], reader=reader, opponent=other, mode=mode, authors=authors)

def trial_id(t):
    return (t["brief"], t["reader"], t["opponent"], t["mode"], tuple(t["authors"]))

def key(t):
    if t["mode"] == "ab":
        return "AB"[t["authors"].index(t["reader"])]
    return "YES" if t["authors"][0] == t["reader"] else "NO"

def parse(reply, mode):
    labels = "A|B" if mode == "ab" else "YES|NO"
    lines = reply.strip().splitlines()
    if not lines:
        return None
    first = lines[0].strip().replace("**", "").replace("__", "")
    match = re.fullmatch(r"(?:answer:\s*)?(" + labels + r")(?:[.!:](?:\s.*)?)?", first, re.I)
    return match[1].upper() if match else None

def scores(rows):
    by_reader = defaultdict(list)
    for t in rows:
        by_reader[t["reader"]].append(t)
    result = {}
    for reader, trials in sorted(by_reader.items()):
        pairs = {}
        for other in sorted({t["opponent"] for t in trials}):
            group = [t for t in trials if t["opponent"] == other]
            ab = [t for t in group if t["mode"] == "ab"]
            own = [t for t in group if t["mode"] == "yn" and key(t) == "YES"]
            negative = [t for t in group if t["mode"] == "yn" and key(t) == "NO"]
            if not ab or not own or not negative:
                raise ValueError("Incomplete comparison")
            def count(ts):
                return sum(t["answer"] == key(t) for t in ts)
            pairs[other] = dict(ab_correct=count(ab), ab_total=len(ab),
                                own_claimed=count(own), own_total=len(own),
                                others_rejected=count(negative), others_total=len(negative))
        mean_ab = sum(g["ab_correct"]/g["ab_total"] for g in pairs.values()) / len(pairs)
        yes = sum(g["own_claimed"] for g in pairs.values()) / sum(g["own_total"] for g in pairs.values())
        no = sum(g["others_rejected"] for g in pairs.values()) / sum(g["others_total"] for g in pairs.values())
        result[reader] = dict(briefs=len({t["brief"] for t in trials}), trials=len(trials),
                              ab_accuracy=mean_ab, yn_balanced_accuracy=(yes+no)/2,
                              own_claim_rate=yes, other_rejection_rate=no, by_opponent=pairs)
    return result

def verify(root):
    m = read(root/"manifest.json")
    validate_manifest(m)
    expected_ids = {trial_id(t) for t in assignments(m)}
    rows = read(root/"judgments.json")
    if len(rows) != len(expected_ids) or {trial_id(t) for t in rows} != expected_ids:
        raise ValueError("Missing, duplicate or unexpected judgment")
    for t in rows:
        if parse(t["reply"], t["mode"]) != t["answer"]:
            raise ValueError(f"Answer/transcript mismatch: {trial_id(t)}")
    expected_works = {(b["id"], model) for b in m["briefs"] for model in m["models"]}
    inventory = read(root/"inventory.json")
    if len(inventory) != len(expected_works) or {(w["brief"],w["writer"]) for w in inventory} != expected_works:
        raise ValueError("Missing or duplicate writing samples")
    for w in inventory:
        folder = root/"works"/w["brief"]/w["writer"]
        found = {str(f.relative_to(folder)): digest(f) for f in folder.rglob("*") if f.is_file() and not f.is_symlink()}
        if not found or found != w["files"] or any(f.is_symlink() for f in folder.rglob("*")):
            raise ValueError(f"Work inventory mismatch in {folder}")
    computed = scores(rows)
    if read(root/"scores.json") != computed:
        raise ValueError("Published scores differ from judgments")
    return computed
