"""Describe writer preferences, size differences and variation across tasks."""
from collections import Counter, defaultdict
from itertools import combinations
import random

from .scoring import key, read, scores, verify


def size_cues(root, manifest):
    measures = {}
    for work in read(root / "inventory.json"):
        folder = root / "works" / work["brief"] / work["writer"]
        files = [folder / name for name in work["files"]]
        values = {"bytes": sum(path.stat().st_size for path in files), "files": len(files)}
        if manifest["track"] == "inline":
            values["words"] = len((folder / "document.txt").read_text().split())
        measures[work["brief"], work["writer"]] = values

    result = []
    for first, second in combinations(manifest["models"], 2):
        for feature in sorted(next(iter(measures.values()))):
            counts = Counter()
            for brief in manifest["briefs"]:
                x = measures[brief["id"], first][feature]
                y = measures[brief["id"], second][feature]
                comparison = "first_smaller" if x < y else "second_smaller" if y < x else "equal"
                counts[comparison] += 1
            result.append(dict(first=first, second=second, feature=feature,
                               first_smaller=counts["first_smaller"], second_smaller=counts["second_smaller"],
                               equal=counts["equal"]))
    return result


def intervals(brief_scores):
    # The design weights each brief equally. Keep all readers, opponents and orders together.
    rng = random.Random(41027)
    draws = [[rng.randrange(len(brief_scores)) for _ in brief_scores] for _ in range(5000)]
    result = {}
    for reader in brief_scores[0]:
        result[reader] = {}
        for metric in ("ab_accuracy", "yn_balanced_accuracy"):
            points = [s[reader][metric] for s in brief_scores]
            means = sorted(sum(points[i] for i in sample) / len(points) for sample in draws)
            result[reader][metric] = [means[124], means[4874]]
    return result


def diagnostics(root):
    verify(root)
    manifest = read(root / "manifest.json")
    trials = read(root / "judgments.json")
    genres = {brief["id"]: brief["genre"] for brief in manifest["briefs"]}
    by_genre = defaultdict(list)
    by_brief = defaultdict(list)
    pairs = defaultdict(list)
    for trial in trials:
        by_brief[trial["brief"]].append(trial)
        by_genre[genres[trial["brief"]]].append(trial)
        if trial["mode"] == "ab":
            pairs[trial["reader"], trial["opponent"]].append(trial)

    position = []
    choices = []
    for (reader, other), rows in sorted(pairs.items()):
        correct = Counter()
        selected = Counter()
        for row in rows:
            correct[row["brief"]] += row["answer"] == key(row)
            if row["answer"] in ("A", "B"):
                selected[row["authors"]["AB".index(row["answer"])]] += 1
        distribution = Counter(correct.values())
        position.append(dict(reader=reader, opponent=other, both_correct=distribution[2],
                             split=distribution[1], both_wrong=distribution[0]))
        choices.append(dict(reader=reader, opponent=other, selected_writer=dict(selected),
                            invalid=len(rows) - sum(selected.values()), trials=len(rows)))

    return dict(independent_briefs=len(by_brief), size_cues=size_cues(root, manifest),
                order_consistency=position, ab_writer_selections=choices,
                brief_bootstrap_95=intervals([scores(group) for group in by_brief.values()]),
                by_genre={g: scores(rows) for g, rows in sorted(by_genre.items())},
                invalid=sum(t["answer"] is None for t in trials))
