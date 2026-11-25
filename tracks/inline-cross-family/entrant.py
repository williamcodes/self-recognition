"""Judge one compatible subscription reader against the three frozen writers."""

import argparse
import random
import re
import shutil
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from run import (
    HERE,
    ROOT,
    MediumRunner,
    contract_prompt,
    digest,
    judge,
    parse,
    pin,
    prompt_contract,
    read,
    scores,
    sha,
    signature,
    tasks,
    verify,
    write,
)


def setup(reader, output):
    if not re.fullmatch(r"[a-z0-9][a-z0-9.-]+", reader):
        raise ValueError("Expected a subscription CLI model ID")
    if output.resolve().is_relative_to(HERE):
        raise ValueError("Choose a separate output directory")
    verify(HERE, False)
    source = read(HERE / "manifest.json")
    models = list(dict.fromkeys(source["models"] + [reader]))
    m = {
        **source,
        "models": models,
        "comparisons": [
            [reader, other] for other in source["models"] if other != reader
        ],
        "reader": reader,
        "source_manifest_sha256": digest(HERE / "manifest.json"),
        "source_inventory_sha256": digest(HERE / "inventory.json"),
    }
    spec = prompt_contract(m)
    pin(output / "manifest.json", m)
    pin(output / "frozen-prompts.json", spec)
    for w in read(HERE / "inventory.json"):
        rel = Path("works") / w["brief"] / w["writer"] / "document.txt"
        dst = output / rel
        dst.parent.mkdir(parents=True, exist_ok=True)
        if not dst.exists():
            shutil.copyfile(HERE / rel, dst)
        assert digest(dst) == w["files"]["document.txt"]
    return m, spec, reader not in source["models"]


def score_entrant(output, m, spec, new, export):
    reader = m["reader"]
    sessions = set()
    if new:
        for b in m["briefs"]:
            ident = b["id"]
            doc = output / "works" / ident / reader / "document.txt"
            w = read(output / "writer-receipts" / (ident + ".json"))
            assert w["model"] == reader and w["prompt_sha256"] == sha(
                spec["writers"][ident]
            )
            assert w["reply_sha256"] == sha(doc.read_text().removesuffix("\n"))
            assert w["session_sha256"] not in sessions
            sessions.add(w["session_sha256"])
    rows = []
    for t in tasks(m):
        r = read(output / "decisions" / (signature(t) + ".json"))
        assert all(r[k] == v for k, v in t.items()) and r["commands"] == []
        tr = r["receipt"]
        assert tr["model"] == reader and tr["prompt_sha256"] == sha(
            contract_prompt(spec, output, "reader", t)
        )
        assert tr["session_sha256"] not in sessions and tr["reply_sha256"] == sha(
            r["reply"]
        )
        assert parse(r["reply"], t["mode"]) == r["answer"]
        sessions.add(tr["session_sha256"])
        rows.append(r)
    inventory = [
        dict(
            brief=b["id"],
            writer=model,
            files={
                "document.txt": digest(
                    output / "works" / b["id"] / model / "document.txt"
                )
            },
        )
        for b in m["briefs"]
        for model in m["models"]
    ]
    for name, value in [
        ("inventory.json", inventory),
        ("judgments.json", rows),
        ("scores.json", scores(rows)),
    ]:
        if export:
            pin(output / name, value)
        else:
            assert read(output / name) == value
    print(
        f"{reader}: {len(rows)} judgments across {len(m['comparisons'])} comparison writers."
    )


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("reader")
    p.add_argument("--output", type=Path, required=True)
    p.add_argument("--logs", type=Path)
    p.add_argument("--workers", type=int, choices=(1, 2), default=2)
    p.add_argument("--verify", action="store_true")
    p.add_argument("--offline", action="store_true")
    a = p.parse_args()
    if not a.verify and (not a.logs or a.logs.resolve().is_relative_to(ROOT)):
        p.error("Choose a private external --logs directory")
    m, spec, new = setup(a.reader, a.output)
    if not a.verify:
        with (
            MediumRunner(
                a.logs, workers=a.workers, offline=a.offline, timeout=600
            ) as runner,
            ThreadPoolExecutor(a.workers) as pool,
        ):
            if new:
                list(
                    pool.map(
                        lambda b: write(a.output, runner, spec, b["id"], a.reader),
                        m["briefs"],
                    )
                )
            trials = tasks(m)
            random.Random(5209).shuffle(trials)
            list(pool.map(lambda t: judge(a.output, runner, spec, t), trials))
    score_entrant(a.output, m, spec, new, not a.verify)


if __name__ == "__main__":
    main()
