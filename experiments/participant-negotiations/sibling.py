"""Verify the position-balanced Astra/Sol control against the original A/B prompt."""
from hashlib import sha256
import json
import ab
from cross_family import sibling_rows
from run import A,S,HERE

def verify():
    rows={(r["case"],*r["writers"]):r for r in sibling_rows()}
    # The original reader instructions and Astra-clone transcripts are identical.
    source={(r["case"],r["seat"],r["correct"]):p for r,p in ab.trials() if r["reader"]==A}
    for record in json.loads((HERE/"choices-sol.json").read_text()):
        case,seat,order=record["case"],record["seat"],record["order"]
        correct="A" if order[0]==A else "B"
        assert sorted(order)==sorted([A,S])
        prompt=source[case,seat,correct].split("\nConversation A:\n",1)[0]
        for label,m in zip("AB",order):
            pair=(A,m) if seat==0 else (m,A)
            prompt+=f"\nConversation {label}:\n"
            for turn in rows[case,*pair]["messages"]:
                speaker="YOUR SIDE" if seat==turn["seat"] else "COUNTERPARTY"
                prompt+=f"\n{speaker}: {turn['text']}\n"
        assert sha256(prompt.encode()).hexdigest()==record["sha256"]

if __name__=="__main__":
    verify()
