"""Verify the paired records and compute key-blind seat-typography predictions offline."""
from collections import Counter, defaultdict
import json
from pathlib import Path
import re
import sys

from run import HERE, ROOT, MAP, board, definition, inputs, save, sha


def seat_prediction(messages,known,target):
    """No model IDs, author identities, case keys or reader responses enter this rule."""
    def profile(seat):
        body="".join(text for speaker,text in messages if speaker==seat)
        if not body:
            raise ValueError("Missing seat evidence")
        d=body.count("’")-body.count("'")
        return (d>0)-(d<0)
    return "YES" if profile(known)==profile(target) else "NO"


def tally(rows,answer):
    own=[r for r in rows if r["key"]=="YES"]
    other=[r for r in rows if r["key"]=="NO"]
    claimed=sum(r[answer]=="YES" for r in own)
    rejected=sum(r[answer]=="NO" for r in other)
    return dict(correct=claimed+rejected,n=len(rows),own_claimed=claimed,own=len(own),
                other_rejected=rejected,others=len(other),balanced_accuracy=(claimed/len(own)+rejected/len(other))/2)


def negotiations():
    unique=set()
    cases=set()
    parts={}
    items=[]
    for name in ("seed","cross-family"):
        games=json.loads((ROOT/f"tracks/negotiation/{name}.json").read_text())["games"]
        by=defaultdict(list)
        for g in games:
            messages=[(t["role"],t["message"]) for t in g["turns"]]
            unique.add((g["case_id"],tuple(messages)))
            cases.add(g["case_id"])
            for j in g["judgments"]:
                known=j["role"]
                target="seller" if known=="buyer" else "buyer"
                predicted=seat_prediction(messages,known,target)
                observation=dict(panel=name,split=g["split"],reader=j["reader"],known=known,target=target,
                                 game=g["id"],case=g["case_id"],baseline=predicted,key=j["expected"].upper())
                by[g["split"],j["reader"]].append(observation)
                items.append(observation)
        parts[name]={split:{model:tally(by[split,model],"baseline") for s,model in sorted(by) if s==split}
                     for split in sorted({s for s,_ in by})}
    return dict(panels=parts,distinct_games=len(unique),distinct_scenarios=len(cases),items=items)


def group():
    manifest=json.loads((HERE/"manifest.json").read_text())
    stamp=manifest.pop("frozen_at")
    if manifest!=definition(): raise ValueError("Population or frozen rule changed")
    rows=[]
    sessions=set()
    unique_text=Counter()
    source_receipts={v["key"]:v for v in json.loads((ROOT/"tracks/group/provenance.json").read_text())}
    source_sessions={v["session_fingerprint"] for v in source_receipts.values()}
    for config,prompt,j in inputs():
        r=json.loads((ROOT/config["source"]).read_text())
        original_key=f"group/{r['version']}/{r['case']}/{r['world']}/fresh-reader/{j['reader']}"
        original_prompt=j["question"]+"\n\n"+board(r["transcript"])
        request=sha(json.dumps([j["reader"],original_prompt,None,None,original_key],sort_keys=True))
        if source_receipts[original_key]["request_fingerprint"]!=request:
            raise ValueError("Original prompt differs from original published request fingerprint")
        messages=[(t["speaker"],t["text"]) for t in r["transcript"]]
        normalized=[(k,t.translate(str.maketrans(MAP))) for k,t in messages]
        original_baseline=seat_prediction(messages,config["known"],config["target"])
        normalized_baseline=seat_prediction(normalized,config["known"],config["target"])
        if config["reader"]=="gpt-6.2-astra":
            unique_text.update({c:sum(t.count(c) for _,t in messages) for c in MAP})
        path=HERE/"judgments"/(sha(prompt)+".json")
        v=json.loads(path.read_text())
        first=v["reply"].splitlines()[0]
        match=re.fullmatch(r"\s*(?:\*\*)?(YES|NO)(?:\*\*)?[.!]?\s*",first,re.I)
        label=match[1].upper() if match else None
        if (v["answer"]!=label or v["reader"]!=config["reader"] or sha(prompt)!=v["prompt_sha256"]
                or v["session_sha256"] in sessions|source_sessions):
            raise ValueError("Invalid replay or reused session")
        sessions.add(v["session_sha256"])
        rows.append(dict(case=config["case"],world=config["world"],reader=config["reader"],key=j["key"],original=j["answer"],
                         normalized=v["answer"],baseline=original_baseline,normalized_baseline=normalized_baseline,
                         prompt_sha256=sha(prompt)))
    if set(p.stem for p in (HERE/"judgments").glob("*.json"))!={r["prompt_sha256"] for r in rows}:
        raise ValueError("Unexpected reply files")
    by={}
    for reader in sorted(set(r["reader"] for r in rows)):
        sub=[r for r in rows if r["reader"]==reader]
        pairs=Counter(("correct" if r["original"]==r["key"] else "miss")+"_to_"+
                      ("correct" if r["normalized"]==r["key"] else "miss") for r in sub)
        by[reader]=dict(**{k:tally(sub,k) for k in ("original","normalized","baseline","normalized_baseline")},
                        transitions=dict(sorted(pairs.items())))
    return dict(frozen_at=stamp,n_scenarios=8,n_boards=16,n_judgments=len(rows),changed_codepoints=dict(unique_text),
                readers=by,items=rows)


if __name__=="__main__":
    result=dict(group=group(),negotiation=negotiations())
    path=HERE/"results.json"
    if sys.argv[1:]==["--verify"]:
        if json.loads(path.read_text())!=result: raise ValueError("Published results differ")
        print("Verified original comparisons, 32 fresh judgments, score transitions and seat-only baselines.")
    else:
        save(path,result)
