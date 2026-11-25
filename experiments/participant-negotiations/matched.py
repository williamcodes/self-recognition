"""Complete the missing three assignments per case; preserve the first batch and its original receipts."""
import argparse
from concurrent.futures import ThreadPoolExecutor
from itertools import product
import json
from pathlib import Path
import run
import signoff

OPTIONS=list(product((run.A,run.S), repeat=2))
SCHEDULES=[[OPTIONS[(OPTIONS.index(pair)+offset)%4] for pair in run.PAIRS] for offset in range(4)]


def write_or_check(path,rows,offline):
    if offline:
        assert rows==json.loads(path.read_text())
    else:
        temp=path.with_suffix(".partial")
        temp.write_text(json.dumps(rows,ensure_ascii=False,indent=2)+"\n")
        temp.replace(path)


def verify_panel(initial,final):
    expected={(c["id"],pair) for c in run.CASES for pair in OPTIONS}
    for dataset in initial,final:
        assert len(dataset)==len(expected)==32
        assert {(r["case"],tuple(r["writers"])) for r in dataset}==expected
    for before,after in zip(initial,final,strict=True):
        assert before["case"]==after["case"] and before["writers"]==after["writers"]
        assert after["messages"][:len(before["messages"])]==before["messages"]
        if before["judgments"]:
            assert before==after
        else:
            assert after["reopened_at"]==len(before["messages"])
        seats=[j["seat"] for j in after["judgments"]]
        assert seats==([0,1] if min(run.counts(after,None))>=3 else [])
        assert all(j["prompt"].endswith(run.QUESTION) for j in after["judgments"])
    ids=[j["session_hash"] for r in final for j in r["judgments"]]
    assert len(ids)==len(set(ids))


if __name__=="__main__":
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--state",type=Path,help="Base for new private receipt directories")
    parser.add_argument("--batch",type=int,choices=(1,2,3))
    parser.add_argument("--offline",action="store_true")
    args=parser.parse_args()
    if args.batch:
        if not args.state:
            parser.error("--batch requires --state")
        state=args.state/f"batch-{args.batch}"
        run.PAIRS=SCHEDULES[args.batch]
        with run.SubscriptionRunner(state,workers=6,offline=args.offline) as runner, ThreadPoolExecutor(6) as pool:
            run.runner=signoff.runner=runner
            initial=list(pool.map(run.game,zip(run.CASES,run.PAIRS)))
            run.verify(initial)
            write_or_check(run.HERE/f"initial-{args.batch}.json",initial,args.offline)
            final=list(pool.map(signoff.finish,zip(run.CASES,initial)))
            run.verify(final)
            write_or_check(run.HERE/f"final-{args.batch}.json",final,args.offline)
    else:
        read=lambda name: json.loads((run.HERE/name).read_text())
        initial=read("results.json")
        final=read("signoff-results.json")
        for n in range(1,4):
            initial+=read(f"initial-{n}.json")
            final+=read(f"final-{n}.json")
        verify_panel(initial,final)
        print(f"{len(final)} conversations, {sum(bool(r['judgments']) for r in final)} eligible")
