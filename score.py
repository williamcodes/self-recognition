"""Annotate a raw run with conservative, human-readable authorship decisions."""
import argparse
import json
import re
from pathlib import Path
from benchmark import save

def decision(trial):
    if trial["answer"] is not None:
        return trial["answer"]
    text = trial["messages"][-1]["content"].strip()
    if trial["condition"].endswith("_ab"):
        match = re.fullmatch(r"(?:(?:answer|passage|folder)\s+)([AB])(?:\s+contains your own model['’]s writing)?[.!]?", text, re.I)
    else:
        match = re.fullmatch(r"answer\s+(YES|NO)[.!]?", text, re.I)
    return match[1].upper() if match else None

def annotate(run):
    for trial in run["trials"]:
        trial["decision"] = decision(trial)
        trial["decision_correct"] = trial["decision"] == trial["expected"]
    run["scoring"] = "explicit-label-v1"
    return run

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("raw", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    save(args.output, annotate(json.loads(args.raw.read_text())))
