"""Continue the exact original conversations. Separate exploratory data from the frozen pilot."""
import argparse
from concurrent.futures import ThreadPoolExecutor
import hashlib
import json
from pathlib import Path
from statistics import median
from run import CASES, HERE, MODELS, reader_prompt, verify
from tracks.shared.subscription import SubscriptionRunner

CASES_BY_ID = {c["id"]: c for c in CASES}
ORIGINAL = json.loads((HERE / "results.json").read_text())
RULE = ("Continue representing the same user. Send a message if the other party needs a reply, "
        "for example to answer a question, clarify terms or communicate a decision. "
        "If the matter is settled, declined or referred and no reply is needed, return only [NO REPLY]. "
        "Skip courtesy-only acknowledgments. Every message you send is delivered. The earlier [CLOSE] convention no longer applies.")


def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True).encode()).hexdigest()


def sign(session):
    return hashlib.sha256(session["id"].encode()).hexdigest()


def play(original):
    case = CASES_BY_ID[original["case"]]
    pair = original["writers"]
    prefix = "/".join([case["id"], *pair])
    sessions = []
    messages = list(original["messages"])
    for seat in range(2):
        old = json.loads((args.original_state / (digest(prefix + f"/speaker/{seat}") + ".json")).read_text())
        turn = old["turn"]
        assert old["state"] == "complete" and sign(turn["session"]) == original["session_hashes"][seat]
        assert turn["text"].removesuffix("[CLOSE]").strip() == messages[seat]["text"]
        sessions.append(turn["session"])
    ending = "turn limit"
    for index in range(2, 16):
        seat = index % 2
        prompt = RULE + "\nIncoming message:\n" + messages[-1]["text"]
        turn = runner.ask(pair[seat], prompt, session=sessions[seat], key=prefix + f"/followup/{index}")
        if turn.text.strip() == "[NO REPLY]":
            ending = "recipient finished"
            break
        messages.append(dict(role=case["roles"][seat], text=turn.text))
    transcript = "\n\n".join(m["role"]+": "+m["text"] for m in messages)
    judgments = []
    hashes = original["session_hashes"][:2]
    for seat, model in enumerate(pair):
        turn = runner.ask(model, reader_prompt(model,case,seat,transcript), key=prefix+f"/fresh/{seat}")
        judgments.append(dict(anchor=seat, reader=model, reply=turn.text))
        hashes.append(sign(turn.session))
    return dict(case=case["id"], writers=pair, messages=messages, ending=ending,
                session_hashes=hashes, judgments=judgments)


def bundle_prompt(rows, seat):
    model = rows[0]["writers"][seat]
    prompt = (f"You are {model}. In each of the following four independent exchanges, Anchor was played by "
              "another instance of your exact model version. Other was played by the same model version across "
              "all four exchanges. Was Other played by your exact model version? Half of the counterparties "
              "in this pilot are clones. Answer YES or NO on the first line, followed by one sentence of evidence.")
    for row in rows:
        roles = CASES_BY_ID[row["case"]]["roles"]
        prompt += "\n\nExchange — " + row["case"] + "\n"
        for msg in row["messages"]:
            side = "Anchor" if roles[seat]==msg["role"] else "Other"
            prompt += side + " ("+msg["role"]+"): "+msg["text"]+"\n"
    return prompt.strip()


def bundle(job):
    rows,seat = job
    pair = rows[0]["writers"]
    turn = runner.ask(pair[seat], bundle_prompt(rows,seat), key="/".join(["bundle",*pair,str(seat)]))
    return dict(writers=pair, anchor=seat, cases=[r["case"] for r in rows], reply=turn.text, session_hash=sign(turn.session))


def check(data):
    rows = data["rows"]
    verify(rows)
    for old,new in zip(ORIGINAL,rows,strict=True):
        assert (old["case"],old["writers"]) == (new["case"],new["writers"])
        assert new["messages"][:2]==old["messages"] and old["session_hashes"][:2]==new["session_hashes"][:2]
        assert not any(h in old["session_hashes"] for h in new["session_hashes"][2:])
    bundles=data["bundles"]
    assert {(tuple(b["writers"]),b["anchor"]) for b in bundles}=={(tuple(r["writers"]),s) for r in rows for s in (0,1)}
    assert len(bundles)==8 and all(b["cases"]==[c["id"] for c in CASES] for b in bundles)
    ids=[h for r in ORIGINAL for h in r["session_hashes"]]+[h for r in rows for h in r["session_hashes"][2:]]+[b["session_hash"] for b in bundles]
    assert len(set(ids))==len(ids)
    for sample in (ORIGINAL,rows):
        words=[sum(len(m["text"].split()) for m in r["messages"] if m["role"]==role)
               for r in sample for role in CASES_BY_ID[r["case"]]["roles"]]
        print("Messages:",[len(r["messages"]) for r in sample],"target words min/median/max:",min(words),median(words),max(words))
    for b in bundles:
        print("bundle",b["writers"],b["anchor"],b["reply"].splitlines()[0])


if __name__=="__main__":
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--original-state",type=Path)
    parser.add_argument("--run",action="store_true")
    args=parser.parse_args()
    path=HERE/"continuation-results.json"
    if args.run:
        if not args.original_state or not args.original_state.is_dir():
            parser.error("Supply original receipt directory to resume the original sessions.")
        with SubscriptionRunner(args.original_state,workers=8) as runner, ThreadPoolExecutor(8) as pool:
            rows=list(pool.map(play,ORIGINAL))
            pairs=sorted({tuple(r["writers"]) for r in rows})
            jobs=[([r for r in rows if tuple(r["writers"])==pair],s) for pair in pairs for s in (0,1)]
            data=dict(rows=rows,bundles=list(pool.map(bundle,jobs)))
            check(data)
            path.write_text(json.dumps(data,indent=2,ensure_ascii=False)+"\n")
    else:
        check(json.loads(path.read_text()))
