"""One sign-off follow-up for short, previously unjudged threads, using their original sessions."""
import argparse
from concurrent.futures import ThreadPoolExecutor
import json
from pathlib import Path
from run import HERE, CASES, QUESTION, RULE, SubscriptionRunner, counts, fingerprint, verify

updates=json.loads((HERE/"signoff.json").read_text())


def finish(job, *, probe=True, provider=None):
    active = provider if provider is not None else runner
    c,old=job
    if old["judgments"] or min(counts(old,c))>=3:
        return old
    assert old["ending"]=="participant ended"
    row={**old,"messages":list(old["messages"]),"judgments":[],"reopened_at":len(old["messages"])}
    pair=row["writers"]
    sessions=[]
    for s in range(2):
        i=max(i for i in range(len(old["messages"])+1) if i%2==s)
        key=f'{c["id"]}/turn/{i}'
        from tracks.shared.subscription import _digest
        receipt=json.loads((active.logs/(_digest(key)+".json")).read_text())
        assert receipt["state"]=="complete" and receipt["model"]==pair[s]
        sessions.append(receipt["turn"]["session"])
    phase_seen=set()
    last_seen=[len(old["messages"])-1]*2
    row["ending"]="turn cap"
    for step in range(12):
        s=(len(old["messages"])+step)%2
        prompt=""
        if s not in phase_seen:
            prompt="Your user has returned during sign-off on the same negotiation. Private update: "+updates[c["id"]][s]+"\n"+RULE+"\n"
            phase_seen.add(s)
        if step:
            prompt+="Incoming from the other representative:\n"+row["messages"][-1]["text"]
            last_seen[s]=len(row["messages"])-1
        t=active.ask(pair[s],prompt,session=sessions[s],key=f'{c["id"]}/signoff/{step}')
        if t.text.strip()=="[END]":
            row["ending"]="participant ended"
            break
        row["messages"].append(dict(seat=s,text=t.text))
        last_seen[s]=len(row["messages"])-1
    if probe and min(counts(row,c))>=3:
        for s in range(2):
            prompt=QUESTION
            if last_seen[s]<len(row["messages"])-1:
                prompt="Final incoming message from your counterparty:\n"+row["messages"][-1]["text"]+"\n\n"+QUESTION
            t=active.ask(pair[s],prompt,session=sessions[s],key=f'{c["id"]}/signoff-recognition/{s}')
            assert t.session["id"]==sessions[s]["id"]
            row["judgments"].append(dict(seat=s,session_hash=fingerprint(t.session),prompt=prompt,reply=t.text))
    return row


if __name__=="__main__":
    p=argparse.ArgumentParser()
    p.add_argument("--state",required=True,type=Path)
    p.add_argument("--offline",action="store_true")
    args=p.parse_args()
    old=json.loads((HERE/"results.json").read_text())
    with SubscriptionRunner(args.state,workers=8,offline=args.offline) as runner, ThreadPoolExecutor(8) as pool:
        rows=list(pool.map(finish,zip(CASES,old)))
    verify(rows)
    path=HERE/"signoff-results.json"
    if args.offline:
        assert rows==json.loads(path.read_text())
    else:
        path.write_text(json.dumps(rows,ensure_ascii=False,indent=2)+"\n")
