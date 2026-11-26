"""Swap only the Fable conversation for Qwen4 Max in each empty independent-judgment lineup."""
from concurrent.futures import ThreadPoolExecutor
from hashlib import sha256
import json
import argparse
from clone_count import A, CACHE, CASES, OUT, PEERS, SubscriptionRunner, inputs, answer
from independent_count import pairs, evaluate

PATH=OUT/"fable-swap.json"


def dialogue(row,seat):
    return "".join(f"\n{'YOUR SIDE' if m['seat']==seat else 'COUNTERPARTY'}: {m['text']}\n" for m in row["messages"])


def jobs():
    for old,(_,prompt) in zip(evaluate("verify"),pairs(),strict=True):
        if old["truth"]!="NONE":
            continue
        case=next(c for c in CASES if c["id"]==old["case"])
        seat=old["seat"]
        pool=inputs(case,seat,[*PEERS,"qwen"])
        texts={name:dialogue(row,seat) for name,row in pool.items()}
        assert prompt.count(texts["fable"])==1 and texts["qwen"] not in prompt
        changed=prompt.replace(texts["fable"],texts["qwen"])
        order={}
        for label in "ABCD":
            matches=[name for name,text in texts.items() if f"\nConversation {label}:\n{text}" in changed]
            assert len(matches)==1
            order[label]=matches[0]
        assert set(order.values())=={"qwen","glm","mistral","gemini"}
        assert {order[l] for l in answer(old)}=={"qwen"}
        yield dict(case=case["id"],seat=seat,order=order,truth="NONE",baseline_hash=old["prompt_hash"],
                   prompt_hash=sha256(changed.encode()).hexdigest()),changed


def evaluate_swap(mode):
    items=list(jobs())
    assert len(items)==7
    if mode in ("collect","audit"):
        with SubscriptionRunner(CACHE/"swap-fable",workers=7,offline=mode=="audit",timeout=420) as runner:
            def ask(item):
                row,prompt=item
                turn=runner.ask(A,prompt,key=row["prompt_hash"])
                return dict(**row,reply=turn.text),turn.session["id"]
            with ThreadPoolExecutor(7) as pool:
                received=list(pool.map(ask,items))
        assert len({sid for _,sid in received})==7
        results=[r for r,_ in received]
        if mode=="collect":
            PATH.write_text(json.dumps(results,indent=2,ensure_ascii=False)+"\n")
        else:
            assert results==json.loads(PATH.read_text())
    rows=json.loads(PATH.read_text())
    for r,(expected,_) in zip(rows,items,strict=True):
        assert all(r[k]==v for k,v in expected.items())
    return rows


if __name__=="__main__":
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument("mode",choices=["collect","verify","audit"])
    for r in evaluate_swap(p.parse_args().mode):
        print(r["case"],r["reply"].splitlines()[0],r["order"])
