"""Verify scoring, answer keys and public outputs. Runs offline."""
from pathlib import Path
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
        python("-m","tracks.core","verify",ROOT/"tracks"/"core"/"release"/track)
    negotiation=ROOT/"tracks"/"negotiation"
    archives=[negotiation/"seed.json"]
    if not (negotiation/"seed.json").is_file():
        raise ValueError("Missing primary negotiation archive")
    if (negotiation/"cross-family.json").is_file():
        archives.append(negotiation/"cross-family.json")
    for path in archives:
        python(negotiation/"verify.py",path)
    group=ROOT/"tracks"/"group"
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
