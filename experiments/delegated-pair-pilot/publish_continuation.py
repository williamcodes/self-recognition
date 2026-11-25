"""Render the paired follow-up and its anonymous reader evidence."""
import json
from html import escape
from continuation import HERE, CASES, CASES_BY_ID, bundle_prompt, digest
from run import reader_prompt

data=json.loads((HERE/"continuation-results.json").read_text())
rows=data["rows"]
titles=["Sharing a prototype with an outside lab","Deleting data from backups","What does “lead engineer” mean?","Does flexible scheduling include overnight coverage?"]
out=['''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Continued conversations · Self-Recognition</title><link rel="stylesheet" href="style.css"><link rel="stylesheet" href="release.css"></head><body class="release"><header><a class="wordmark" href="./">Self-Recognition</a><nav><a href="delegated-pilot.html">Original pilot</a></nav></header><main><p><a href="participant-negotiations.html">Review the new single-conversation participant pilot →</a></p><section class="intro-task"><h1>When the recipient can reply</h1><p>These are the same agents, briefs and first two messages as the original pilot. Each recipient could answer or end the thread without sending a courtesy message. Fresh readers judged each exchange. A separate set of readers saw four exchanges together.</p>''']
continued=sum(len(r["messages"])>2 for r in rows)
out.append(f'<p>{continued} of 16 conversations continued past the original cutoff.</p><ul>')
for c,t in zip(CASES,titles):
    out.append(f'<li><a href="#{c["id"]}">{escape(t)}</a></li>')
out.append('<li><a href="#bundled">Read a four-exchange question</a></li></ul></section>')
for c,title in zip(CASES,titles):
    out.append(f'<section id="{c["id"]}"><h2>{escape(title)}</h2><p>{escape(c["context"])}</p><a href="delegated-pilot.html#{c["id"]}">Original exchanges and private briefs</a>')
    group=[r for r in rows if r["case"]==c["id"]]
    for n,r in enumerate(sorted(group,key=lambda r:digest(r["messages"])),1):
        out.append(f'<details class="material"><summary>Exchange {n} · {len(r["messages"])} messages</summary>')
        for i,m in enumerate(r["messages"]):
            if i==2: out.append('<h3>After the original cutoff</h3>')
            out.append(f'<div class="turn"><small>{escape(m["role"])}</small><p class="chat-text">{escape(m["text"])}</p></div>')
        end='The recipient chose to send no further reply.' if r["ending"]=="recipient finished" else 'The exchange reached the turn cap.'
        out.append(f'<p>{end}</p>')
        j=r["judgments"][0]
        question=reader_prompt(j["reader"],c,0,"").strip()
        key="YES" if r["writers"][0]==r["writers"][1] else "NO"
        out.append(f'<h3>Reader question</h3><p>{escape(question)}</p><details><summary>Reveal the authors and both judgments</summary><p>Correct answer: {key}. {escape(", ".join(f"{role}: {writer}" for role,writer in zip(c["roles"],r["writers"])))}</p>')
        for j in r["judgments"]:
            out.append(f'<p class="reply">{escape(c["roles"][j["anchor"]])}’s model: {escape(j["reply"])}</p>')
        out.append('</details></details>')
    out.append('</section>')
out.append('<section id="bundled"><h2>Four exchanges, one judgment</h2><p>Each side is written by the same model version across all four conversations in a question. The roles change between scenarios. These eight judgments reuse the conversations above.</p>')
for n,b in enumerate(sorted(data["bundles"],key=lambda b:digest(b["session_hash"])),1):
    selected=[r for r in rows if r["writers"]==b["writers"]]
    q=bundle_prompt(selected,b["anchor"])
    words=sum(len(m["text"].split()) for r in selected for m in r["messages"] if m["role"]==CASES_BY_ID[r["case"]]["roles"][1-b["anchor"]])
    key="YES" if b["writers"][0]==b["writers"][1] else "NO"
    out.append(f'<details class="material"><summary>Question {n} · {words} words from the counterpart</summary><p class="chat-text">{escape(q)}</p><details><summary>Reveal answer</summary><p>Correct answer: {key}.</p><p class="reply">{escape(b["reply"])}</p></details></details>')
out.append('</section></main></body></html>')
(HERE.parents[1]/'docs'/'delegated-continuation.html').write_text('\n'.join(out)+'\n')
