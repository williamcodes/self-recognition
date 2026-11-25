"""Blindly re-judge an existing board using a fresh eligible subscription reader."""

import argparse
import json
import re
from pathlib import Path

from run import HERE, SubscriptionRunner, board, question, save


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--case", required=True)
    p.add_argument("--world", type=int, choices=[0, 1], required=True)
    p.add_argument(
        "--reader", required=True, help="Exact model ID of one of the two known anchors"
    )
    p.add_argument("--input", type=Path, default=HERE / "runs")
    p.add_argument("--manifest", type=Path, default=HERE / "scenarios.json")
    p.add_argument(
        "--logs",
        type=Path,
        required=True,
        help="Private subscription receipt directory",
    )
    p.add_argument(
        "--output", type=Path, required=True, help="Path for the new judgment JSON"
    )
    p.add_argument(
        "--replicate", default="1", help="Unique key for another independent session"
    )
    args = p.parse_args()
    cases = {c["id"]: c for c in json.loads(args.manifest.read_text())}
    if args.case not in cases:
        p.error("Unknown case ID")
    if args.logs.resolve().is_relative_to(HERE.parent.parent):
        p.error("Use a private log directory outside the repository")
    c = cases[args.case]
    if args.reader not in c["models"]:
        p.error(
            "Choose one of "
            + ", ".join(c["models"])
            + " or generate a new collaboration with a different model manifest"
        )
    r = json.loads(
        (args.input / c["split"] / c["id"] / f"world-{args.world}.json").read_text()
    )
    index = c["models"].index(args.reader)
    q = question(c, index) + "\n\n" + board(r["transcript"])
    import hashlib

    key = f"group-independent/{hashlib.sha256(q.encode()).hexdigest()}/{args.reader}/{args.replicate}"
    with SubscriptionRunner(args.logs, workers=1) as runner:
        turn = runner.ask(args.reader, q, key=key)
    expected = "YES" if r["participants"][c["target_role"]] == args.reader else "NO"
    label = re.fullmatch(
        r"\s*(?:\*\*)?(YES|NO)(?:\*\*)?[.!]?\s*",
        turn.text.splitlines()[0],
        re.IGNORECASE,
    )
    answer = label[1].upper() if label else None
    save(
        args.output,
        {
            "scenario": c["id"],
            "world": args.world,
            "reader": args.reader,
            "question": question(c, index),
            "answer": answer,
            "key": expected,
            "correct": answer == expected,
            "reply": turn.text,
        },
    )
    print(turn.text)
    print(f"Recorded answer {answer}, expected {expected}.")


if __name__ == "__main__":
    main()
