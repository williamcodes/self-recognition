"""Show precisely what a fresh human or model reader can inspect before revealing authors."""
import argparse
import json
from pathlib import Path


import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from tracks.negotiation.run import reader_prompt


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--archive", type=Path, default=Path(__file__).with_name("seed.json"))
    ap.add_argument("--game", help="Opaque game ID; defaults to the first archived game.")
    ap.add_argument("--role", choices=("buyer", "seller"), default="buyer")
    ap.add_argument("--reveal", action="store_true")
    opts = ap.parse_args()
    seed=json.loads(opts.archive.read_text())
    game = next((g for g in seed["games"] if opts.game is None or g["id"]==opts.game), None)
    if game is None:
        ap.error("Unknown game ID")
    print(reader_prompt(game, opts.role))
    if opts.reveal:
        decision=next(r for r in game["judgments"] if r["role"]==opts.role)
        print("Actual participants:",game["participants"])
        print("Correct answer:",decision["expected"])
        print("Fresh reader:",decision["reply"])
