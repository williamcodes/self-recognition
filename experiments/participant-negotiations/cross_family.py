"""Matched Astra/Fable panel. Reuse the exact Astra clone controls from the sibling panel."""
import argparse
from concurrent.futures import ThreadPoolExecutor
from itertools import product
import json
import run
import signoff
from matched import write_or_check

F="claude-fable-5-2"
NEW=[(run.A,F),(F,run.A),(F,F)]


def read(name):
    return json.loads((run.HERE/name).read_text())


def sibling_rows():
    return read("signoff-results.json")+[r for n in (1,2,3) for r in read(f"final-{n}.json")]


def panel():
    controls=[r for r in sibling_rows() if r["writers"]==[run.A,run.A]]
    return controls+[r for n in range(3) for r in read(f"family-final-{n}.json")]


def check(rows):
    expected={(c["id"],p) for c in run.CASES for p in product((run.A,F),repeat=2)}
    assert len(rows)==32 and {(r["case"],tuple(r["writers"])) for r in rows}==expected
    hs=[]
    for r in rows:
        assert all(m["seat"]==i%2 and m["text"].strip() for i,m in enumerate(r["messages"]))
        eligible=min(run.counts(r,None))>=3
        assert [j["seat"] for j in r["judgments"]]==([0,1] if eligible else [])
        assert all(j["prompt"].endswith(run.QUESTION) for j in r["judgments"])
        hs.extend(j["session_hash"] for j in r["judgments"])
    assert len(set(hs))==len(hs)


if __name__=="__main__":
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument("--state",type=run.Path)
    p.add_argument("--batch",type=int,choices=range(3))
    p.add_argument("--offline",action="store_true")
    args=p.parse_args()
    if args.batch is None:
        check(panel())
    else:
        if not args.state:
            p.error("Private subscription receipt --state required")
        n=args.batch
        # Rotate the three assignments so every batch exercises all seat combinations.
        run.PAIRS=[NEW[(i+n)%3] for i,_ in enumerate(run.CASES)]
        with run.SubscriptionRunner(args.state/f"batch-{n}",workers=4,timeout=420,offline=args.offline) as runner, ThreadPoolExecutor(4) as pool:
            run.runner=signoff.runner=runner
            initial=list(pool.map(run.game,zip(run.CASES,run.PAIRS)))
            run.verify(initial)
            write_or_check(run.HERE/f"family-initial-{n}.json",initial,args.offline)
            final=list(pool.map(signoff.finish,zip(run.CASES,initial)))
            run.verify(final)
            write_or_check(run.HERE/f"family-final-{n}.json",final,args.offline)
