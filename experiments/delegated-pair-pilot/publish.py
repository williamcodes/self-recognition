"""Render the frozen pilot exercises for the static Pages site."""
from html import escape
from pathlib import Path
import json
import hashlib
from run import CASES, HERE, MODELS, reader_prompt

titles = ["Sharing a prototype with an outside lab", "Deleting data from backups",
          "What does “lead engineer” mean?", "Does flexible scheduling include overnight coverage?"]
sources = {
    "NDA": ("Luminance’s contract demonstration", "https://www.luminance.com/press/luminance-showcases-worldpowered-contract-negotiation/"),
    "Recruiting": ("Jack & Jill’s introduction workflow", "https://www.jackandjill.ai/docs/introductions"),
}
rows = json.loads((HERE / "results.json").read_text()) if (HERE / "results.json").exists() else []
out = ['''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Review the pilot questions · Self-Recognition</title><link rel="stylesheet" href="style.css"><link rel="stylesheet" href="release.css"></head>
<body class="release"><header><a class="wordmark" href="./"><span aria-hidden="true">Aa</span> Self-Recognition</a><nav><a href="./">Leaderboard</a></nav></header>
<main><section class="intro-task"><h1>Review the pilot questions</h1><p>Four original scenarios inspired by business workflows. Each agent represents one party and sees its own private brief. A fresh reader sees their exchange and judges the other representative’s identity.</p>''']
out.append('<ul>'+''.join(f'<li><a href="#{c["id"]}">{escape(title)}</a></li>' for c,title in zip(CASES,titles))+'</ul></section>')
if rows:
    out.append('<aside class="material"><h3>What to check</h3><p>All 16 conversations ended after two messages. In several recruiting exchanges the last message asks a question. The pilot stopped before the employer could reply. The 32 reader answers share just four briefs.</p></aside>')
for c,title in zip(CASES,titles):
    role = c["roles"]
    source,url = sources[c["track"]]
    out.append(f'<section id="{c["id"]}"><p class="meta">{c["track"]} pilot</p><h2>{escape(title)}</h2><p>{escape(c["context"])}</p><div class="material">')
    for r,b in zip(role,c["briefs"]):
        out.append(f'<details><summary>Private brief · {escape(r)}</summary><p>{escape(b)}</p></details>')
    out.append('</div>')
    matches = [r for r in rows if r["case"]==c["id"]]
    if not matches:
        q=reader_prompt(MODELS[0],c,0,"").strip()
        out.append(f'<h3>Reader question</h3><p>{escape(q)}</p><p>The generated exchange follows this question in the reader’s input. The four conversations for this case are being collected.</p>')
    matches.sort(key=lambda r: hashlib.sha256(json.dumps(r["messages"], sort_keys=True).encode()).digest())
    for n,r in enumerate(matches,1):
        # Stable neutral ordering prevents the preview titles from advertising author assignments.
        transcript="\n\n".join(m["role"]+": "+m["text"] for m in r["messages"])
        out.append(f'<details class="material"><summary>Read exchange {n} · {len(r["messages"])} messages</summary>')
        for m in r["messages"]:
            out.append(f'<div class="turn"><small>{escape(m["role"])}</small><p class="chat-text">{escape(m["text"])}</p></div>')
        for j in r["judgments"]:
            seat=j["anchor"]
            q=reader_prompt(j["reader"],c,seat,"").strip()
            out.append(f'<h3>Question for {escape(role[seat])}’s model</h3><p>{escape(q)}</p><details><summary>Reveal answer and model response</summary><p>Correct answer: {"YES" if r["writers"][0]==r["writers"][1] else "NO"}. The other representative was {escape(r["writers"][1-seat])}.</p><p class="reply">{escape(j["reply"])}</p></details>')
            # Showing the second anchor's model discloses the first one's answer.
            if seat==0:
                out.append('<details><summary>Show the reverse perspective (reveals the counterpart model)</summary>')
        out.append('</details></details>')
    out.append(f'<p><a href="{url}">Source inspiration: {escape(source)}</a></p></section>')
out.append('</main></body></html>')
(HERE.parents[1]/"docs"/"delegated-pilot.html").write_text("\n".join(out)+"\n")
