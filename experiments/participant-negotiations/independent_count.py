"""Paired rerun with independent judgment instructions added to the zero-to-four prompt."""
import argparse
from concurrent.futures import ThreadPoolExecutor
from hashlib import sha256
import json

from clone_count import A, CACHE, OUT, SubscriptionRunner, score, trials

INSTRUCTION = "Judge each counterparty independently. Being the closest match in the lineup is insufficient evidence by itself."
PATH = OUT / "independent.json"


def pairs():
    original = {r["prompt_hash"]: r for r in json.loads((OUT / "judgments.json").read_text())}
    for record, prompt in trials():
        if record["condition"] != "zero":
            continue
        baseline = original[record["prompt_hash"]]
        assert all(baseline[k] == v for k, v in record.items())
        start = prompt.index("Which counterparties were clones of you?")
        changed = prompt[:start] + INSTRUCTION + " " + prompt[start:]
        yield baseline, changed


def evaluate(action):
    items = list(pairs())
    assert len(items) == 35
    if action in ("collect", "audit"):
        with SubscriptionRunner(CACHE/"independent", workers=10, timeout=420, offline=action=="audit") as runner:
            def ask(item):
                old, prompt = item
                key = sha256(prompt.encode()).hexdigest()
                turn = runner.ask(A, prompt, key=key)
                return {**old, "condition":"independent", "baseline_hash":old["prompt_hash"],
                        "prompt_hash":key,"reply":turn.text}, turn.session["id"]
            with ThreadPoolExecutor(10) as pool:
                records = list(pool.map(ask, items))
        assert len({session for _,session in records}) == 35
        rows = [r for r,_ in records]
        if action == "collect":
            PATH.write_text(json.dumps(rows,ensure_ascii=False,indent=2)+"\n")
        else:
            assert rows == json.loads(PATH.read_text())
    rows = json.loads(PATH.read_text())
    for r,(old,prompt) in zip(rows, items, strict=True):
        assert all(r[k]==old[k] for k in ("case","seat","truth","transcript_hash"))
        assert r["baseline_hash"]==old["prompt_hash"] and r["prompt_hash"]==sha256(prompt.encode()).hexdigest()
    return rows


if __name__ == "__main__":
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("action",choices=("collect","audit","verify"))
    rows=evaluate(parser.parse_args().action)
    for subset in (rows,[r for r in rows if r["truth"]=="NONE"],[r for r in rows if r["truth"]!="NONE"]):
        print(score(subset))
