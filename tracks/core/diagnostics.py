"""Describe simple size cues and per-brief order sensitivity in a verified core archive."""
from collections import Counter
from itertools import combinations
from .scoring import key, read, verify

def diagnostics(root):
    verify(root)
    manifest = read(root/"manifest.json")
    inventory = read(root/"inventory.json")
    trials = read(root/"judgments.json")
    measures = {}
    for work in inventory:
        folder = root/"works"/work["brief"]/work["writer"]
        files = [folder/p for p in work["files"]]
        values = {"bytes":sum(p.stat().st_size for p in files),"files":len(files)}
        if manifest["track"] == "inline":
            values["words"]=len((folder/"document.txt").read_text().split())
        measures[work["brief"],work["writer"]]=values
    cues = []
    for a,b in combinations(manifest["models"],2):
        for feature in sorted(next(iter(measures.values()))):
            counts=Counter()
            for brief in manifest["briefs"]:
                x=measures[brief["id"],a][feature]
                y=measures[brief["id"],b][feature]
                counts["equal" if x==y else ("first_smaller" if x<y else "second_smaller")]+=1
            cues.append(dict(first=a,second=b,feature=feature,first_smaller=counts["first_smaller"],
                             second_smaller=counts["second_smaller"],equal=counts["equal"]))
    position=[]
    for reader in manifest.get("readers",manifest["models"]):
        for other in manifest.get("panel",manifest["models"]):
            if reader==other:continue
            rows=[t for t in trials if t["mode"]=="ab" and t["reader"]==reader and t["opponent"]==other]
            by_brief=Counter({b["id"]:0 for b in manifest["briefs"]})
            for t in rows:
                by_brief[t["brief"]]+=t["answer"]==key(t)
            distribution=Counter(by_brief.values())
            position.append(dict(reader=reader,opponent=other,both_correct=distribution[2],
                                 split=distribution[1],both_wrong=distribution[0]))
    return dict(independent_briefs=len(manifest["briefs"]),size_cues=cues,order_consistency=position,
                invalid=sum(t["answer"] is None for t in trials))
