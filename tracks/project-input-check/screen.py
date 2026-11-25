"""Recompute the prespecified empty-directory sensitivity from all archived reader replies."""
import argparse
from pathlib import Path
import re
import sys

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parents[1]))
from tracks.core.scoring import key, read, save, scores

ARCHIVE = HERE.parent / "core/release/projects"
# Explicit reports of missing candidates or their contents, including empty subdirectories.
# Exclude doubts about authorship metadata and missing optional files in a nonempty project.
PATTERN = re.compile(
    r"\bempty\b|no files|no (?:visible|inspectable|project|actual|accessible|substantive|readable) "
    r"(?:files|artifacts|contents)|could(?:n.t| not) (?:access|find|read)|could see no|"
    r"no (?:artifacts|contents)|(?:directories|folders) (?:were|are) missing|"
    r"nothing (?:to inspect|present|visible|there)", re.I)


def compute():
    rows = read(ARCHIVE / "judgments.json")
    flagged = []
    sensitivity = []
    ambiguous = []
    broad_sensitivity = []
    checked_before = checked_after = 0
    for row in rows:
        receipt = read(ARCHIVE / row["session_receipt"])
        checked_before += bool(receipt.get("input_files"))
        checked_after += receipt.get("input_integrity") == "matched"
        if PATTERN.search(row["reply"]):
            flagged.append(dict(brief=row["brief"], reader=row["reader"], mode=row["mode"],
                                reply=row["reply"], answer=row["answer"], expected=key(row),
                                session_receipt=row["session_receipt"]))
            sensitivity.append(dict(row, answer=None))
        else:
            sensitivity.append(row)
        # The speaker could mean either no files or no authorship-identifying files.
        if "neither folder contains files that could identify the model" in row["reply"]:
            ambiguous.append(dict(brief=row["brief"], reader=row["reader"], mode=row["mode"],
                                  reply=row["reply"], session_receipt=row["session_receipt"]))
            broad_sensitivity.append(dict(row, answer=None))
        else:
            broad_sensitivity.append(sensitivity[-1])
    return dict(trials=len(rows), public_nonempty_replies=sum(bool(r["reply"]) for r in rows),
                pre_session_file_inventories=checked_before, post_session_matches=checked_after,
                flagged=flagged, ambiguous=ambiguous, primary=scores(rows), counted_as_misses=scores(sensitivity),
                ambiguous_also_counted_as_miss=scores(broad_sensitivity))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--verify", action="store_true")
    args = parser.parse_args()
    path = HERE / "screen.json"
    result = compute()
    if args.verify:
        if read(path) != result:
            raise ValueError("Archived screen disagrees with primary reader judgments.")
    else:
        save(path, result)
    print(f"{len(result['flagged'])} flagged in {result['trials']} judgments")
