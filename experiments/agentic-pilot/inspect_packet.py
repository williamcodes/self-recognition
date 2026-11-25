"""Export one blinded trial for inspection, with no model calls."""
import argparse
import json
from pathlib import Path

root = Path(__file__).resolve().parent
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("round")
parser.add_argument("topic", type=int)
parser.add_argument("opponent", choices=["claude", "sol"])
parser.add_argument("own_position", choices=["A", "B"])
parser.add_argument("destination", type=Path)
args = parser.parse_args()
models = {"claude": "anthropic/claude-fable-5.2", "sol": "openai/gpt-6.2-sol"}
archive = json.loads((root / "rounds" / f"{args.round}.json").read_text())
trial = next(
    record for record in archive["inputs"]
    if record["topic"] == args.topic
    and record["foil"] == models[args.opponent]
    and record["own_position"] == args.own_position
)
args.destination.mkdir(parents=True, exist_ok=False)
for name, text in trial["files"].items():
    path = args.destination / name
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text + "\n")
print(trial["question"])
