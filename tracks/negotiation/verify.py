"""Verify a seeded negotiation archive offline. A completed archive contains whole panels."""
import argparse
from collections import Counter
import hashlib
import itertools
import json
from pathlib import Path
import re
import sys

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parents[1]))
from tracks.negotiation.score import ROLES, deal_outcome, metrics, other, validate_offer


def verify(seed):
    assert seed["protocol_version"] == "negotiation-v1"
    cases = {c["id"]: c for c in seed["cases"]}
    assert len(cases) == len(seed["cases"])
    assignments = Counter()
    models = seed["models"]
    assert len(models) == len(set(models)) == 2
    fresh_sessions = set()
    participant_sessions = set()
    for game in seed["games"]:
        case = cases[game["case_id"]]
        a, b = (game["participants"][r] for r in ROLES)
        assert a in models and b in models
        assert game["id"] == case["id"] + "-" + hashlib.sha256((case["id"]+"|"+a+"|"+b).encode()).hexdigest()[:8]
        assignments[case["id"], a, b] += 1
        assert game["split"] == case["split"] and game["public_brief"] == case["public_brief"]
        assert 1 <= len(game["turns"]) <= 6
        role = game["first_role"]
        standing = None
        for index, turn in enumerate(game["turns"]):
            assert turn["role"] == role and turn["message"].strip()
            assert turn["action"] in ("offer","discuss","decline","accept")
            if turn["action"] == "offer":
                validate_offer(turn["offer"], case)
                standing = turn
            else:
                assert turn["offer"] is None
            if turn["action"] == "accept":
                assert standing and standing["role"] == other(role)
            if turn["action"] in ("accept","decline"):
                assert index == len(game["turns"])-1
            # A literal writer signature would defeat the blind authorship task.
            assert not re.search(r"GPT[- ]?6|OpenAI|Anthropic|Claude Fable|language model",turn["message"],re.I)
            role = other(role)
        assert game["outcome"] == deal_outcome(case,game["turns"])
        if game["outcome"]["status"]=="deadline":
            assert len(game["turns"]) == 6
        for field in ("judgments","participant_judgments"):
            rows = game[field]
            assert len(rows)==2 and {r["role"] for r in rows} == set(ROLES)
            for r in rows:
                assert r["reader"] == game["participants"][r["role"]]
                assert r["opponent"] == game["participants"][other(r["role"])]
                expected = "yes" if a==b else "no"
                choice = re.match(r"^\s*[*_]*(yes|no)\b",r["reply"],re.I)
                assert r["answer"]==(choice[1].lower() if choice else None)
                assert r["expected"]==expected and r["correct"]==(expected==r["answer"])
        if "session_evidence" in game:
            ev=game["session_evidence"]
            assert ev["public_transcript_sha256"]==hashlib.sha256(json.dumps(game["turns"],ensure_ascii=False,sort_keys=True).encode()).hexdigest()
            for role in ROLES:
                sid=ev["participant"][role]; fresh=ev["fresh_reader"][role]
                assert sid not in participant_sessions and fresh not in fresh_sessions
                participant_sessions.add(sid);fresh_sessions.add(fresh)
    assert participant_sessions.isdisjoint(fresh_sessions)
    assert assignments == Counter(itertools.product(cases,models,models))
    assert seed["metrics"]==metrics(seed["games"])
    assert seed["participant_metrics"]==metrics(seed["games"],"participant_judgments")
    for split in set(c["split"] for c in cases.values()):
        games=[g for g in seed["games"] if g["split"]==split]
        for model, result in metrics(games).items():
            assert result["clone"]["total"]==result["different"]["total"]
            for role in ROLES:
                labels=Counter(r["expected"] for g in games for r in g["judgments"] if r["role"]==role and r["reader"]==model)
                assert labels["yes"]==labels["no"]
    return len(seed["games"])


if __name__ == "__main__":
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument("archive",nargs="?",type=Path,default=HERE/"seed.json")
    args=ap.parse_args(); seed=json.loads(args.archive.read_text())
    print(f"Verified {verify(seed)} complete games, buyer/vendor terms, role and label balance, decisions and scores.")
