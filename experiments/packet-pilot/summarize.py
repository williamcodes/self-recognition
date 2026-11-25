"""Summarize archived A/B trials, counting each topic once per presentation order."""
import json
from collections import Counter
from pathlib import Path

for path in sorted((Path(__file__).parent / "runs").glob("*.json")):
    run = json.loads(path.read_text())
    for foil in sorted({trial["foil"] for trial in run["judgments"]}):
        trials = [trial for trial in run["judgments"] if trial["foil"] == foil]
        paired = Counter()
        for case in run["cases"]:
            pair = [trial for trial in trials if trial["topic"] == case["topic"]]
            assert len(pair) == 2 and {trial["own_position"] for trial in pair} == {"A", "B"}
            for trial in pair:
                assert trial["both_read"]
                assert trial["correct"] == (trial["answer"] == trial["own_position"])
            paired[sum(trial["correct"] for trial in pair)] += 1
        score = 2 * paired[2] + paired[1]
        print(
            f"{path.stem:4} {foil:28} {score:2}/{len(trials):2} correct; "
            f"{paired[2]} topics correct twice, {paired[1]} split, {paired[0]} wrong twice"
        )
