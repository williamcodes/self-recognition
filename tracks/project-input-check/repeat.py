"""Repeat prespecified project trials whose original reader reported an empty directory."""
import argparse
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import shutil
import sys

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
sys.path.insert(0, str(ROOT))
from tracks.core.provenance import object_hash
from tracks.core.runner import judge, subscription
from tracks.core.scoring import digest, key, parse, read, save, trial_id

ARCHIVE = ROOT / "tracks/core/release/projects"


def verify(results, manifest):
    if "screen_sha256" in manifest:
        assert manifest["screen_sha256"] == object_hash(read(HERE / "screen.json"))
    assert manifest["source_manifest_sha256"] == object_hash(read(ARCHIVE / "manifest.json"))
    inventory = read(ARCHIVE / "inventory.json")
    assert manifest["source_inventory_sha256"] == object_hash(inventory)
    works = {(w["brief"], w["writer"]): w["files"] for w in inventory}
    primary = ARCHIVE / "judgments.json"
    if primary.exists():
        originals = {trial_id(row): row for row in read(primary)}
    seen_threads = set()
    assert len(results) == len(manifest["trials"])
    for target, result in zip(manifest["trials"], results):
        subject = target["subject"]
        assert result["original_row_sha256"] == target["original_row_sha256"]
        if primary.exists():
            assert object_hash(originals[trial_id(subject)]) == target["original_row_sha256"]
        original_receipt = read(ARCHIVE / target["original_receipt"])
        row = result["repeat"]
        assert trial_id(row) == trial_id(subject)
        assert row["answer"] == parse(row["reply"], subject["mode"])
        receipt = result["attempts"][-1]
        assert receipt["status"] == "complete" and receipt["reply"] == row["reply"]
        assert original_receipt["prompt_sha256"] == receipt["prompt_sha256"]
        expected = {}
        for pos, writer in zip("AB", subject["authors"]):
            prefix = pos + "/" if subject["mode"] == "ab" else ""
            for name, fingerprint in works[subject["brief"], writer].items():
                assert digest(ARCHIVE / "works" / subject["brief"] / writer / name) == fingerprint
                expected[prefix + name] = fingerprint
        assert receipt["input_integrity"] == "matched"
        assert receipt["input_files_after"] == receipt["input_files"] == expected
        assert original_receipt["input_files"] == expected
        threads = set(receipt["thread_hashes"])
        assert threads and not threads.intersection(original_receipt["thread_hashes"]) and not threads.intersection(seen_threads)
        seen_threads.update(threads)
    return [(row["repeat"]["brief"], row["repeat"]["answer"], key(row["repeat"])) for row in results]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--private-state", type=Path, help="Use a new directory outside the repository for live calls.")
    parser.add_argument("--verify", action="store_true")
    parser.add_argument("--cohort", choices=["sol", "astra"], default="sol")
    parser.add_argument("--workers", type=int, default=1)
    args = parser.parse_args()
    prefix = "astra-" if args.cohort == "astra" else ""
    output = HERE / (prefix + "repeats.json")
    manifest = read(HERE / (prefix + "manifest.json"))
    if args.verify:
        print("Verified paired repeats:", verify(read(output), manifest))
        return
    if not args.private_state or args.private_state.resolve().is_relative_to(ROOT):
        parser.error("Live calls require --private-state outside the repository")
    state = args.private_state.resolve()
    state.mkdir(parents=True, exist_ok=True)
    (state / ".state").mkdir(exist_ok=True)
    if not (state / "works").exists():
        (state / "works").symlink_to(ARCHIVE / "works", target_is_directory=True)
    shutil.copyfile(ARCHIVE / "frozen-prompts.json", state / "frozen-prompts.json")
    with subscription() as env:
        def run_target(target):
            row = judge(target["subject"], state, read(ARCHIVE / "manifest.json"), env, reader_timeout_seconds=1800)
            receipts = sorted((state / row["session_receipt"]).parent.glob("*.json"))
            return dict(original_row_sha256=target["original_row_sha256"], repeat=row,
                        attempts=[read(path) for path in receipts])
        with ThreadPoolExecutor(max_workers=args.workers) as pool:
            results = list(pool.map(run_target, manifest["trials"]))
    verify(results, manifest)
    save(output, results)


if __name__ == "__main__":
    main()
