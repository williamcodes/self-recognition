"""Replay the public negotiations and recognition answers against private on-machine receipts."""
import json
from pathlib import Path
import run
import signoff
from router_panel import OUT,STATE,MODELS,Runner
from scaling_reader import jobs
from tracks.shared.subscription import _digest


def verify():
    total=0
    for path in sorted(OUT.glob("*/*.json")):
        row=json.loads(path.read_text())
        name=path.parent.name
        model, *_=MODELS[name]
        seat=row["writers"].index(run.A)
        assert row["writers"][1-seat]==model
        state=STATE/name/row["case"]/str(seat)
        if "replacement_reason" in row:state=state/"text-only-repeat"
        c=next(c for c in run.CASES if c["id"]==row["case"])
        with Runner(state,offline=True) as provider:
            initial=run.game((c,row["writers"]),probe=False,provider=provider)
            replay=signoff.finish((c,initial),probe=False,provider=provider)
        assert all(row[key]==v for key,v in replay.items()),path
        total+=1
    print(total,"writer conversations replayed")
    total=0
    for path in OUT.glob("judgments-*.json"):
        names=path.stem.split("-")[1:]
        for row,(expected,prompt) in zip(json.loads(path.read_text()),jobs(names),strict=True):
            key=expected["sha256"]
            receipt=json.loads((Path.home()/".cache/selfrec-scale-readers-v1"/(_digest(key)+".json")).read_text())
            assert receipt["fingerprint"]==_digest([run.A,prompt,None,None,key])
            assert receipt["state"]=="complete" and receipt["turn"]["text"]==row["reply"]
            total+=1
    print(total,"fresh reader judgments replayed")


if __name__=="__main__":
    verify()
