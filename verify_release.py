"""Verify scoring, answer keys and public outputs. Runs offline."""
from pathlib import Path
from tracks.negotiation.analyze import analyze
from tracks.core.diagnostics import diagnostics
from tracks.core.scoring import digest, read
import json
import subprocess
import sys
import tempfile

ROOT=Path(__file__).resolve().parent

def python(*args):
    subprocess.run([sys.executable,*map(str,args)],cwd=ROOT,check=True)

def main():
    if not __debug__:
        raise SystemExit("Run verification without Python's optimization flag.")
    for track in ("inline","projects"):
        archive = ROOT / "tracks" / "core" / "release" / track
        bank = archive.parents[1] / (track + "-briefs.json")
        if read(archive / "manifest.json")["briefs"] != read(bank):
            raise ValueError(f"Published {track} briefs differ from the frozen bank")
        if diagnostics(archive) != json.loads((archive / "diagnostics.json").read_text()):
            raise ValueError(f"Published {track} diagnostics differ from underlying works and judgments")
        print(f"Verified {track} scores, raw works, judgments and diagnostics.", flush=True)
    python("tracks/project-cues/analyze.py", "--verify")
    python("tracks/project-input-check/screen.py", "--verify")
    python("tracks/project-input-check/retry_audit.py", "--verify")
    python("tracks/project-input-check/repeat.py", "--verify")
    python("tracks/project-input-check/repeat.py", "--cohort", "astra", "--verify")
    python("tracks/inline-cross-family/run.py", "verify")
    python("tracks/social-typography/analyze.py", "--verify")
    negotiation=ROOT/"tracks"/"negotiation"
    bank = read(negotiation / "cases.json")
    bank_hash = digest(negotiation / "cases.json")
    known = {}
    for name in ("seed", "cross-family"):
        path = negotiation / (name + ".json")
        python(negotiation / "verify.py", path)
        archive = json.loads(path.read_text())
        cases = bank if name == "seed" else [case for case in bank if case["split"] == "confirmation"][:4]
        if archive["cases"] != cases or archive["generation"]["case_file_sha256"] != bank_hash:
            raise ValueError(f"Published {name} cases differ from the negotiation bank")
        analysis = json.loads((negotiation / (name + "-analysis.json")).read_text())
        if analyze(archive) != analysis:
            raise ValueError(f"Published negotiation analysis differs for {name}")
        games = {game["id"]: game for game in archive["games"]}
        if name == "seed":
            known = games
        else:
            overlap = games.keys() & known.keys()
            if len(overlap) != 4 or any(games[k] != known[k] for k in overlap):
                raise ValueError("Expected four identical shared negotiation games")
    example = json.loads((negotiation / "example.json").read_text())
    if example != known[example["id"]]:
        raise ValueError("Published negotiation example differs from source")
    group=ROOT/"tracks"/"group"
    python(group / "provenance.py")
    python(group / "replay.py", "--verify")
    with tempfile.TemporaryDirectory() as t:
        python(group/"analyze.py","--export",t)
        for name in ("metrics.json","examples.json"):
            if json.loads((Path(t)/name).read_text())!=json.loads((group/name).read_text()):
                raise ValueError(f"Published group {name} differs from independent reconstruction")
    python("verify.py","docs/data/seed.json")
    python("scripts/verify_public_site.py","--require-all")
    print("Verified all four current tracks and the historical seed.")

if __name__=="__main__":
    main()
