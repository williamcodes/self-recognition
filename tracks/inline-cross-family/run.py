"""Frozen eight-brief cross-family inline comparison on subscription CLIs."""

import argparse
import hashlib
import json
import random
import re
import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
sys.path.insert(0, str(ROOT))
from tracks.core.provenance import contract_prompt
from tracks.core.runner import prompt_contract
from tracks.core.scoring import (
    assignments,
    digest,
    key,
    parse,
    read,
    save,
    scores,
    trial_id,
)
from tracks.shared.subscription import SubscriptionRunner

CORE = ROOT / "tracks/core/release/inline"
FABLE = "claude-fable-5-2"


def sha(value):
    return hashlib.sha256(value.encode()).hexdigest()


def pin(path, value):
    if path.is_file() and read(path) != value:
        raise ValueError(f"Frozen data changed: {path}")
    if not path.is_file():
        save(path, value)


def freeze(root):
    source = read(CORE / "manifest.json")
    briefs = [
        b
        for short in (True, False)
        for b in [
            b for b in source["briefs"] if b["genre"].startswith("short") == short
        ][:4]
    ]
    models = source["models"] + [FABLE]
    comparisons = [[m, FABLE] for m in source["models"]] + [
        [FABLE, m] for m in source["models"]
    ]
    manifest = dict(
        protocol="inline-cross-family-v1",
        track="inline",
        briefs=briefs,
        models=models,
        comparisons=comparisons,
        reader_effort="medium",
        writer_effort="medium",
        selection="First four short and first four long briefs, in original inline manifest order",
    )
    root.mkdir(parents=True, exist_ok=True)
    pin(root / "manifest.json", manifest)
    spec = prompt_contract(manifest)
    pin(root / "frozen-prompts.json", spec)
    inventory = {(r["brief"], r["writer"]): r for r in read(CORE / "inventory.json")}
    frozen = []
    for brief in briefs:
        for m in source["models"]:
            ident = brief["id"]
            rel = Path("works") / ident / m / "document.txt"
            source_hash = inventory[ident, m]["files"]["document.txt"]
            assert digest(CORE / rel) == source_hash
            dst = root / rel
            dst.parent.mkdir(parents=True, exist_ok=True)
            if not dst.exists():
                dst.write_bytes((CORE / rel).read_bytes())
            assert digest(dst) == source_hash
            frozen.append(
                dict(
                    brief=ident,
                    writer=m,
                    path=(CORE / rel).relative_to(ROOT).as_posix(),
                    sha256=source_hash,
                )
            )
    pin(root / "source-documents.json", frozen)
    return manifest, spec


class MediumRunner(SubscriptionRunner):
    def _command(self, model, prompt, location, session):
        cmd, env = super()._command(model, prompt, location, session)
        if model.startswith("claude-"):
            assert cmd[cmd.index("--effort") + 1] == "low"
            cmd[cmd.index("--effort") + 1] = "medium"
        else:
            cmd[cmd.index('model_reasoning_effort="low"')] = (
                'model_reasoning_effort="medium"'
            )
        return cmd, env


def receipt(runner, model, prompt, token):
    result = runner.ask(model, prompt, key="cross-v1/" + token)
    assert result.model == model
    return result.text, dict(
        session_sha256=sha(result.session["id"]),
        prompt_sha256=sha(prompt),
        reply_sha256=sha(result.text),
        model=model,
    )


def write(root, runner, spec, ident, model=FABLE):
    prompt = spec["writers"][ident]
    writer_key = "write/" + ident if model == FABLE else f"write/{model}/{ident}"
    text, trace = receipt(runner, model, prompt, writer_key)
    doc = root / "works" / ident / model / "document.txt"
    doc.parent.mkdir(parents=True, exist_ok=True)
    encoded = (text + "\n").encode()
    if doc.exists() and doc.read_bytes() != encoded:
        raise ValueError(f"Changed document: {doc}")
    doc.write_bytes(encoded)
    pin(root / "writer-receipts" / (ident + ".json"), trace)


def tasks(manifest):
    return [
        t
        for t in assignments(manifest)
        if [t["reader"], t["opponent"]] in manifest["comparisons"]
    ]


def signature(t):
    return sha(json.dumps(trial_id(t), ensure_ascii=False))


def judge(root, runner, spec, t):
    prompt = contract_prompt(spec, root, "reader", t)
    text, trace = receipt(runner, t["reader"], prompt, "judge/" + signature(t))
    pin(
        root / "decisions" / (signature(t) + ".json"),
        dict(
            **t, answer=parse(text, t["mode"]), reply=text, commands=[], receipt=trace
        ),
    )


def document_audit(root, manifest):
    rows = []
    names = re.compile(
        r"\b(?:ChatGPT|GPT[- ]?6|Claude|Anthropic|OpenAI|Codex|Astra|Sol|Fable|language model)\b",
        re.I,
    )
    for b in manifest["briefs"]:
        lo, hi = (70, 150) if b["genre"].startswith("short") else (1200, 1800)
        for m in manifest["models"]:
            text = (root / "works" / b["id"] / m / "document.txt").read_text()
            count = len(text.split())
            rows.append(
                dict(
                    brief=b["id"],
                    model=m,
                    words=count,
                    target=[lo, hi],
                    within_target=lo <= count <= hi,
                    potential_identity_strings=sorted(set(names.findall(text))),
                )
            )
    return rows


def verify(root, export):
    manifest, spec = read(root / "manifest.json"), read(root / "frozen-prompts.json")
    assert manifest["track"] == "inline" and len(manifest["briefs"]) == 8
    assert manifest["comparisons"] == [[m, FABLE] for m in manifest["models"][:-1]] + [
        [FABLE, m] for m in manifest["models"][:-1]
    ]
    assert spec == prompt_contract(manifest)
    core_spec = read(CORE / "frozen-prompts.json")
    assert spec["document_delimiters"] == core_spec["document_delimiters"]
    assert all(
        spec["readers"][m] == core_spec["readers"][m] for m in manifest["models"][:-1]
    )
    assert all(w == core_spec["writers"][b] for b, w in spec["writers"].items())
    expected = []
    for short in (True, False):
        expected.extend(
            [
                b
                for b in read(CORE / "manifest.json")["briefs"]
                if b["genre"].startswith("short") == short
            ][:4]
        )
    assert manifest["briefs"] == expected
    original = read(root / "source-documents.json")
    assert {(r["brief"], r["writer"]) for r in original} == {
        (b["id"], m) for b in expected for m in manifest["models"][:-1]
    }
    held = {r["sha256"] for r in original}
    sessions = set()
    inventory = []
    for b in expected:
        ident = b["id"]
        for m in manifest["models"]:
            doc = root / "works" / ident / m / "document.txt"
            h = digest(doc)
            if m != FABLE:
                r = next(r for r in original if (r["brief"], r["writer"]) == (ident, m))
                rel = Path("works") / ident / m / "document.txt"
                assert (
                    r["path"] == (CORE / rel).relative_to(ROOT).as_posix()
                    and digest(CORE / rel) == r["sha256"] == h
                )
            else:
                w = read(root / "writer-receipts" / (ident + ".json"))
                assert w["model"] == m and w["prompt_sha256"] == sha(
                    spec["writers"][ident]
                )
                assert w["reply_sha256"] == sha(doc.read_text().removesuffix("\n"))
                sessions.add(w["session_sha256"])
            inventory.append(dict(brief=ident, writer=m, files={"document.txt": h}))
    ts = tasks(manifest)
    rows = []
    for t in ts:
        r = read(root / "decisions" / (signature(t) + ".json"))
        assert all(r[k] == v for k, v in t.items()) and r["commands"] == []
        assert r["answer"] == parse(r["reply"], r["mode"])
        tr = r["receipt"]
        assert tr["model"] == t["reader"] and tr["prompt_sha256"] == sha(
            contract_prompt(spec, root, "reader", t)
        )
        assert (
            tr["reply_sha256"] == sha(r["reply"])
            and tr["session_sha256"] not in sessions
        )
        sessions.add(tr["session_sha256"])
        rows.append(r)
    assert (
        len(ts) == 128
        and len(sessions) == 136
        and len(held) == 16
        and len(list((root / "decisions").glob("*.json"))) == 128
    )
    for name, value in [
        ("inventory.json", inventory),
        ("judgments.json", rows),
        ("scores.json", scores(rows)),
        ("document-audit.json", document_audit(root, manifest)),
    ]:
        if export:
            pin(root / name, value)
        else:
            assert read(root / name) == value
    for reader, other in manifest["comparisons"]:
        for mode in ("ab", "yn"):
            subset = [
                r
                for r in rows
                if (r["reader"], r["opponent"], r["mode"]) == (reader, other, mode)
            ]
            print(
                reader,
                other,
                mode,
                sum(r["answer"] == key(r) for r in subset),
                "/",
                len(subset),
            )


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument(
        "operation", choices=["freeze", "write", "run", "score", "verify", "inspect"]
    )
    p.add_argument("--root", type=Path, default=HERE)
    p.add_argument("--logs", type=Path)
    p.add_argument("--workers", type=int, default=2, choices=[1, 2])
    p.add_argument("--offline", action="store_true")
    p.add_argument("--trial", type=int, default=1)
    args = p.parse_args()
    root = args.root
    if args.operation in ("verify", "score"):
        return verify(root, args.operation == "score")
    if args.operation == "inspect":
        m = read(root / "manifest.json")
        ts = tasks(m)
        if not 1 <= args.trial <= len(ts):
            p.error("Unknown trial")
        print(
            contract_prompt(
                read(root / "frozen-prompts.json"), root, "reader", ts[args.trial - 1]
            ),
            end="",
        )
        return
    manifest, spec = freeze(root)
    if args.operation == "freeze":
        return
    if not args.logs or args.logs.resolve().is_relative_to(ROOT):
        p.error("--logs must be a private external directory")
    with (
        MediumRunner(
            args.logs, workers=args.workers, offline=args.offline, timeout=600
        ) as runner,
        ThreadPoolExecutor(args.workers) as pool,
    ):
        list(pool.map(lambda b: write(root, runner, spec, b["id"]), manifest["briefs"]))
        if args.operation == "write":
            return
        ts = tasks(manifest)
        random.Random(5209).shuffle(ts)
        for i, _ in enumerate(pool.map(lambda t: judge(root, runner, spec, t), ts), 1):
            if i % 16 == 0:
                print(f"{i}/{len(ts)}", flush=True)
    verify(root, True)


if __name__ == "__main__":
    main()
