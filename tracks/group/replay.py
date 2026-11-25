"""Replay carrier choices on preselected boards with the changed evidence present or withheld."""

import argparse
import json
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from run import HERE, SubscriptionRunner, action, board, possible, private_card, save


def probe(c, rec, include, runner):
    changed = c["event_role"]
    messages = [
        t for t in rec["transcript"] if t["phase"] in {"opening", "proposal", "review"}
    ]
    if not include and changed != "carrier":
        messages = [
            t for t in messages if not (t["phase"] == "review" and t["seat"] == changed)
        ]
    update = (
        ("\n\nYour private live update: " + c["event"])
        if include and changed == "carrier"
        else ""
    )
    q = (
        f"You are {c['names']['carrier']}, the carrier dispatcher on today's shipment desk. Make the carrier's final booking request from this handoff.\n\n"
        f"Team brief: {c['public']}\n\nYour private information: {private_card(c, 'carrier')}\n\n"
        f"Current board:\n{board(messages)}{update}\n\nUse the team's messages. Keep or revise the tender. Name the slot you would request and the operational reason. "
        "End with [BOOK: V123] on a separate line using a real slot, or [BOOK: NONE] if you cannot request a service."
    )
    model = rec["participants"]["carrier"]
    turn = runner.ask(model, q, key=f"group-replay/v1/{c['id']}/0/{int(include)}")
    choice = action(turn.text, "BOOK", {q["id"] for q in c["quotes"]} | {"NONE"})
    return {
        "scenario": c["id"],
        "world": 0,
        "model": model,
        "updated_information_present": include,
        "observed_messages": len(messages),
        "choice": choice,
        "choice_feasible_after_update": choice in possible(c, "after"),
        "reply": turn.text,
    }


def verify(cases, records, rows):
    """Recompute arm identities and booking feasibility from the frozen world records."""
    expected = {(c["id"], include) for c in cases for include in (False, True)}
    observed = {(r["scenario"], r["updated_information_present"]) for r in rows}
    if len(rows) != len(expected) or observed != expected:
        raise ValueError("Incomplete or duplicated intervention arms")
    by_case = {c["id"]: c for c in cases}
    for row in rows:
        c = by_case[row["scenario"]]
        rec = records[c["id"]]
        include = row["updated_information_present"]
        sent = [
            t
            for t in rec["transcript"]
            if t["phase"] in {"opening", "proposal", "review"}
        ]
        expected_count = len(sent) - int(not include and c["event_role"] != "carrier")
        allowed = {q["id"] for q in c["quotes"]} | {"NONE"}
        choice = action(row["reply"], "BOOK", allowed)
        assert row["world"] == rec["world"] == 0
        assert row["model"] == rec["participants"]["carrier"]
        assert row["observed_messages"] == expected_count
        assert row["choice"] == choice
        assert row["choice_feasible_after_update"] == (choice in possible(c, "after"))
    arms = {(r["scenario"], r["updated_information_present"]): r for r in rows}
    repairs = sum(
        arms[(c["id"], True)]["choice_feasible_after_update"]
        and not arms[(c["id"], False)]["choice_feasible_after_update"]
        for c in cases
    )
    losses = sum(
        arms[(c["id"], False)]["choice_feasible_after_update"]
        and not arms[(c["id"], True)]["choice_feasible_after_update"]
        for c in cases
    )
    print(
        f"{len(cases)} paired replays verified, {repairs} gains and {losses} losses with the operational update"
    )


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--logs", type=Path)
    p.add_argument(
        "--verify", action="store_true", help="Verify saved intervention arms offline"
    )
    p.add_argument("--input", type=Path, default=HERE / "runs")
    p.add_argument("--output", type=Path, default=HERE / "replays.json")
    p.add_argument("--workers", type=int, default=3)
    p.add_argument(
        "--offline",
        action="store_true",
        help="Use completed local receipts without contacting any provider",
    )
    args = p.parse_args()
    if not args.verify and not args.logs:
        p.error("--logs is required to run new interventions")
    if args.logs and args.logs.resolve().is_relative_to(HERE.parent.parent):
        p.error("Private log directory required")
    cs = [
        c
        for c in json.loads((HERE / "scenarios.json").read_text())
        if c["split"] == "confirmation"
    ][:8]
    jobs = []
    records = {}
    for c in cs:
        rec = json.loads(
            (args.input / "confirmation" / c["id"] / "world-0.json").read_text()
        )
        records[c["id"]] = rec
        jobs.extend((c, rec, inc) for inc in (False, True))
    if args.verify:
        verify(cs, records, json.loads(args.output.read_text()))
        return
    with (
        SubscriptionRunner(
            args.logs, workers=args.workers, offline=args.offline
        ) as runner,
        ThreadPoolExecutor(args.workers) as pool,
    ):
        rs = list(pool.map(lambda x: probe(*x, runner), jobs))
    verify(cs, records, rs)
    save(args.output, rs)
    for inc in (False, True):
        arm = [r for r in rs if r["updated_information_present"] == inc]
        print(
            "Updated information",
            inc,
            "feasible choices",
            sum(r["choice_feasible_after_update"] for r in arm),
            "/",
            len(arm),
        )


if __name__ == "__main__":
    main()
