"""Summarize paired transcript judgments and simulated agreements from a verified seed."""
import argparse
from collections import Counter
import json
from pathlib import Path
import random
import statistics
import sys

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parents[1]))
from tracks.negotiation.score import metrics, value


def analyze(seed):
    cases = {case["id"]:case for case in seed["cases"]}
    result = {}
    for label in ("all","development","confirmation"):
        games = [g for g in seed["games"] if label=="all" or g["split"]==label]
        if not games:
            continue
        dealt=[g for g in games if g["outcome"]["status"]=="agreement"]
        efficiencies=[]
        for g in dealt:
            case=cases[g["case_id"]]
            optimum=max(value(case,"buyer",terms)-value(case,"seller",terms)
                        for timing in case["options"]["schedule"] for service in case["options"]["service"]
                        for terms in [dict(schedule=timing, service=service)])
            efficiencies.append(sum(g["outcome"]["payoff"].values())/optimum)
        part = dict(games=len(games),distinct_cases=len({g["case_id"] for g in games}),
                    statuses=dict(Counter(g["outcome"]["status"] for g in games)),
                    turns=sum(len(g["turns"]) for g in games),
                    median_turns=statistics.median(len(g["turns"]) for g in games),
                    repairs=sum(len(g["repairs"]) for g in games),
                    agreements_with_nonnegative_payoffs=sum(g["outcome"]["individually_rational"] for g in dealt),
                    median_efficiency_conditional_on_deal=statistics.median(efficiencies) if efficiencies else None,
                    primary=metrics(games),participant=metrics(games,"participant_judgments"))
        for condition,field in [("primary","judgments"),("participant","participant_judgments")]:
            for model, score in part[condition].items():
                case_ids=sorted({g["case_id"] for g in games})
                case_scores=[metrics([g for g in games if g["case_id"]==case_id],field)[model]["balanced_accuracy"] for case_id in case_ids]
                # Every case has equal positives and negatives for every reader.
                rng=random.Random(1265)
                distribution=sorted(statistics.mean(rng.choices(case_scores,k=len(case_scores))) for _ in range(5000))
                score["case_bootstrap_95"]=[distribution[124],distribution[4874]]
                targets=[r for g in games for r in g[field] if r["reader"]==model]
                score["invalid"]=sum(r["answer"] is None for r in targets)
                score["by_known_role"]={role:sum(r["correct"] for r in targets if r["role"]==role)/
                                        sum(r["role"]==role for r in targets) for role in ("buyer","seller")}
                score["topic_scores"]=dict(zip(case_ids,case_scores))
        result[label]=part
    return result


if __name__=="__main__":
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument("archive",type=Path,nargs="?",default=HERE/"seed.json")
    ap.add_argument("--output",type=Path)
    args=ap.parse_args();result=analyze(json.loads(args.archive.read_text()))
    text=json.dumps(result,indent=2,ensure_ascii=False)
    if args.output:args.output.write_text(text+"\n")
    else:print(text)
