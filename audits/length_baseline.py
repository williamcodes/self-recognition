"""Reproduce the retrospective v1 length shortcut from the published seed."""
from collections import Counter
from pathlib import Path
import json

run = json.loads((Path(__file__).resolve().parents[1] / "docs/data/seed.json").read_text())
long_writer = "qwen2.5:1.5b"
scores = Counter()
for trial in run["trials"]:
    model, foil = trial["model"], trial["foil"]
    condition, i = trial["condition"], trial["prompt_index"]
    paired = condition.endswith("_ab")
    authors = [model, foil] if trial["expected"] in ("A", "YES") else [foil, model]
    if not paired:
        authors = authors[:1]
    # The key reconstructs the anonymous stimulus. Only word counts enter the prediction.
    indices = [i, (i + 1) % len(run["manifest"]["prompts"])] if condition.startswith("folder") else [i]
    lengths = [sum(len(run["corpus"][a][j].split()) for j in indices) / len(indices) for a in authors]
    if paired and lengths[0] == lengths[1]:
        prediction = None  # Abstain on equal lengths. Abstentions receive zero credit.
    elif paired:
        predict_a = (lengths[0] > lengths[1]) == (model == long_writer)
        prediction = "A" if predict_a else "B"
    else:
        predict_yes = (lengths[0] > 85) == (model == long_writer)
        prediction = "YES" if predict_yes else "NO"
    scores[condition] += prediction == trial["expected"]
print(dict(scores))
print(sum(scores.values()), "of", len(run["trials"]))
