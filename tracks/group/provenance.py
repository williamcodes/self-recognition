"""Export and verify de-identified participant-session and response fingerprints."""

import argparse
import hashlib
import json
from collections import defaultdict
from pathlib import Path

from run import HERE, board, save


def digest(text):
    return hashlib.sha256(text.encode()).hexdigest()


def expected_rows(runs, replays):
    for path in sorted(runs.glob("*/*/world-*.json")):
        rec = json.loads(path.read_text())
        base = f"group/{rec['version']}/{rec['case']}/{rec['world']}"
        for t in rec["transcript"]:
            yield (
                base + f"/{t['seat']}/{t['phase']}",
                rec["participants"][t["seat"]],
                t["text"],
                (rec["case"], rec["world"], t["seat"]),
            )
        for j in rec["judgments"]:
            yield (
                base + f"/fresh-reader/{j['reader']}",
                j["reader"],
                j["reply"],
                (rec["case"], rec["world"], "fresh-reader", j["reader"]),
            )
    for row in json.loads(replays.read_text()):
        case = row["scenario"]
        arm = int(row["updated_information_present"])
        yield (
            f"group-replay/v1/{case}/0/{arm}",
            row["model"],
            row["reply"],
            ("carrier-replay", case, 0, arm),
        )


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--runs", type=Path, default=HERE / "runs")
    p.add_argument(
        "--logs",
        type=Path,
        help="Use private receipts to export fingerprints; otherwise verify the published fingerprints",
    )
    p.add_argument("--replays", type=Path, default=HERE / "replays.json")
    p.add_argument("--file", type=Path, default=HERE / "provenance.json")
    args = p.parse_args()
    expected = list(expected_rows(args.runs, args.replays))
    if not expected:
        raise ValueError("No saved turns under " + str(args.runs))
    if args.logs:
        entries = []
        for key, model, body, seat in expected:
            name = (
                hashlib.sha256(json.dumps(key, sort_keys=True).encode()).hexdigest()
                + ".json"
            )
            receipt = json.loads((args.logs / name).read_text())
            if receipt["state"] != "complete":
                raise ValueError("Incomplete receipt " + key)
            turn = receipt["turn"]
            assert (
                turn["text"] == body
                and turn["model"] == model
                and receipt["key"] == key
            )
            entries.append(
                {
                    "key": key,
                    "model": model,
                    "session_fingerprint": digest(turn["session"]["id"]),
                    "response_sha256": digest(body),
                    "request_fingerprint": receipt["fingerprint"],
                }
            )
        save(args.file, entries)
    entries = {row["key"]: row for row in json.loads(args.file.read_text())}
    if set(entries) != {x[0] for x in expected}:
        raise ValueError("Saved turns and provenance manifest differ")
    for path in sorted(args.runs.glob("*/*/world-*.json")):
        rec = json.loads(path.read_text())
        for j in rec["judgments"]:
            key = f"group/{rec['version']}/{rec['case']}/{rec['world']}/fresh-reader/{j['reader']}"
            prompt = j["question"] + "\n\n" + board(rec["transcript"])
            actual = digest(
                json.dumps([j["reader"], prompt, None, None, key], sort_keys=True)
            )
            assert entries[key]["request_fingerprint"] == actual, (
                "Reader-visible prompt changed"
            )
    per_seat = defaultdict(set)
    for key, model, body, seat in expected:
        row = entries[key]
        assert row["model"] == model and row["response_sha256"] == digest(body)
        per_seat[seat].add(row["session_fingerprint"])
    assert all(len(x) == 1 for x in per_seat.values()), "A participant changed sessions"
    assert len({next(iter(x)) for x in per_seat.values()}) == len(per_seat), (
        "Sessions crossed participants or worlds"
    )
    print(
        f"{len(entries)} turn bodies verified, {len(per_seat)} distinct sessions. No session or authentication IDs exported."
    )


if __name__ == "__main__":
    main()
