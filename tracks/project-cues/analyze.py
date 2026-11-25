"""Summarize blind A/B choices by project genre and source-file formatting."""
import argparse
from collections import Counter, defaultdict
from fractions import Fraction
from pathlib import Path
import sys

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parents[1]))
from tracks.core.scoring import digest, key, read, save

ARCHIVE = HERE.parent / "core/release/projects"
WEB_EXTENSIONS = {".html", ".js", ".css"}


def count_labels(labels):
    return dict(sorted(Counter(labels).items()))


def web_source(work):
    base = ARCHIVE / "works" / work["brief"] / work["writer"]
    files = sorted(name for name in work["files"] if Path(name).suffix.lower() in WEB_EXTENSIONS)
    size = lines = 0
    for name in files:
        if digest(base/name) != work["files"][name]:
            raise ValueError(f"File hash differs from inventory for {work['brief']}/{name}")
        for line in (base/name).read_bytes().splitlines():
            if line.strip():
                lines += 1
                size += len(line)
    return dict(files=files, nonblank_lines=lines, bytes_on_nonblank_lines=size)


def summarize(rows, projects):
    groups = defaultdict(list)
    for row in rows:
        groups[row["brief"]].append(row)
    if any(len(group) != 2 or group[0]["authors"] != group[1]["authors"][::-1] for group in groups.values()):
        raise ValueError("Expected both orders of each comparison for each reader")
    return dict(briefs=len(groups), genres=count_labels(projects[b]["genre"] for b in groups),
                correct=sum(r["answer"] == key(r) for r in rows), decisions=len(rows),
                briefs_by_correct_orders=count_labels(str(sum(r["answer"] == key(r) for r in pair))
                                                      for pair in groups.values()))


def analyze():
    manifest = read(ARCHIVE/"manifest.json")
    works = read(ARCHIVE/"inventory.json")
    projects = {b["id"]: dict(genre=b["genre"], sources={}) for b in manifest["briefs"]}
    for work in works:
        projects[work["brief"]]["sources"][work["writer"]] = web_source(work)
    for project in projects.values():
        sources = project["sources"]
        project["web_presence"] = ("neither", "one", "both")[sum(bool(s["files"]) for s in sources.values())]
        if project["web_presence"] == "both":
            densities = {w: Fraction(s["bytes_on_nonblank_lines"], s["nonblank_lines"]) for w,s in sources.items()}
            winners = [w for w in densities if densities[w] == max(densities.values())]
            project["denser_web_source"] = winners[0] if len(winners) == 1 else None

    rows = [r for r in read(ARCHIVE/"judgments.json") if r["mode"] == "ab"]
    readers = {}
    for reader in manifest.get("readers", manifest["models"]):
        selected = [r for r in rows if r["reader"] == reader]
        by_presence = {}
        for presence in ("both", "one", "neither"):
            by_presence[presence] = summarize([r for r in selected if projects[r["brief"]]["web_presence"] == presence], projects)
        by_genre = {}
        for genre in sorted({b["genre"] for b in manifest["briefs"]}):
            by_genre[genre] = summarize([r for r in selected if projects[r["brief"]]["genre"] == genre], projects)
        writers_chosen = []
        for row in selected:
            if projects[row["brief"]]["web_presence"] == "both":
                writers_chosen.append(row["authors"]["AB".index(row["answer"])] if row["answer"] in ("A", "B") else "invalid")
        readers[reader] = dict(by_presence=by_presence, by_genre=by_genre,
                               selected_writer_when_both_contain_web_source=count_labels(writers_chosen))
    return dict(projects=projects, readers=readers, denser_writer_when_both=count_labels(
        p["denser_web_source"] or "tie" for p in projects.values() if p["web_presence"] == "both"))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--verify", action="store_true")
    args = parser.parse_args()
    report = analyze()
    path = HERE/"results.json"
    if args.verify:
        if read(path) != report:
            raise ValueError("Project cue analysis differs from archived evidence.")
    else:
        save(path, report)
    for reader, data in report["readers"].items():
        print(reader, {k: (v["correct"], v["decisions"]) for k, v in data["by_presence"].items()})
