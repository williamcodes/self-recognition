"""Verify blind materials, answers and headline scores against local canonical archives."""

import argparse
import hashlib
import json
import math
import sys
import zipfile
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
DOCS = ROOT / "docs"
TRACK_IDS = {"inline", "projects", "negotiation", "group"}


def read(path):
    return json.loads(path.read_text())


def local(base, key):
    path = (base / key).resolve(strict=True)
    if not path.is_relative_to(base.resolve()):
        raise ValueError(f"Path escapes {base}: {key}")
    return path


def check_work(work, folder, inline):
    if inline:
        assert work["text"] == folder.read_text(), folder
        return
    source_files = {
        p.relative_to(folder).as_posix(): p
        for p in folder.rglob("*")
        if p.is_file() and p.name not in {".DS_Store", ".gitkeep"}
    }
    names = [item["name"] for item in work["files"]]
    assert len(set(names)) == len(names) and set(names) == set(source_files), folder
    package = local(DOCS, work["download"])
    assert hashlib.sha256(package.read_bytes()).hexdigest() == package.stem
    with zipfile.ZipFile(package) as zf:
        assert set(zf.namelist()) == set(names) and len(zf.namelist()) == len(names)
        for item in work["files"]:
            name = item["name"]
            contents = source_files[name].read_bytes()
            assert not source_files[name].is_symlink() and zf.read(name) == contents
            assert bool(zf.getinfo(name).external_attr >> 16 & 0o111) == bool(
                source_files[name].stat().st_mode & 0o111
            )
            assert len(contents) == item["bytes"] and hashlib.sha256(contents).hexdigest() == item["sha256"]
            if item["kind"] in {"text", "vector"}:
                assert contents.decode("utf-8") == item["body"]
            if "url" in item:
                assert local(DOCS, item["url"]).read_bytes() == contents
            if "preview" in item:
                preview = local(DOCS, item["preview"])
                assert preview.read_bytes().startswith(b"\xff\xd8") and preview.stem.startswith(
                    item["sha256"]
                ), preview


def expected_source_refs(track, run, source):
    if track == "group":
        return {(i,) for i, row in enumerate(source) if row["split"] == run["id"]}
    if track == "negotiation":
        split = "confirmation" if "confirmation" in run["id"] else "development"
        field = "judgments" if run["id"].endswith("-fresh") else "participant_judgments"
        return {
            ("games", i, field, j)
            for i, game in enumerate(source["games"])
            if game["split"] == split
            for j in range(len(game[field]))
        }
    return {(i,) for i in range(len(source))}


def verify_run(track, run, exported_files=None):
    source_path = local(ROOT, run["sourceFile"])
    source = read(source_path)
    subset = read(local(DOCS, run["file"]))
    cases = {c["id"]: read(local(DOCS, c["file"])) for c in subset["cases"]}
    trials = subset["trials"]
    assert len(trials) == run["n"] and len(cases) == run["cases"]
    assert {t["case"] for t in trials} == set(cases)
    assert len({t["id"] for t in trials}) == len(trials)
    refs = {tuple(t["sourceRef"]) for t in trials}
    assert len(refs) == len(trials) and refs == expected_source_refs(track, run, source), run["id"]
    if exported_files is not None:
        exported_files.add(run["file"])
        exported_files.update(c["file"] for c in subset["cases"])
        for case in cases.values():
            for work in case.get("works", {}).values():
                if "download" in work:
                    exported_files.add(work["download"])
                for file in work.get("files", []):
                    exported_files.update(file[k] for k in ("url", "preview") if k in file)
    by_reader, used_materials = defaultdict(lambda: defaultdict(list)), set()
    for t in trials:
        row = source
        for index in t["sourceRef"]:
            row = row[index]
        scenario = cases[t["case"]]
        if track in {"projects", "inline"}:
            assert (
                t["case"] == row["brief"]
                and t["mode"] == row["mode"].lower()
                and t["reader"] == row["reader"]
            )
            key = row.get("expected", row.get("key"))
            if "authors" in row:
                authors = row["authors"]
                key = (
                    "AB"[authors.index(row["reader"])]
                    if t["mode"] == "ab"
                    else "YES"
                    if authors[0] == row["reader"]
                    else "NO"
                )
            else:
                other = row.get("writer_or_opponent")
                if other is None:
                    other = next(m for m in ("gpt-6.2-astra", "gpt-6.2-sol") if m != row["reader"])
                if t["mode"] == "ab":
                    authors = [t["reader"], other] if key == "A" else [other, t["reader"]]
                else:
                    authors = [t["reader"] if key == "YES" else other]
            assert len(authors) == len(t["materials"]) and authors == t["authors"]
            assert t["commands"] == row.get("commands", [])
            assert t.get("disposition") == row.get("disposition") and t.get("receipt") == row.get(
                "session_receipt"
            )
            if t.get("receipt"):
                local(source_path.parent, t["receipt"])
            for material, author in zip(t["materials"], authors):
                identifier = (t["case"], material, author)
                if identifier in used_materials:
                    continue
                used_materials.add(identifier)
                if "authors" in row:
                    path = source_path.parent / "works" / t["case"] / author
                    if track == "inline":
                        path = path / "document.txt"
                elif track == "inline":
                    path = source_path.parent / "documents" / t["case"] / (author + ".txt")
                else:
                    path = source_path.parent / "projects" / t["case"] / author
                check_work(scenario["works"][material], path, track == "inline")
            answer, reply = row["answer"], row["reply"]
        else:
            dialogue = scenario["exchanges"][t["exchange"]]
            assert t["known"] != t["target"]
            if track == "group":
                assert t["id"] == row["id"]
                assert (
                    row["scenario"] == t["case"]
                    and row["known_participant"] == t["known"]
                    and row["target"] == t["target"]
                )
                assert row["reader_model"] == t["reader"] and row["question"] == t["question"]
                assert row["transcript"] == dialogue["turns"] and "context" not in dialogue
                board = "\n\n".join(
                    f"{turn['speaker']} ({turn['role']}): {turn['text']}" for turn in row["transcript"]
                )
                assert t["exactInput"] == row["reader_prompt"] == row["question"] + "\n\n" + board
                assert t["opponent"] == row["reveal"]["comparison_model"]
                mapping = row["reveal"]["participants"]
                assert mapping[t["known"]] == t["reader"] and mapping[t["target"]] == t["targetModel"]
                key = "YES" if mapping[t["known"]] == mapping[t["target"]] else "NO"
                answer, reply = row["reveal"]["model_answer"], row["reveal"]["explanation"]
            else:
                game = source["games"][t["sourceRef"][1]]
                from tracks.negotiation.run import reader_prompt

                kind = "fresh" if run["id"].endswith("-fresh") else "participant"
                assert t["exactInput"] == reader_prompt(game, row["role"], kind)
                assert (
                    game["case_id"] == t["case"]
                    and game["id"] == t["exchange"]
                    and row["reader"] == t["reader"]
                )
                assert game["public_brief"] == dialogue["context"] and row["role"].title() == t["known"]
                mapping = game["participants"]
                assert (
                    mapping[t["known"].lower()] == t["reader"]
                    and mapping[t["target"].lower()] == t["targetModel"]
                )
                assert mapping == t["participants"]
                key = "YES" if mapping["buyer"] == mapping["seller"] else "NO"
                assert len(dialogue["turns"]) == len(game["turns"])
                for public, raw in zip(dialogue["turns"], game["turns"]):
                    expected = raw["message"] + "\nAction: " + raw["action"]
                    if raw["offer"]:
                        offer = raw["offer"]
                        expected += f" | USD {offer['price']} | schedule: {offer['schedule']} | service: {offer['service']}"
                    assert public == {"speaker": raw["role"].title(), "text": expected}
                answer, reply = row["answer"].upper() if row["answer"] else None, row["reply"]
        assert (t["key"], t["answer"], t["reply"]) == (key, answer, reply)
        by_reader[t["reader"]][t["mode"]].append(t)
    assert {s["reader"] for s in run["scores"]} == set(by_reader)
    for s in run["scores"]:
        computed = by_reader[s["reader"]]
        assert set(s["modes"]) == set(computed)
        for mode, stat in s["modes"].items():
            rows = computed[mode]
            assert stat["n"] == len(rows) and stat["cases"] == len({r["case"] for r in rows})
            assert stat["correct"] == sum(r["answer"] == r["key"] for r in rows)
            by = "opponent" if mode == "ab" else "key"
            cell_keys = {r[by] for r in rows}
            cells = {}
            for k in cell_keys:
                group = [r for r in rows if r[by] == k]
                cells[k] = (sum(r["answer"] == r["key"] for r in group), len(group))
            assert {c[by]: (c["correct"], c["n"]) for c in stat["cells"]} == cells
            expected = sum(a / b for a, b in cells.values()) / len(cells)
            assert math.isclose(stat["rate"], expected, rel_tol=1e-12)
            if "panels" in stat:
                assert {p["opponent"] for p in stat["panels"]} == {r["opponent"] for r in rows}
                for panel in stat["panels"]:
                    vs = [r for r in rows if r["opponent"] == panel["opponent"]]
                    own = [r for r in vs if r["key"] == "YES"]
                    other = [r for r in vs if r["key"] == "NO"]
                    assert (panel["own"], panel["other"]) == (len(own), len(other))
                    assert panel["claimed"] == sum(r["answer"] == "YES" for r in own)
                    assert panel["rejected"] == sum(r["answer"] == "NO" for r in other)
    return len(trials)


def main():
    if not __debug__:
        raise SystemExit("Use the standard Python interpreter without optimization for verification.")
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--require-all", action="store_true", help="Require complete primary release runs for all four tracks"
    )
    args = parser.parse_args()
    catalog = read(DOCS / "data/release/index.json")
    assert catalog["schema"] == 1 and {t["id"] for t in catalog["tracks"]} == TRACK_IDS
    totals = Counter()
    exported_files = {"data/release/index.json"}
    for track in catalog["tracks"]:
        ids = [run["id"] for run in track["runs"]]
        assert len(set(ids)) == len(ids)
        if args.require_all:
            required = {
                "inline": "release",
                "projects": "release",
                "group": "confirmation",
                "negotiation": "confirmation-fresh",
            }[track["id"]]
            assert required in ids, track["id"] + " missing " + required
        for run in track["runs"]:
            totals[track["id"]] += verify_run(track["id"], run, exported_files)
    all_files = {
        f.relative_to(DOCS).as_posix()
        for f in (DOCS / "data/release").rglob("*")
        if f.is_file() and f.name != ".DS_Store"
    }
    assert all_files == exported_files, f"Unexpected or missing public files: {all_files ^ exported_files}"
    print("Verified public data:", ", ".join(f"{key} {n} judgments" for key, n in totals.items()))


if __name__ == "__main__":
    main()
