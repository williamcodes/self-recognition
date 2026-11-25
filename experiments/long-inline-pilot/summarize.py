"""Verify the anonymous label keys and print scores without combining order swaps into new topics."""
import json
import statistics
from pathlib import Path

root = Path(__file__).resolve().parent
trials = json.loads((root / "judgments.json").read_text())
briefs = json.loads((root / "briefs.json").read_text())
readers = sorted({trial["reader"] for trial in trials})
assert len(trials) == 168 and len(briefs) == 8 and len(readers) == 3
keys = {(r["reader"], r["brief"], r["mode"], r["writer_or_opponent"], r["expected"]) for r in trials}
assert len(keys) == len(trials)
for brief in briefs:
    for reader in readers:
        for opponent in readers:
            assert (reader, brief["id"], "yn", opponent, "YES" if reader == opponent else "NO") in keys
            if reader != opponent:
                for expected in "AB":
                    assert (reader, brief["id"], "ab", opponent, expected) in keys

def correct(rows):
    return sum(r["answer"] == r["expected"] for r in rows)

words = [len(p.read_text().split()) for p in (root / "documents").glob("*/*.txt")]
assert len(words) == len(briefs) * len(readers)
print("Document words (min / median / max)", min(words), statistics.median(words), max(words))
for reader in readers:
    mine = [r for r in trials if r["reader"] == reader]
    yes = [r for r in mine if r["mode"] == "yn" and r["expected"] == "YES"]
    no = [r for r in mine if r["mode"] == "yn" and r["expected"] == "NO"]
    ba = (correct(yes) / len(yes) + correct(no) / len(no)) / 2
    print(reader, "own claimed", correct(yes), "/", len(yes), "others rejected", correct(no), "/", len(no), "balanced", ba)
    for opponent in readers:
        if reader != opponent:
            paired = [r for r in mine if r["mode"] == "ab" and r["writer_or_opponent"] == opponent]
            print("  A/B against", opponent, correct(paired), "/", len(paired))
print("Unparsed replies (scored incorrect)", sum(r["answer"] is None for r in trials))

followup = json.loads((root / "balanced-prior.json").read_text())
assert len(followup) == 48
for m, reader in enumerate(["gpt-6.2-astra", "gpt-6.2-sol", "claude-fable-5-2"]):
    group = [r for r in followup if r["reader"] == reader]
    assert len(group) == 16
    for brief in briefs:
        pair = [r for r in group if r["brief"] == brief["id"]]
        assert len(pair) == 2 and {r["expected"] for r in pair} == {"YES", "NO"}
        assert all((r["writer_or_opponent"] == reader) == (r["expected"] == "YES") for r in pair)
    print("With stated prior", reader, correct(group), "/", len(group))
