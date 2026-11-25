"""Check the archived prompts, delivery order and model replies against the private receipts."""
import argparse
import json
from run import CASES, HERE, PAIRS, QUESTION, RULE, fingerprint, verify
from tracks.shared.subscription import SubscriptionRunner

parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument("state")
args=parser.parse_args()
rows=json.loads((HERE/"results.json").read_text())
verify(rows)
seen=set()
with SubscriptionRunner(args.state,offline=True) as cached:
    for c,pair,r in zip(CASES,PAIRS,rows,strict=True):
        sessions=[None,None]
        msgs=r["messages"]
        turns=len(msgs)+(r["ending"]=="participant ended")
        for i in range(turns):
            s=i%2
            prompt=""
            if sessions[s] is None:
                prompt=f'You represent {c["roles"][s]}. {c["context"]}\nPrivate mandate: {c["private"][s]}\n{RULE}\n'
            if i:
                prompt+="Incoming from the other representative:\n"+msgs[i-1]["text"]
            t=cached.ask(pair[s],prompt,session=sessions[s],key=f'{c["id"]}/turn/{i}')
            sessions[s]=t.session
            assert t.text==(msgs[i]["text"] if i<len(msgs) else "[END]")
        for s,j in enumerate(r["judgments"]):
            # After an END the sender of the preceding public message already knows
            # that message; the other participant saw it immediately before END.
            last_incoming=(r["ending"]=="turn cap" and s!=msgs[-1]["seat"])
            expected=("Final incoming message from your counterparty:\n"+msgs[-1]["text"]+"\n\n" if last_incoming else "")+QUESTION
            assert expected==j["prompt"]
            t=cached.ask(pair[s],expected,session=sessions[s],key=f'{c["id"]}/recognition/{s}')
            assert t.text==j["reply"] and fingerprint(t.session)==fingerprint(sessions[s])==j["session_hash"]
        for session in sessions:
            if session:
                h=fingerprint(session)
                assert h not in seen
                seen.add(h)
print("All delivered messages and post-negotiation questions replayed from their original subscription receipts.")
