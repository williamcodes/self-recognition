"""Generate Astra/Qwen conversations using the existing negotiation and sign-off protocol."""
from concurrent.futures import ThreadPoolExecutor
from hashlib import sha256
import argparse
import json
from pathlib import Path
from urllib.request import Request, urlopen

import cross_family
import run
import signoff
from tracks.shared.subscription import Turn, _digest, _save

Q = "qwen2.5:7b"
DIGEST = "845dbda0ea48ed749caafd9e6037047aa19acfcfd82e704d7ca97d631a0b697e"
LOCAL = "http://127.0.0.1:11434/api/"
OUTPUT = run.HERE / "panel-writers.json"


class Writers(run.SubscriptionRunner):
    def ask(self, model, prompt, *, session=None, key):
        if model != Q:
            return super().ask(model, prompt, session=session, key=key)
        receipt = self.logs / (_digest(key) + ".json")
        fingerprint = _digest([model, DIGEST, prompt, session, key])
        if receipt.exists():
            data = json.loads(receipt.read_text())
            assert data["fingerprint"] == fingerprint
            return Turn(**data["turn"])
        if self.offline:
            raise ValueError("Missing local turn receipt")
        messages = list(session["messages"]) if session else []
        messages.append({"role":"user", "content":prompt})
        body = dict(model=Q, messages=messages, stream=False, options=dict(num_ctx=16384, seed=312))
        req = Request(LOCAL+"chat", data=json.dumps(body).encode(), headers={"Content-Type":"application/json"})
        with urlopen(req, timeout=900) as response:
            result = json.load(response)
        assert result["model"] == Q and result["done"] and result["done_reason"] == "stop"
        msg = result["message"]
        assert msg["role"] == "assistant" and msg["content"].strip()
        messages.append(msg)
        sid = session["id"] if session else sha256(str(receipt).encode()).hexdigest()
        new_session = dict(id=sid,messages=messages)
        turn = Turn(msg["content"].strip(), new_session, model)
        _save(receipt,dict(state="complete",model=model,fingerprint=fingerprint,turn=vars(turn)))
        return turn


def collect(state, offline=False):
    if not offline:
        with urlopen(LOCAL+"tags") as resp:
            assert any(m["name"]==Q and m["digest"]==DIGEST for m in json.load(resp)["models"])
    cases = {r["case"] for r in cross_family.panel() if r["writers"]==[run.A,run.A] and r["judgments"]}
    jobs = [(case,seat) for case in run.CASES if case["id"] in cases for seat in (0,1)]
    # Each seat has a separate receipt namespace. The sign-off helper reads from that same namespace.
    results = []
    for seat in (0,1):
        pair = (run.A,Q) if seat == 0 else (Q,run.A)
        with Writers(state/str(seat),offline=offline,timeout=420) as runner, ThreadPoolExecutor(5) as pool:
            run.runner = signoff.runner = runner
            def play(case):
                initial = run.game((case,pair))
                return signoff.finish((case,initial))
            results.extend(pool.map(play,[case for case,s in jobs if s==seat]))
    return results


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--state",type=Path,required=True)
    p.add_argument("--offline",action="store_true")
    args=p.parse_args()
    rows=collect(args.state,args.offline)
    if args.offline:
        assert rows==json.loads(OUTPUT.read_text())
    else:
        OUTPUT.write_text(json.dumps(rows,indent=2,ensure_ascii=False)+"\n")
