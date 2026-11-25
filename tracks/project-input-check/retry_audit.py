"""Reconcile empty reports, trial retries and sensitivity with flagged rows excluded."""
import argparse
from collections import Counter, defaultdict
from datetime import datetime
from pathlib import Path
import sys

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parents[1]))
from tracks.core.scoring import read, save, scores

ARCHIVE = HERE.parent / "core/release/projects"


def compute():
    screen = read(HERE/"screen.json")
    flagged = {r["session_receipt"] for r in screen["flagged"]}
    ambiguous = {r["session_receipt"] for r in screen["ambiguous"]}
    rows = read(ARCHIVE/"judgments.json")
    runner_versions = defaultdict(Counter)
    prompts = set()
    retry_evidence = []
    for row in rows:
        path = ARCHIVE/row["session_receipt"]
        receipts = [read(p) for p in sorted(path.parent.glob("*.json"))]
        final = receipts[-1]
        runner = final["code_sha256"]["runner.py"]
        runner_versions[runner][row["reader"]] += 1
        prompts.add(final["prompt_contract_sha256"])
        if row["reader"].endswith("astra") and len(receipts) > 1:
            prior = receipts[-2]
            delta = datetime.fromisoformat(final["started_at"]) - datetime.fromisoformat(prior["updated_at"])
            retry_evidence.append(dict(receipt=row["session_receipt"], flagged=row["session_receipt"] in flagged,
                                       ambiguous=row["session_receipt"] in ambiguous, runner_sha256=runner,
                                       preceding_attempt_timeout=prior["timeout"], gap_seconds=delta.total_seconds(),
                                       final_input_inventory_matches_prior=final["input_files"] == prior["input_files"]))
    return dict(final_receipt_runner_versions=dict(runner_versions), prompt_contracts=sorted(prompts),
                astra_retried_subjects=retry_evidence, reported_empty_excluded=scores([r for r in rows if r["session_receipt"] not in flagged]))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--verify", action="store_true")
    args = parser.parse_args()
    report = compute()
    path = HERE/"retry-audit.json"
    if args.verify:
        if report != read(path):
            raise ValueError("Retry audit differs from archived receipts.")
    else:
        save(path, report)
    print("Verified retry receipts and exclusion sensitivity." if args.verify else "Saved retry audit.")
