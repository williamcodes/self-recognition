"""Freeze, run, and verify the quote normalization experiment on existing group boards."""
import argparse
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import random
import re
import sys

HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[1]
sys.path.insert(0,str(ROOT))
from tracks.group.run import board, save
from tracks.shared.subscription import SubscriptionRunner

MAP={"‘":"'","’":"'","“":'"',"”":'"'}
MODELS={"gpt-6.2-astra","claude-fable-5-2"}
def sha(text):
    return hashlib.sha256(text.encode()).hexdigest()

def inputs():
    cases=[]
    for path in sorted((ROOT/"tracks/group/runs/confirmation").glob("*/world-*.json")):
        r=json.loads(path.read_text())
        if set(r["participants"].values())!=MODELS:
            continue
        normalized=[dict(t,text=t["text"].translate(str.maketrans(MAP))) for t in r["transcript"]]
        for j in r["judgments"]:
            q=j["question"]+"\n\n"
            original=q+board(r["transcript"])
            prompt=q+board(normalized)
            frozen=dict(source=str(path.relative_to(ROOT)),source_sha256=hashlib.sha256(path.read_bytes()).hexdigest(),
                        case=r["case"],world=r["world"],reader=j["reader"],known=j["known"],target=j["target"],
                        original_prompt_sha256=sha(original),prompt_sha256=sha(prompt))
            cases.append((frozen,prompt,j))
    random.Random(35291).shuffle(cases)
    if len(cases)!=32 or len({f["case"] for f,_,_ in cases})!=8:
        raise ValueError("Unexpected population")
    return cases

def definition():
    return dict(protocol="social-typography-1",translation=MAP,scope="Only each board message body",
                baseline="Classify each seat from concatenated message texts by strictly more U+2019 than U+0027 (curly), strictly fewer (straight), otherwise tied. Predict YES when both seat classes agree, including tied/tied.",
                primary="A single new fresh-reader response per original judgment; grade the original first-line grammar; invalid is a miss. Report paired counts, own claims and other rejections by reader.",
                interpret="No unchanged-text rerun. Any before/after difference includes fresh-sampling variation.",
                cases=[f for f,_,_ in inputs()])

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument("action",choices=["freeze","run"])
    p.add_argument("--logs",type=Path)
    args=p.parse_args()
    out=HERE/"manifest.json"
    conf=definition()
    if args.action=="freeze":
        if out.exists(): raise ValueError("Manifest already frozen")
        save(out,dict(frozen_at=datetime.now(timezone.utc).isoformat(),**conf))
        return
    stored=json.loads(out.read_text())
    stored.pop("frozen_at")
    if stored!=conf: raise ValueError("Frozen inputs or rule changed")
    if not args.logs or args.logs.resolve().is_relative_to(ROOT):
        raise ValueError("Pass --logs outside the repository")
    with SubscriptionRunner(args.logs, workers=2,timeout=360) as runner:
        def run(case):
            row,prompt,_=case
            name=row["prompt_sha256"]
            turn=runner.ask(row["reader"],prompt,key="social-typography-1/"+name)
            match=re.fullmatch(r"\s*(?:\*\*)?(YES|NO)(?:\*\*)?[.!]?\s*",turn.text.splitlines()[0],re.I)
            result=dict(prompt_sha256=name,reader=row["reader"],reply=turn.text,answer=match[1].upper() if match else None,
                        session_sha256=sha(turn.session["id"]))
            path=HERE/"judgments"/(name+".json")
            if path.exists() and json.loads(path.read_text())!=result: raise ValueError("Different receipt for recorded judgment")
            save(path,result)
            print("Recorded",name[:12],row["reader"],flush=True)
        with ThreadPoolExecutor(2) as pool:
            list(pool.map(run,inputs()))
if __name__=="__main__":
    main()
