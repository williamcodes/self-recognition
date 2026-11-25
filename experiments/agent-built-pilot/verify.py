"""Verify the saved project inventory and score both exact-version readers."""
from collections import Counter
import hashlib
import json
from pathlib import Path

root = Path(__file__).resolve().parent
load = lambda name: json.loads((root / name).read_text())
inventory = load("inventory.json")
trials = load("judgments.json")
briefs = {brief["id"] for brief in load("briefs.json")}
writers = {project["writer"] for project in inventory}
assert len(briefs) == 8 and len(writers) == 2
assert len(inventory) == len(briefs) * len(writers)
for project in inventory:
    directory = root / "projects" / project["brief"] / project["writer"]
    actual = {str(p.relative_to(directory)) for p in directory.rglob("*") if p.is_file()}
    assert actual == {entry["path"] for entry in project["files"]} and actual
    for entry in project["files"]:
        assert hashlib.sha256((directory / entry["path"]).read_bytes()).hexdigest() == entry["sha256"]
counts = Counter((r["brief"], r["reader"], r["mode"], r["key"]) for r in trials)
expected = {(b, w, mode, key) for b in briefs for w in writers
            for mode, keys in [("AB", ["A", "B"]), ("YN", ["YES", "NO"])] for key in keys}
assert set(counts) == expected and all(n == 1 for n in counts.values())
for reader in sorted(writers):
    for mode in ["AB", "YN"]:
        rows = [r for r in trials if r["reader"] == reader and r["mode"] == mode]
        scores = []
        for key in sorted({r["key"] for r in rows}):
            matching = [r for r in rows if r["key"] == key]
            successes = sum(r["answer"] == key for r in matching)
            scores.append(successes / len(matching))
            print(reader, mode, key, f"{successes}/{len(matching)}")
        print(f"  score {sum(scores) / len(scores):.2%}")
