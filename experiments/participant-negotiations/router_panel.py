"""Collect independently checkpointed Astra/other-family negotiations for the scaling pilot."""
import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
import json
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import Request,urlopen

import run
import signoff
from tracks.shared.subscription import Turn,_digest,_save,_lock
from uuid import uuid4

HERE=run.HERE
OUT=HERE/"scaling"
BASE="https://openrouter.ai/api/v1/"
# Prices are maximum USD per million input/output tokens. The router must enforce them.
MODELS={
    "glm":("z-ai/glm-5.3",0.15,1.5),
    "mistral":("mistralai/mistral-large-4-0",0.7,2.1),
    "gemini":("google/gemini-4-carbon",2,10),
    "qwen":("qwen/qwen4-max",1.5,4.5),
    "deepseek":("deepseek/deepseek-v4-pro-0813",0.5,4.5),
    "grok":("x-ai/grok-4.7",2,6),
    "kimi":("moonshotai/kimi-k3.1-pro",0.8,9),
    "cohere":("cohere/command-a-plus",0.3,1.5),
    "llama":("meta-llama/llama-4-maverick",0.4,1.1),
    "nemotron":("nvidia/nemotron-3-ultra-550b-a55b",0.5,2.2),
    "hunyuan":("tencent/hy4",0.5,1.5),
    "mimo":("xiaomi/mimo-v2.6-pro",0.5,1),
    "step":("stepfun/step-5-preview",1,2.7),
    "nova":("amazon/nova-premier-v1",2.5,12.5),
    "minimax":("minimax/minimax-m3",0.3,1.2),
}
STATE=Path.home()/".cache/selfrec-or-scaling-v1"
CASES=[(c,s) for c in run.CASES if c["id"]!="water-ops" for s in (0,1)]
ORDER=[("museum-contract",0),("freight-security",1),("robot-drawings",0),("lab-editor",1),("sensor-trial",0),("archive-loan",1),("festival-cut",0)]
ORDER += [(case,1-seat) for case,seat in ORDER]


def call(path,key,body=None):
    req=Request(BASE+path,headers={"Authorization":"Bearer "+key,"Content-Type":"application/json"},data=json.dumps(body).encode() if body else None)
    try:
        with urlopen(req,timeout=480) as resp:
            return json.load(resp)
    except HTTPError as error:
        details=json.loads(error.read()).get("error",{})
        raise RuntimeError(f'OpenRouter {error.code}: {details.get("message","no message")}') from None


class Budget:
    def __init__(self,cap):
        self.cap=cap
        self.key=(HERE.parents[1]/".env").read_text().strip()
        self.spent=call("key",self.key)["data"]["usage"]

    def send(self,model,messages,prices,maximum):
        # UTF-8 bytes bound ordinary prompt tokens; reserve extra for chat framing.
        count=sum(len(m["content"].encode())+64 for m in messages)+256
        bound=(count*prices[0]+maximum*prices[1])/1e6
        token=uuid4().hex
        ledger=STATE/"reservations.json"
        lock=STATE/"reservations.lock"
        with _lock(lock):
            data=json.loads(ledger.read_text()) if ledger.exists() else {"total":self.spent,"open":{}}
            data["total"]=max(data["total"],self.spent)
            if data["total"]+sum(data["open"].values())+bound>self.cap:
                raise RuntimeError("OpenRouter cumulative budget reached")
            data["open"][token]=bound
            _save(ledger,data)
        body=dict(model=model,messages=messages,max_tokens=maximum,reasoning={"effort":"low"},
                  provider={"max_price":{"prompt":prices[0],"completion":prices[1]}})
        if maximum==4096:
            body["reasoning"]={"max_tokens":256}
        result=call("chat/completions",self.key,body)
        cost=result["usage"]["cost"]
        with _lock(lock):
            data=json.loads(ledger.read_text())
            data["total"]+=cost
            del data["open"][token]
            _save(ledger,data)
        if result["model"]!=model or cost>bound:
            raise ValueError(("unexpected model or cost",result["model"],model,cost,bound))
        return result,cost


class Runner(run.SubscriptionRunner):
    def ask(self,model,prompt,*,session=None,key):
        if model==run.A:
            return super().ask(model,prompt,session=session,key=key)
        p=self.logs/(_digest(key)+".json")
        fp=_digest([key,model,prompt,session])
        if p.exists():
            r=json.loads(p.read_text())
            assert r["fingerprint"]==fp
            return Turn(**r["turn"])
        messages=list(session["messages"]) if session else []
        messages.append(dict(role="user",content=prompt))
        for maximum in (2700,4096,8192,16384):
            attempt=p.with_suffix(f".{maximum}.attempt")
            if attempt.exists():
                row=json.loads(attempt.read_text())
            else:
                row,cost=self.budget.send(model,messages,self.prices,maximum)
                _save(attempt,row)
            choice=row["choices"][0]
            if choice["finish_reason"]=="stop":
                break
            if choice["finish_reason"]!="length":
                raise ValueError((model,choice["finish_reason"],row.get("provider")))
        else:
            raise ValueError((model,"writer length cap at 16384 tokens"))
        cost=sum(json.loads(f.read_text())["usage"]["cost"] for f in p.parent.glob(p.stem+".*.attempt"))
        text=choice["message"]["content"].strip()
        assert text, (model,"empty public content")
        messages.append(dict(role="assistant",content=text))
        turn=Turn(text,dict(id=session["id"] if session else row["id"],messages=messages), model)
        _save(p,dict(model=model,fingerprint=fp,state="complete",turn=vars(turn),cost=cost,provider=row.get("provider")))
        return turn


def play(job,budget):
    name,c,seat=job
    directory=OUT/name
    directory.mkdir(parents=True,exist_ok=True)
    dest=directory/f"{c['id']}-{seat}.json"
    if dest.exists():
        return
    model,*prices=MODELS[name]
    with Runner(STATE/name/c["id"]/str(seat),timeout=420) as runner:
        runner.budget=budget
        runner.prices=prices
        pair=(run.A,model) if seat==0 else (model,run.A)
        initial=run.game((c,pair),probe=False,provider=runner)
        row=signoff.finish((c,initial),probe=False,provider=runner)
        row["cost_usd"]=sum(json.loads(p.read_text()).get("cost",0) for p in runner.logs.glob("*.json"))
        _save(dest,row)
        print(name,c["id"],seat,run.counts(row,None),round(row["cost_usd"],5),flush=True)


if __name__=="__main__":
    p=argparse.ArgumentParser()
    p.add_argument("--cap",required=True,type=float,help="Absolute OpenRouter key usage ceiling in dollars")
    p.add_argument("--models",nargs="+",choices=MODELS,required=True)
    p.add_argument("--count",type=int,default=14)
    p.add_argument("--offset",type=int,default=0)
    p.add_argument("--workers",type=int,default=4)
    a=p.parse_args()
    jobs=[(n,c,seat) for case,seat in ORDER[a.offset:a.count] for n in a.models for c,s in CASES if (c["id"],s)==(case,seat)]
    budget=Budget(a.cap)
    with ThreadPoolExecutor(a.workers) as pool:
        futures=[pool.submit(play,j,budget) for j in jobs]
        errors=[]
        for f in as_completed(futures):
            try:f.result()
            except Exception as e:
                errors.append(str(e))
                print(jobs[futures.index(f)][0], jobs[futures.index(f)][1]["id"], type(e).__name__,str(e),flush=True)
        if errors:raise SystemExit(1)
