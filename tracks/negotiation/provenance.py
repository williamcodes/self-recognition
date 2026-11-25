"""Attach verified, anonymized session receipts to a completed negotiation archive."""
import argparse
import hashlib
import json
from pathlib import Path


def seal(seed, state):
    def receipt(key):
        digest = hashlib.sha256(json.dumps(key, sort_keys=True).encode()).hexdigest()
        item = json.loads((state / "receipts" / (digest + ".json")).read_text())
        assert item["key"]==key and item["state"]=="complete"
        return item

    def mask(sid):
        return hashlib.sha256(sid.encode()).hexdigest()

    recovery_file = state / "transport-recoveries" / "notes.json"
    recoveries = json.loads(recovery_file.read_text()) if recovery_file.exists() else []
    for g in seed["games"]:
        recorded = {}
        for i,t in enumerate(g["turns"],1):
            key=f"{g['id']}/move/{i}"
            raw=receipt(key);session_id=raw["turn"]["session"]["id"]
            if t["role"] in recorded:assert raw["prior"]["id"]==recorded[t["role"]]
            else:assert raw["prior"] is None
            recorded[t["role"]]=session_id
            if any(r["number"]==i for r in g["repairs"]):
                repair=receipt(key+"/repair");assert repair["prior"]["id"]==session_id
        fresh_ids={}
        for r in g["judgments"]:
            data=receipt(f"{g['id']}/fresh/{r['role']}")
            assert data["prior"] is None and data["turn"]["text"]==r["reply"]
            fresh_ids[r["role"]]=data["turn"]["session"]["id"]
        late="seller" if g["turns"][-1]["role"]=="buyer" else "buyer"
        notify=receipt(f"{g['id']}/receipt")
        if late in recorded:
            assert notify["prior"]["id"]==recorded[late]
        recorded[late]=notify["turn"]["session"]["id"]
        for r in g["participant_judgments"]:
            data=receipt(f"{g['id']}/participant/{r['role']}")
            assert data["prior"]["id"]==data["turn"]["session"]["id"]==recorded[r["role"]]
            assert data["turn"]["text"]==r["reply"]
        assert len(set(recorded.values())|set(fresh_ids.values()))==4
        g["session_evidence"]=dict(
            technical_recoveries=[r for r in recoveries if r["key"].startswith(g["id"]+"/")],
            participant={k:mask(v) for k,v in recorded.items()},
            fresh_reader={k:mask(v) for k,v in fresh_ids.items()},
            public_transcript_sha256=hashlib.sha256(json.dumps(g["turns"],sort_keys=True,ensure_ascii=False).encode()).hexdigest())
    return seed


if __name__=="__main__":
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument("archive",type=Path);ap.add_argument("--state",type=Path,required=True)
    a=ap.parse_args(); result=seal(json.loads(a.archive.read_text()),a.state)
    a.archive.write_text(json.dumps(result,indent=2,ensure_ascii=False)+"\n")
