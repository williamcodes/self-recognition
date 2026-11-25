"""Run subscription-backed trials or verify and score an archive offline."""
import argparse
import json
from pathlib import Path
from .runner import present_trial, run
from .diagnostics import diagnostics
from .scoring import key, read, verify

def positive(s):
    value=int(s)
    if value<1:
        raise argparse.ArgumentTypeError("expected a positive integer")
    return value

def main():
    cli=argparse.ArgumentParser(description=__doc__)
    sub=cli.add_subparsers(dest="action",required=True)
    for action in ("verify","score","diagnostics"):
        sub.add_parser(action).add_argument("archive",type=Path)
    show=sub.add_parser("inspect",help="Reconstruct a saved trial in a new anonymous folder")
    show.add_argument("archive",type=Path)
    show.add_argument("destination",type=Path)
    show.add_argument("--trial",type=positive,default=1,help="1-based position in judgments.json")
    show.add_argument("--reveal",action="store_true")
    live=sub.add_parser("run")
    live.add_argument("archive",type=Path)
    live.add_argument("--track",choices=["inline","projects"],required=True)
    live.add_argument("--models",nargs="+",default=["gpt-6.2-astra","gpt-6.2-sol"])
    live.add_argument("--panel-archive",type=Path,help="Reuse a verified panel and its briefs. --models specifies new readers.")
    live.add_argument("--briefs",type=Path)
    live.add_argument("--limit",type=positive)
    live.add_argument("--workers",type=positive,default=2)
    live.add_argument("--writers-only",action="store_true")
    live.add_argument("--judge-reader", metavar="MODEL",
                      help="Advance one scheduled reader in a frozen archive. A full run assembles scores.")
    live.add_argument("--quarantined-readers-as-misses", action="store_true",
                      help="Retain quarantined reader trials as invalid misses and continue the schedule")
    args=cli.parse_args()
    if args.action=="run":
        run(args)
    elif args.action=="diagnostics":
        print(json.dumps(diagnostics(args.archive),indent=2))
    elif args.action=="inspect":
        verify(args.archive)
        rows=read(args.archive/"judgments.json")
        if args.trial>len(rows):
            cli.error("Trial number exceeds archive length")
        t=rows[args.trial-1]
        args.destination.mkdir(parents=True,exist_ok=False)
        print(present_trial(t,args.archive,read(args.archive/"manifest.json"),args.destination))
        if args.reveal:
            print(f"Correct answer: {key(t)}. Recorded reader answer: {t['answer']}")
    else:
        result=verify(args.archive)
        if args.action=="score":
            print(json.dumps(result,indent=2))
        else:
            print(f"Verified {args.archive} ({len(result)} readers)")
if __name__=="__main__":
    main()
