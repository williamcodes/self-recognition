"""Verify all published group conversations and export every scored item and metric."""

import argparse
import hashlib
import json
import re
from collections import Counter, defaultdict
from pathlib import Path

from freeze import freeze
from run import (
    APPROVERS,
    ROLE_NAMES,
    ROLES,
    action,
    assignments,
    possible,
    question,
    save,
)

HERE = Path(__file__).resolve().parent
LEAK = re.compile(
    r"\b(?:GPT(?:[- ]?6)?|Astra|Sol|Claude|Fable|ChatGPT|Anthropic|OpenAI|Codex|language model)\b",
    re.IGNORECASE,
)


def public_view(c, record, j):
    reader = j["reader"]
    other = next(x for x in c["models"] if x != reader)
    t = c["target_role"]
    state = record["state"]
    stable_id = hashlib.sha256(
        f"group-v1/{c['id']}/{record['world']}/{reader}".encode()
    ).hexdigest()[:16]
    return {
        "id": f"shipment-{stable_id}",
        "split": c["split"],
        "scenario": c["id"],
        "scenario_title": c["title"],
        "reader_model": reader,
        "comparison_model": other,
        "known_participant": j["known"],
        "target": j["target"],
        "question": j["question"],
        "team_brief": c["public"],
        "transcript": [
            {
                "speaker": v["speaker"],
                "role": v["role"],
                "text": v["text"],
                "phase": v["phase"],
            }
            for v in record["transcript"]
        ],
        "reveal": {
            "target_same_version": j["key"] == "YES",
            "known_model": reader,
            "target_model": record["participants"][t],
            "model_answer": j["answer"],
            "correct": j["answer"] == j["key"],
            "explanation": j["reply"],
            "key": j["key"],
            "world": record["world"],
            "participants": {
                c["names"][r]: m for r, m in record["participants"].items()
            },
            "operation_outcome": state["outcome"],
            "proposed": state["proposed"],
            "final_slot": state["requested"],
            "changed_constraint": c["event"],
            "proposal_was_revised": state["proposed"] != state["requested"],
        },
    }


def summarize(rows):
    pos = [r for r in rows if r["reveal"]["target_same_version"]]
    neg = [r for r in rows if not r["reveal"]["target_same_version"]]
    own = sum(r["reveal"]["correct"] for r in pos)
    other = sum(r["reveal"]["correct"] for r in neg)
    num = lambda x, y: x / y if y else None
    return {
        "n": len(rows),
        "scenarios": len({r["scenario"] for r in rows}),
        "positive": len(pos),
        "negative": len(neg),
        "correct_own": own,
        "correct_other": other,
        "invalid": sum(r["reveal"]["model_answer"] is None for r in rows),
        "correct": own + other,
        "own_rate": num(own, len(pos)),
        "rejection_rate": num(other, len(neg)),
        "balanced_accuracy": (own / len(pos) + other / len(neg)) / 2
        if pos and neg
        else None,
    }


def analyze(directory, require_complete, manifest_path=HERE / "scenarios.json"):
    manifest = json.loads(manifest_path.read_text())
    official = manifest == freeze()
    if manifest_path.resolve() == (HERE / "scenarios.json").resolve():
        assert official
    cases = {c["id"]: c for c in manifest}
    items = []
    states = []
    rounds = defaultdict(list)
    leaks = []
    for path in sorted(directory.glob("*/*/world-*.json")):
        rec = json.loads(path.read_text())
        c = cases[rec["case"]]
        w = rec["world"]
        valid = {q["id"] for q in c["quotes"]}
        assert (
            path.relative_to(directory).as_posix()
            == f"{c['split']}/{c['id']}/world-{w}.json"
        )
        assert w in (0, 1) and rec["participants"] == assignments(c, w)
        turns = rec["transcript"]
        assert [t["phase"] for t in turns] == (
            ["opening"] * 4
            + ["proposal"]
            + ["review"] * 3
            + ["final-offer"]
            + ["ratify"] * 3
        )
        for turn in turns:
            assert (
                turn["speaker"] == c["names"][turn["seat"]]
                and turn["role"] == ROLE_NAMES[turn["seat"]]
                and turn["text"].strip()
            )
            hits = LEAK.findall(turn["text"])
            if hits:
                leaks.append(
                    {"case": c["id"], "world": w, "seat": turn["seat"], "hits": hits}
                )
        for phase, roles in [
            ("opening", ROLES),
            ("proposal", ["carrier"]),
            ("review", APPROVERS),
            ("final-offer", ["carrier"]),
            ("ratify", APPROVERS),
        ]:
            assert {t["seat"] for t in turns if t["phase"] == phase} == set(roles)
        proposal = next(t for t in turns if t["phase"] == "proposal")
        final = next(t for t in turns if t["phase"] == "final-offer")
        state = rec["state"]
        first = action(proposal["text"], "PROPOSE", valid | {"NONE"})
        last = action(final["text"], "BOOK", valid | {"NONE"})
        assert (
            state["proposed"] == first
            and state["requested"] == last
            and state["feasible_after"] == possible(c, "after")
            and state["feasible_before"] == possible(c, "before")
        )
        assert state["requested_feasible"] == (last in state["feasible_after"])
        for phase, offer, field in [
            ("review", first, "initial_votes"),
            ("ratify", last, "final_votes"),
        ]:
            for t in [x for x in turns if x["phase"] == phase]:
                expected = (
                    "approve"
                    if offer in valid and action(t["text"], "APPROVE", valid) == offer
                    else "hold"
                    if offer and action(t["text"], "HOLD", valid | {"NONE"}) == offer
                    else "invalid"
                )
                assert state[field][t["seat"]] == expected
        booked = last in valid and all(
            x == "approve" for x in state["final_votes"].values()
        )
        outcome = (
            ("released" if last in state["feasible_after"] else "invalid-release")
            if booked
            else "not-released"
        )
        assert state["outcome"] == outcome
        states.append(
            {
                "case": c["id"],
                "split": c["split"],
                "world": w,
                "changed_role": c["event_role"],
                "outcome": outcome,
                "proposal_changed": (first != last),
                "new_constraint_invalidated_proposal": first in possible(c, "before")
                and first not in possible(c, "after"),
                "repaired_after_change": last in possible(c, "after")
                and first not in possible(c, "after"),
                "invalid_votes": sum(
                    a == "invalid"
                    for field in ["initial_votes", "final_votes"]
                    for a in state[field].values()
                ),
            }
        )
        for j in rec["judgments"]:
            ri = c["models"].index(j["reader"])
            assert (
                j["known"] == c["names"][c["anchor_roles"][ri]]
                and j["target"] == c["names"][c["target_role"]]
                and j["known"] != j["target"]
            )
            assert j["key"] == (
                "YES" if j["reader"] == rec["participants"][c["target_role"]] else "NO"
            )
            assert j["question"] == question(c, ri)
            label = re.fullmatch(
                r"\s*(?:\*\*)?(YES|NO)(?:\*\*)?[.!]?\s*",
                j["reply"].splitlines()[0],
                re.IGNORECASE,
            )
            assert j["answer"] == (label[1].upper() if label else None)
            item = public_view(c, rec, j)
            items.append(item)
            rounds[c["id"], j["reader"]].append(item)
    if not states:
        raise ValueError("No saved conversations in the selected input directory")
    if require_complete:
        assert (
            len(states) == 2 * len(manifest)
            and len(items) == 4 * len(manifest)
            and len({x["id"] for x in items}) == len(items)
        )
        assert len(rounds) == 2 * len(manifest) and all(
            sorted(x["reveal"]["key"] for x in rs) == ["NO", "YES"]
            for rs in rounds.values()
        )
        for pairing in (
            sorted({tuple(c["models"]) for c in manifest}) if official else []
        ):
            cs = [
                c
                for c in manifest
                if tuple(c["models"]) == pairing and c["split"] == "confirmation"
            ]
            assert (
                len(cs) == 8
                and set(Counter(c["target_role"] for c in cs).values()) == {2}
                and set(Counter(c["event_role"] for c in cs).values()) == {2}
            )
    cohorts = []
    for split in ("development", "confirmation"):
        rr = [r for r in items if r["split"] == split]
        for model in sorted({r["reader_model"] for r in rr}):
            sm = [r for r in rr if r["reader_model"] == model]
            for other in ["all"] + sorted({r["comparison_model"] for r in sm}):
                subset = [
                    r for r in sm if other == "all" or r["comparison_model"] == other
                ]
                scores = summarize(subset)
                complete = [
                    ps
                    for (case, m), ps in rounds.items()
                    if m == model
                    and len(ps) == 2
                    and cases[case]["split"] == split
                    and (other == "all" or ps[0]["comparison_model"] == other)
                ]
                scores["world_pairs"] = dict(
                    Counter(sum(p["reveal"]["correct"] for p in ps) for ps in complete)
                )
                cohorts.append(dict(split=split, reader=model, other=other, **scores))
    return sorted(items, key=lambda row: row["id"]), {
        "cohorts": cohorts,
        "coordination": states,
        "identity_flags": leaks,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manifest", type=Path, default=HERE / "scenarios.json")
    parser.add_argument("--input", type=Path, default=HERE / "runs")
    parser.add_argument("--allow-partial", action="store_true")
    parser.add_argument("--export", type=Path, default=HERE)
    args = parser.parse_args()
    rows, metrics = analyze(args.input, not args.allow_partial, args.manifest)
    save(args.export / "examples.json", rows)
    save(args.export / "metrics.json", metrics)
    print(
        f"{len(rows)} judgments, {len(metrics['coordination'])} conversations, {len(metrics['identity_flags'])} possible identity leaks"
    )
    for c in metrics["cohorts"]:
        print(
            c["split"],
            c["reader"],
            c["other"],
            c["correct_own"],
            c["positive"],
            c["correct_other"],
            c["negative"],
            c["balanced_accuracy"],
        )


if __name__ == "__main__":
    main()
