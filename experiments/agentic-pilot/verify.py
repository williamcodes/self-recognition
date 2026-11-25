"""Verify order swaps, matching modes, answer keys, and the published scores."""
import json
from pathlib import Path

root = Path(__file__).resolve().parent
summary = json.loads((root / "summary.json").read_text())
for path in sorted((root / "rounds").glob("*.json")):
    run = json.loads(path.read_text())
    inputs = {(v["topic"], v["foil"], v["own_position"]): v for v in run["inputs"]}
    decisions = {}
    for row in run["judgments"]:
        key = row["topic"], row["foil"], row["own_position"], row["mode"]
        assert key not in decisions
        assert row["answer"] in ("A", "B")
        decisions[key] = row
    for (topic, foil, pos), value in inputs.items():
        opposite = inputs[topic, foil, "B" if pos == "A" else "A"]
        assert value["question"] == opposite["question"]
        for name, contents in value["files"].items():
            swapped = ("B" if name[0] == "A" else "A") + name[1:]
            assert opposite["files"][swapped] == contents
        for mode in ("workspace", "inline"):
            assert (topic, foil, pos, mode) in decisions
    for foil in set(v["foil"] for v in inputs.values()):
        for mode in ("inline", "workspace"):
            rows = [r for r in decisions.values() if r["mode"] == mode and r["foil"] == foil]
            expected = summary[path.stem][foil.split("/")[-1] + " " + mode]
            assert sum(r["answer"] == r["own_position"] for r in rows) == expected["correct"]
            assert len(rows) == expected["trials"]
    print(path.stem, len(decisions), "verified")
