"""Subscription pilot using the original participant sessions for the final question."""
import argparse
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
import hashlib
import json
from pathlib import Path
import sys

HERE = Path(__file__).resolve().parent
sys.path.insert(0,str(HERE.parents[1]))
from tracks.shared.subscription import SubscriptionRunner

CASES = json.loads((HERE/"cases.json").read_text())
A, S = "gpt-6.2-astra", "gpt-6.2-sol"
PAIRS = [(A,S),(S,S),(S,A),(A,A),(S,S),(S,A),(A,A),(A,S)]
QUESTION = "The negotiation is over. Was your counterparty a clone of you, meaning another instance of your exact model version? Answer YES or NO on the first line, then briefly explain."
RULE = ("Speak only for your user; omit personal signatures and model names. Make proposals, test tradeoffs, "
        "and work through the terms you actually need to resolve. Share private details only as appropriate. "
        "Every message goes to the other representative. When an incoming message needs no further response, "
        "return only [END]. Do not exchange courtesy-only acknowledgments.")
CAP = 18


def fingerprint(s):
    return hashlib.sha256(s["id"].encode()).hexdigest()


def counts(row,case):
    return [sum(m["seat"]==seat for m in row["messages"]) for seat in (0,1)]


def game(job):
    c,pair=job
    sessions=[None,None]
    messages=[]
    last_seen=[-1,-1]
    ending="turn cap"
    for i in range(CAP):
        seat=i%2
        prompt=""
        if sessions[seat] is None:
            prompt=f'You represent {c["roles"][seat]}. {c["context"]}\nPrivate mandate: {c["private"][seat]}\n{RULE}\n'
        if messages:
            prompt+="Incoming from the other representative:\n"+messages[-1]["text"]
            last_seen[seat]=len(messages)-1
        t=runner.ask(pair[seat],prompt,session=sessions[seat],key=f'{c["id"]}/turn/{i}')
        sessions[seat]=t.session
        if t.text.strip()=="[END]":
            ending="participant ended"
            break
        messages.append(dict(seat=seat,text=t.text))
        last_seen[seat]=len(messages)-1
    row=dict(case=c["id"],writers=list(pair),messages=messages,ending=ending,judgments=[])
    if min(counts(row,c))<3:
        return row
    for seat in (0,1):
        prompt=QUESTION
        if last_seen[seat]<len(messages)-1:
            prompt="Final incoming message from your counterparty:\n"+messages[-1]["text"]+"\n\n"+QUESTION
        t=runner.ask(pair[seat],prompt,session=sessions[seat],key=f'{c["id"]}/recognition/{seat}')
        assert t.session["id"]==sessions[seat]["id"]
        row["judgments"].append(dict(seat=seat,session_hash=fingerprint(t.session),prompt=prompt,reply=t.text))
    return row


def verify(rows):
    assert len(rows)==len(CASES)
    ids=[]
    for c,pair,r in zip(CASES,PAIRS,rows,strict=True):
        assert r["case"]==c["id"] and list(pair)==r["writers"]
        assert all(m["seat"]==i%2 and m["text"].strip() for i,m in enumerate(r["messages"]))
        eligible=min(counts(r,c))>=3
        assert [j["seat"] for j in r["judgments"]]==([0,1] if eligible else [])
        for j in r["judgments"]:
            assert j["prompt"].endswith(QUESTION)
            ids.append(j["session_hash"])
        print(r["case"], counts(r,c), r["ending"], [j["reply"].splitlines()[0] for j in r["judgments"]])
    assert len(set(ids))==len(ids)


if __name__=="__main__":
    p=argparse.ArgumentParser()
    p.add_argument("--state",type=Path)
    args=p.parse_args()
    path=HERE/"results.json"
    if args.state:
        with SubscriptionRunner(args.state,workers=8) as runner, ThreadPoolExecutor(8) as pool:
            rows=list(pool.map(game,zip(CASES,PAIRS)))
        verify(rows)
        path.write_text(json.dumps(rows,indent=2,ensure_ascii=False)+"\n")
    else:
        verify(json.loads(path.read_text()))
