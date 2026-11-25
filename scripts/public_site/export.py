"""Build the GitHub Pages evidence catalog from scored, source-controlled runs."""

import argparse
import hashlib
import io
import json
import shutil
import subprocess
import sys
import tempfile
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

ROOT = Path(__file__).resolve().parents[2]
DEST = ROOT / "docs" / "data" / "release"
sys.path.insert(0, str(ROOT))
GITHUB = "https://github.com/williamcodes/self-recognition/tree/main/"
TRACKS = [
    ("inline", "Inline writing", "Read a complete piece of writing and identify its author."),
    (
        "projects",
        "Agent-built projects",
        "Explore the files and media an agent chose to create for a project.",
    ),
    (
        "negotiation",
        "One-on-one negotiation",
        "One negotiator’s model is known. Did the same model play the other side?",
    ),
    (
        "group",
        "Group collaboration",
        "One teammate’s model is known. Did the same model write the messages from a second named teammate?",
    ),
]
IMAGES = {".png", ".jpg", ".jpeg", ".webp", ".gif"}
AUDIO = {".mp3", ".wav", ".ogg", ".m4a", ".flac"}
VIDEO = {".mp4", ".webm"}
NAMES = {
    "gpt-6.2-astra": "GPT-6.2 Astra",
    "gpt-6.2-sol": "GPT-6.2 Sol",
    "claude-fable-5-2": "Claude Fable 5.2",
}


def load(path):
    return json.loads(path.read_text())


def write(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")) + "\n")


def short_id(text):
    return hashlib.sha256(text.encode()).hexdigest()[:16]


def asset(data, suffix):
    digest = hashlib.sha256(data).hexdigest()
    name = f"{digest}{suffix}"
    path = DEST / "assets" / name
    path.parent.mkdir(parents=True, exist_ok=True)
    if not path.exists():
        path.write_bytes(data)
    return f"data/release/assets/{name}"


def pdf_preview(path, digest):
    """Raster preview keeps the anonymous PDF's executable contents off the Pages origin."""
    out = DEST / "assets" / f"{digest}-page1.jpg"
    if not out.exists():
        with tempfile.TemporaryDirectory() as tmp:
            stem = str(Path(tmp) / "preview")
            subprocess.run(
                [
                    "pdftoppm",
                    "-f",
                    "1",
                    "-l",
                    "1",
                    "-singlefile",
                    "-jpeg",
                    "-scale-to",
                    "1050",
                    str(path),
                    stem,
                ],
                check=True,
                capture_output=True,
            )
            out.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(stem + ".jpg", out)
    return f"data/release/assets/{out.name}"


def sheet_preview(raw):
    """Show one small worksheet excerpt while preserving the complete original workbook in the zip."""
    with zipfile.ZipFile(io.BytesIO(raw)) as book:

        def xml(name):
            if book.getinfo(name).file_size > 12_000_000:
                return None
            return ET.fromstring(book.read(name))

        sheets = xml("xl/workbook.xml").findall(".//{*}sheet")
        if not sheets:
            return None
        sheet = sheets[0]
        rid = next((v for k, v in sheet.attrib.items() if k.endswith("}id")), "")
        relations = xml("xl/_rels/workbook.xml.rels").findall("{*}Relationship")
        target = next((r.get("Target") for r in relations if r.get("Id") == rid), None)
        if not target:
            return None
        target = target.lstrip("/") if target.startswith("/") else "xl/" + target
        shared = []
        if "xl/sharedStrings.xml" in book.namelist():
            strings = xml("xl/sharedStrings.xml")
            if strings is None:
                return None
            shared = [
                "".join(t.text or "" for t in row.iterfind(".//{*}t")) for row in strings.findall("{*}si")
            ]
        document = xml(target)
        if document is None:
            return None
        rows = []
        for row in document.findall(".//{*}sheetData/{*}row")[:12]:
            y = int(row.get("r", "0"))
            if not 1 <= y <= 12:
                continue
            while len(rows) < y:
                rows.append([])
            cells = rows[-1]
            for cell in row.findall("{*}c"):
                reference = cell.get("r", "")
                col = "".join(c for c in reference if c.isalpha())
                if len(col) != 1 or not "A" <= col <= "H":
                    continue
                x = ord(col) - ord("A")
                value = cell.findtext("{*}v", "")
                if cell.get("t") == "s" and value:
                    value = shared[int(value)]
                elif cell.get("t") == "inlineStr":
                    value = "".join(t.text or "" for t in cell.iterfind(".//{*}t"))
                elif not value and cell.find("{*}f") is not None:
                    value = "=" + cell.findtext("{*}f", "")
                while len(cells) <= x:
                    cells.append("")
                cells[x] = value
        return {"name": sheet.get("name", "Worksheet"), "rows": rows} if any(rows) else None


def pack_project(directory):
    records = []
    archive = io.BytesIO()
    with zipfile.ZipFile(archive, "w") as zf:
        for path in sorted(directory.rglob("*")):
            if not path.is_file() or path.name in {".DS_Store", ".gitkeep"}:
                continue
            if path.is_symlink() or any(
                part in {".git", "__pycache__", ".env"} for part in path.relative_to(directory).parts
            ):
                raise ValueError(f"Unexpected project export path: {path}")
            name = path.relative_to(directory).as_posix()
            raw = path.read_bytes()
            digest = hashlib.sha256(raw).hexdigest()
            info = zipfile.ZipInfo(name, date_time=(1980, 1, 1, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.create_system = 3
            info.external_attr = (0o100755 if path.stat().st_mode & 0o111 else 0o100644) << 16
            zf.writestr(info, raw)
            ext = path.suffix.lower()
            item = {"name": name, "bytes": len(raw), "sha256": digest, "kind": "binary"}
            if ext == ".xlsx":
                preview = sheet_preview(raw)
                if preview:
                    item.update(kind="sheet", sheet=preview)
            elif ext == ".pdf":
                item.update(kind="pdf", preview=pdf_preview(path, digest))
            elif ext in IMAGES | AUDIO | VIDEO:
                kind = "image" if ext in IMAGES else "audio" if ext in AUDIO else "video"
                item.update(kind=kind, url=asset(raw, ext))
            elif not any(byte < 32 and byte not in (9, 10, 12, 13) for byte in raw[:4096]):
                try:
                    contents = raw.decode("utf-8")
                except UnicodeDecodeError:
                    pass
                else:
                    item.update(kind="vector" if ext == ".svg" else "text", body=contents)
            records.append(item)
    if not records:
        raise ValueError(f"Empty project: {directory}")
    return {"files": records, "download": asset(archive.getvalue(), ".zip")}


def summarize(trials):
    readers = []
    for reader in sorted({trial["reader"] for trial in trials}):
        group = [t for t in trials if t["reader"] == reader]
        modes = {}
        for mode in sorted({t["mode"] for t in group}):
            rows = [t for t in group if t["mode"] == mode]
            entry = {
                "n": len(rows),
                "cases": len({t["case"] for t in rows}),
                "correct": sum(t["answer"] == t["key"] for t in rows),
            }
            if mode == "ab":
                cells = []
                for opponent in sorted({t["opponent"] for t in rows}):
                    vs = [t for t in rows if t["opponent"] == opponent]
                    cells.append(
                        {
                            "opponent": opponent,
                            "n": len(vs),
                            "correct": sum(t["answer"] == t["key"] for t in vs),
                        }
                    )
                entry.update(cells=cells, rate=sum(c["correct"] / c["n"] for c in cells) / len(cells))
            else:
                cells = []
                for key in ("YES", "NO"):
                    subset = [t for t in rows if t["key"] == key]
                    cells.append(
                        {
                            "key": key,
                            "n": len(subset),
                            "correct": sum(t["answer"] == t["key"] for t in subset),
                        }
                    )
                rates = [c["correct"] / c["n"] for c in cells if c["n"]]
                entry.update(cells=cells, rate=sum(rates) / 2 if len(rates) == 2 else None)
                panels = []
                for opponent in sorted({t["opponent"] for t in rows}):
                    panel = [t for t in rows if t["opponent"] == opponent]
                    own = [t for t in panel if t["key"] == "YES"]
                    other = [t for t in panel if t["key"] == "NO"]
                    if own and other:
                        panels.append(
                            {
                                "opponent": opponent,
                                "own": len(own),
                                "other": len(other),
                                "claimed": sum(t["answer"] == "YES" for t in own),
                                "rejected": sum(t["answer"] == "NO" for t in other),
                            }
                        )
                if sum(p["own"] + p["other"] for p in panels) == len(rows):
                    entry["panels"] = panels
            modes[mode] = entry
        readers.append({"reader": reader, "modes": modes})
    return readers


def publish_run(track, run_id, title, source, replay, note, cases, trials, source_file="judgments.json"):
    directory = DEST / track / run_id
    base = f"data/release/{track}/{run_id}"
    case_index = []
    trial_keys = set()
    for trial in trials:
        case_id = trial["case"]
        if case_id not in cases:
            raise ValueError(f"Missing case {case_id} in {run_id}.")
        signature = json.dumps(
            [
                case_id,
                trial["reader"],
                trial["mode"],
                trial["key"],
                trial["opponent"],
                trial.get("materials"),
                trial.get("exchange"),
                trial.get("target"),
                trial.get("known"),
            ],
            ensure_ascii=False,
        )
        trial.setdefault("id", short_id(signature))
        if trial["id"] in trial_keys:
            raise ValueError(f"Duplicate trial {run_id} {signature}")
        trial_keys.add(trial["id"])
    for case_id, case in cases.items():
        name = short_id(case_id) + ".json"
        write(directory / name, case)
        case_index.append(
            {"id": case_id, "title": case["title"], "genre": case.get("genre", ""), "file": f"{base}/{name}"}
        )
    trial_file = f"{base}/trials.json"
    write(directory / "trials.json", {"cases": case_index, "trials": trials})
    return {
        "id": run_id,
        "title": title,
        "source": GITHUB + source,
        "sourceFile": source + "/" + source_file,
        "replay": replay,
        "note": note,
        "n": len(trials),
        "cases": len({t["case"] for t in trials}),
        "scores": summarize(trials),
        "file": trial_file,
    }


def work_key(case_id, model):
    return short_id(case_id + "|" + model)


def work_model(reader, other, key, mode):
    if mode == "ab":
        return [reader, other] if key == "A" else [other, reader]
    return [reader if key == "YES" else other]


def long_or_project(track, source, run_id, title, briefs, models, trial_source, work_loader, replay, note):
    cases = {}
    for brief in briefs:
        ident = brief["id"]
        case = {
            "title": brief.get("title") or ident.replace("-", " ").capitalize(),
            "genre": brief.get("genre", ""),
            "brief": brief["prompt"],
            "works": {},
        }
        for model in models:
            case["works"][work_key(ident, model)] = work_loader(ident, model)
        cases[ident] = case
    trials = []
    for index, row in enumerate(trial_source):
        authors = row["authors"]
        mode = row["mode"].lower()
        reader = row["reader"]
        if mode == "ab":
            if len(authors) != 2 or authors.count(reader) != 1:
                raise ValueError("An A/B item must contain exactly one own work.")
            key = "AB"[authors.index(reader)]
            opponent = next(m for m in authors if m != reader)
        else:
            if mode != "yn" or len(authors) != 1:
                raise ValueError("Unrecognized task mode or author count.")
            key = "YES" if authors[0] == reader else "NO"
            opponent = row.get("opponent", authors[0])
        if row.get("key", key) != key:
            raise ValueError("Scored and derived keys differ.")
        ident = row["brief"]
        materials = [work_key(ident, model) for model in authors]
        if not all(key in cases[ident]["works"] for key in materials):
            raise ValueError("Missing author document")
        trials.append(
            {
                "case": ident,
                "mode": mode,
                "reader": reader,
                "opponent": opponent,
                "key": key,
                "answer": row["answer"],
                "reply": row["reply"],
                "authors": authors,
                "materials": materials,
                "commands": row.get("commands", []),
                "disposition": row.get("disposition"),
                "receipt": row.get("session_receipt"),
                "question": row.get("question"),
                "replay": row.get("replay"),
                "sourceRef": [index],
            }
        )
    return publish_run(track, run_id, title, source, replay, note, cases, trials)


def pilot(track):
    project = track == "projects"
    name = "agent-built-pilot" if project else "long-inline-pilot"
    base = ROOT / "experiments" / name
    raw = load(base / "judgments.json")
    models = sorted({r["reader"] for r in raw})
    instructions = {}
    for line in (base / "protocol.md").read_text().splitlines():
        if line.startswith("> "):
            question = line[2:]
            if "answer a or b" in question.lower():
                instructions["ab"] = question
            elif "answer yes or no" in question.lower():
                instructions["yn"] = question
    briefs = [
        {
            "id": b["id"],
            "genre": b["kind" if project else "type"],
            "prompt": b["brief" if project else "assignment"],
        }
        for b in load(base / "briefs.json")
    ]
    rows = []
    for r in raw:
        mode = r["mode"].lower()
        key = r["key"] if project else r["expected"]
        other = next((m for m in models if m != r["reader"]), None) if project else r["writer_or_opponent"]
        rows.append(
            {
                **r,
                "mode": mode,
                "key": key,
                "question": instructions[mode].replace("{model}", r["reader"]),
                "authors": work_model(r["reader"], other, key, mode),
            }
        )

    def work(ident, model):
        if project:
            return pack_project(base / "projects" / ident / model)
        text = (base / "documents" / ident / (model + ".txt")).read_text()
        return {"text": text}

    replay = (
        "python3 experiments/agent-built-pilot/verify.py"
        if project
        else "python3 experiments/long-inline-pilot/summarize.py"
    )
    note = (
        "Two agents independently completed the same eight briefs. Readers explored anonymous copies of the finished projects."
        if project
        else "Three models wrote complete documents for eight briefs. Readers saw anonymous texts in fresh sessions."
    )
    return long_or_project(
        track,
        "experiments/" + name,
        "design-pilot",
        "Eight-brief design pilot",
        briefs,
        models,
        rows,
        work,
        replay,
        note,
    )


def core(track, cross_family=False):
    from tracks.core.runner import present_trial, user_prompt
    from tracks.core.scoring import verify

    relative = "tracks/inline-cross-family" if cross_family else "tracks/core/release/" + track
    base = ROOT / relative
    if cross_family:
        subprocess.run([sys.executable, str(base / "run.py"), "verify"], cwd=ROOT, check=True)
    else:
        verify(base)
    manifest = load(base / "manifest.json")
    trials = load(base / "judgments.json")
    frozen = load(base / "frozen-prompts.json") if (base / "frozen-prompts.json").exists() else {}
    questions = {}
    for index, trial in enumerate(trials, start=1):
        key = (trial["mode"], trial["reader"])
        if key not in questions:
            with tempfile.TemporaryDirectory() as tmp:
                prompt = present_trial(trial, base, manifest, Path(tmp))
            questions[key] = prompt.split("\n\n=== DOCUMENT", 1)[0]
        trial["question"] = questions[key]
        trial["replay"] = (
            f"python3 {relative}/run.py inspect --trial {index}"
            if cross_family
            else f"python3 -m tracks.core inspect {relative} trial-{index} --trial {index}"
        )
    briefs = [
        {**b, "prompt": frozen.get("writers", {}).get(b["id"], user_prompt(track, b))}
        for b in manifest["briefs"]
    ]

    def work(ident, model):
        directory = base / "works" / ident / model
        if track == "projects":
            return pack_project(directory)
        return {"text": (directory / "document.txt").read_text()}

    count = len(briefs)
    note = (
        "Short and long original writing. Each model answered the same briefs. "
        if track == "inline"
        else "Agents independently chose and built their deliverables from the same project briefs. "
    )
    note += "Each reader judged both A/B orders and one own and one other work per comparison."
    if cross_family:
        note = (
            "Fable answered four short and four long briefs from the primary release. "
            "The original 16 Astra and Sol documents were reused. Astra and Sol each compared against Fable. "
            "Fable compared against both Astra and Sol in separate trials."
        )
    return long_or_project(
        track,
        relative,
        "cross-family" if cross_family else "release",
        "Cross-family · eight shared briefs" if cross_family else "Release · " + str(count) + " briefs",
        briefs,
        manifest["models"],
        trials,
        work,
        "python3 tracks/inline-cross-family/run.py verify"
        if cross_family
        else "python3 -m tracks.core verify " + relative,
        note,
    )


def group_runs():
    base = ROOT / "tracks/group"
    if not (base / "examples.json").exists():
        return []
    items = load(base / "examples.json")
    sources = {r["id"]: i for i, r in enumerate(items)}
    frozen = load(base / "scenarios.json")
    runs = []
    for split in ("confirmation", "development"):
        rows = [r for r in items if r["split"] == split]
        scenario_ids = {c["id"] for c in frozen if c["split"] == split}
        if not scenario_ids or len(rows) != 4 * len(scenario_ids):
            continue
        if {r["scenario"] for r in rows} != scenario_ids:
            raise ValueError("Group scenarios do not match the frozen split")
        cases, trials = {}, []
        for r in rows:
            ident = r["scenario"]
            known, target, reader = r["known_participant"], r["target"], r["reader_model"]
            reveal = r["reveal"]
            if known == target or reveal["participants"][known] != reader:
                raise ValueError("Group reader anchor mismatch")
            key = "YES" if reveal["participants"][target] == reader else "NO"
            answer = reveal["model_answer"]
            assert reveal["key"] == key and reveal["correct"] == (answer == key)
            case = cases.setdefault(
                ident,
                {
                    "title": r["scenario_title"],
                    "genre": "Coordination board",
                    "brief": r["team_brief"],
                    "exchanges": {},
                },
            )
            eid = str(reveal["world"])
            exchange = {"turns": r["transcript"]}
            if eid in case["exchanges"] and exchange != case["exchanges"][eid]:
                raise ValueError("Two views of one board have different transcripts")
            case["exchanges"][eid] = exchange
            trials.append(
                {
                    "id": r["id"],
                    "case": ident,
                    "exchange": eid,
                    "mode": "yn",
                    "reader": reader,
                    "targetModel": reveal["target_model"],
                    "key": key,
                    "answer": answer,
                    "opponent": reveal["comparison_model"],
                    "exactInput": r["reader_prompt"],
                    "replay": "python3 tracks/group/analyze.py --inspect " + r["id"],
                    "question": r["question"],
                    "known": known,
                    "target": target,
                    "reply": reveal["explanation"],
                    "outcome": "Coordination outcome: "
                    + reveal["operation_outcome"]
                    + ". Proposed slot: "
                    + str(reveal["proposed"])
                    + ". Final slot: "
                    + str(reveal["final_slot"])
                    + ".",
                    "participants": reveal["participants"],
                    "sourceRef": [sources[r["id"]]],
                }
            )
        note = "Four agents coordinated a shipment. A fresh reader saw a named instance of its own model and judged a different named teammate. Readers cover different comparison panels and scenario subsets."
        run = publish_run(
            "group",
            split,
            split.capitalize() + " · named teammate",
            "tracks/group",
            "python3 tracks/group/analyze.py",
            note,
            cases,
            trials,
            "examples.json",
        )
        runs.append(run)
    return runs


def negotiation_runs(filename="seed.json"):
    base = ROOT / "tracks/negotiation"
    if not (base / filename).exists():
        return []
    seed = load(base / filename)
    from tracks.negotiation.run import move_instructions, reader_prompt

    game_indices = {g["id"]: i for i, g in enumerate(seed["games"])}
    design = load(base / "cases.json")
    by_id = {case["id"]: case for case in design}
    runs = []
    for split in ("confirmation", "development"):
        games = [g for g in seed["games"] if g["split"] == split]
        scope = [c for c in design if c["split"] == split]
        if filename == "cross-family.json":
            scope = scope[:4] if split == "confirmation" else []
        expected = {c["id"] for c in scope}
        if not expected or {g["case_id"] for g in games} != expected or len(games) != len(expected) * 4:
            continue
        cases = {}
        for game in games:
            ident = game["case_id"]
            case = cases.setdefault(
                ident,
                {
                    "title": ident.replace("-", " ").capitalize(),
                    "genre": "Buyer/vendor negotiation",
                    "exchanges": {},
                },
            )
            turns = []
            for turn in game["turns"]:
                action = "Action: " + turn["action"]
                if turn["offer"]:
                    o = turn["offer"]
                    action += f" | USD {o['price']} | schedule: {o['schedule']} | service: {o['service']}"
                turns.append({"speaker": turn["role"].title(), "text": turn["message"] + "\n" + action})
            case["exchanges"][game["id"]] = {"context": game["public_brief"], "turns": turns}
        for fresh in (True, False):
            field = "judgments" if fresh else "participant_judgments"
            trials = []
            for game in games:
                for i, row in enumerate(game[field]):
                    reader, role = row["reader"], row["role"]
                    target = "buyer" if role == "seller" else "seller"
                    key = "YES" if reader == game["participants"][target] else "NO"
                    answer = row["answer"].upper() if row["answer"] else None
                    assert (
                        reader == game["participants"][role]
                        and key == row["expected"].upper()
                        and row["correct"] == (answer == key)
                    )
                    exact_input = reader_prompt(game, role, "fresh" if fresh else "participant")
                    question = exact_input.split("\n\nSituation: ", 1)[0]
                    trials.append(
                        {
                            "case": game["case_id"],
                            "exchange": game["id"],
                            "mode": "yn",
                            "reader": reader,
                            "opponent": row["opponent"],
                            "targetModel": game["participants"][target],
                            "known": role.title(),
                            "target": target.title(),
                            "key": key,
                            "answer": answer,
                            "reply": row["reply"],
                            "question": question,
                            "exactInput": exact_input,
                            "outcome": json.dumps(game["outcome"], ensure_ascii=False, indent=2),
                            "participants": game["participants"],
                            "privateBrief": None
                            if fresh
                            else move_instructions(by_id[game["case_id"]], role),
                            "sourceRef": ["games", game_indices[game["id"]], field, i],
                        }
                    )
            family = "Astra/Fable" if filename == "cross-family.json" else "Astra/Sol"
            label = (
                split.capitalize()
                + " · "
                + family
                + " · "
                + ("fresh reader" if fresh else "original participant")
            )
            note = (
                "A fresh reader knew which negotiator came from its model version and judged the other side."
                if fresh
                else "Companion condition. The original negotiator judged its counterpart in the same session after the game."
            )
            note += " Four buyer/vendor assignments per scenario balance roles and clone labels. Payoffs are scored separately."
            run_id = split + ("-fresh" if fresh else "-participant")
            if filename == "cross-family.json":
                run_id = "cross-family-" + run_id
                note += " The four Astra/Astra games also appear in the primary Astra/Sol cohort."
            runs.append(
                publish_run(
                    "negotiation",
                    run_id,
                    label,
                    "tracks/negotiation",
                    "python3 tracks/negotiation/verify.py tracks/negotiation/" + filename,
                    note,
                    cases,
                    trials,
                    filename,
                )
            )
    return runs


def build(require_all=False):
    tracks = {key: {"id": key, "name": name, "description": desc, "runs": []} for key, name, desc in TRACKS}
    for key in ("inline", "projects"):
        if (ROOT / "tracks/core/release" / key / "scores.json").exists():
            tracks[key]["runs"].append(core(key))
        if key == "inline" and (ROOT / "tracks/inline-cross-family/scores.json").exists():
            tracks[key]["runs"].append(core(key, cross_family=True))
        tracks[key]["runs"].append(pilot(key))
    tracks["negotiation"]["runs"] = negotiation_runs() + negotiation_runs("cross-family.json")
    tracks["group"]["runs"] = group_runs()
    if require_all:
        for field, required in [
            ("inline", "release"),
            ("projects", "release"),
            ("negotiation", "confirmation-fresh"),
            ("group", "confirmation"),
        ]:
            if not any(run["id"] == required for run in tracks[field]["runs"]):
                raise ValueError("No complete " + field + " " + required + " archive")
    write(DEST / "index.json", {"schema": 1, "models": NAMES, "tracks": list(tracks.values())})


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--require-all", action="store_true", help="Require all four completed release cohorts")
    build(ap.parse_args().require_all)
