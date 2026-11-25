"""Build the two frozen seed panels from completed private game snapshots, with no model calls."""
import argparse
import hashlib
import json
from pathlib import Path
import sys

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parents[1]))
from tracks.negotiation.analyze import analyze
from tracks.negotiation.provenance import seal
from tracks.negotiation.score import metrics
from tracks.negotiation.verify import verify


def save(path, value):
    path.write_text(json.dumps(value, indent=2, ensure_ascii=False) + "\n")


def build_panel(cases, source, models, state, versions):
    ids = {case["id"] for case in cases}
    games = sorted((g for g in source if g["case_id"] in ids
                    and all(m in models for m in g["participants"].values())), key=lambda g:g["id"])
    archive = dict(protocol_version="negotiation-v1", models=models, cases=cases, games=games,
                   metrics=metrics(games), participant_metrics=metrics(games, "participant_judgments"))
    seal(archive, state)
    verify(archive)
    archive["generation"] = dict(
        codex_cli=versions[0], claude_cli=versions[1], reasoning_effort="low",
        reader="fresh, known role identified; sees public messages and public action terms",
        companion="postgame, same participant session; sees prior private brief and all final moves",
        score="balanced accuracy per model; first yes/no token; invalid responses count as errors",
        case_file_sha256=hashlib.sha256((HERE / "cases.json").read_bytes()).hexdigest(),
        case_cluster="all role and model assignments of one scenario", cash_api_calls=0)
    return archive


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--state", required=True, type=Path)
    parser.add_argument("--output-dir", required=True, type=Path)
    parser.add_argument("--codex-version", required=True)
    parser.add_argument("--claude-version", required=True)
    args=parser.parse_args()
    cases=json.loads((HERE/"cases.json").read_text())
    games=[json.loads(p.read_text()) for p in args.state.glob("*.json")]
    versions=(args.codex_version,args.claude_version)
    main=build_panel(cases,games,["gpt-6.2-astra","gpt-6.2-sol"],args.state,versions)
    cross=build_panel([c for c in cases if c["split"]=="confirmation"][:4],games,
                      ["gpt-6.2-astra","claude-fable-5-2"],args.state,versions)
    known={g["id"]:g for g in main["games"]}
    overlap=[g for g in cross["games"] if g["id"] in known]
    assert len(overlap)==4 and all(g==known[g["id"]] for g in overlap)
    args.output_dir.mkdir(parents=True,exist_ok=True)
    for name,panel in (("seed",main),("cross-family",cross)):
        save(args.output_dir/(name+".json"),panel)
        save(args.output_dir/(name+"-analysis.json"),analyze(panel))
    save(args.output_dir/"example.json",known["museum-signs-31e885d4"])
