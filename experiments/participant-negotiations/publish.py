"""Generate the review page from the frozen cases and complete runs."""
from html import escape
import json
from hashlib import sha256
from run import HERE, CASES, QUESTION, RULE, counts, verify

from compare import summary

updates=json.loads((HERE/"signoff.json").read_text())
path=HERE/"signoff-results.json"
if not path.exists():
    path=HERE/"results.json"
rows=json.loads(path.read_text()) if path.exists() else []
if rows:
    verify(rows)
for batch in range(1,4):
    extra=HERE/f"final-{batch}.json"
    if extra.exists():
        rows.extend(json.loads(extra.read_text()))

for batch in range(3):
    extra=HERE/f"family-final-{batch}.json"
    if extra.exists():
        rows.extend(json.loads(extra.read_text()))

out=['''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Participant negotiations · Self-Recognition</title><link rel="stylesheet" href="style.css"><link rel="stylesheet" href="release.css"></head><body class="release"><header><a class="wordmark" href="./">Self-Recognition</a><nav><a href="delegated-pilot.html">Earlier pilot</a></nav></header><main><section class="intro-task"><h1>Participant negotiations</h1><p>Each case follows two representatives through a single negotiation. Once the exchange ends, each participant answers in the same session, with its own private brief and conversation history. Exchanges shorter than three messages from either side are retained as short cases and receive no identity question.</p>''']
out.append('<p><a href="negotiation-ab.html">Try the A/B comparison on these same conversations</a> · <a href="negotiation-scaling.html">See Astra’s results with up to 16 choices</a></p>')
out.append(f'<h2>The question after the conversation</h2><p class="prose">{escape(QUESTION)}</p>')
if rows:
    eligible=sum(bool(r["judgments"]) for r in rows)
    reopened=sum("reopened_at" in r for r in rows)
    if reopened:
        out.append(f'<p>{reopened} conversations initially ended below the threshold. Before any identity question, their users supplied a new issue during sign-off. The page marks that point and shows the private updates. Both parts took place in the same participant sessions.</p>')
    out.append(f'<p>{eligible} of {len(rows)} conversations met the message threshold. Each case uses a different pair of fictional principals. Within each case, the company, individual and private mandates stay fixed across model assignments. Different cases introduce different principals and tradeoffs. The sibling panel pairs Astra with Sol. The cross-family panel pairs Astra with Claude Fable 5.2. Each panel includes clone controls for both models and both role assignments for mixed pairs. These are repeated runs of eight scenarios.</p>')
out.append('<ul>'+''.join(f'<li><a href="#{c["id"]}">{escape(c["title"])}</a></li>' for c in CASES)+'</ul></section>')
if any("claude-fable-5-2" in r["writers"] for r in rows):
    out.append(summary(rows))
for c in CASES:
    out.append(f'<section id="{c["id"]}"><small>{c["track"]}</small><h2>{escape(c["title"])}</h2><p>{escape(c["context"])}</p><div class="material">')
    for role,brief in zip(c["roles"],c["private"]):
        out.append(f'<details><summary>{escape(role)} · private mandate</summary><p>{escape(brief)}</p></details>')
    out.append(f'<details><summary>Shared message instructions</summary><p>{escape(RULE)}</p></details></div>')
    group=[r for r in rows if r["case"]==c["id"]]
    group.sort(key=lambda r:sha256(json.dumps(r["messages"]).encode()).digest())
    for k,r in enumerate(group,1):
        out.append(f'<details class="material assignment"><summary>Exchange {k} of {len(group)} · {len(r["messages"])} messages</summary>')
        num=counts(r,c)
        out.append('<p>'+ ' · '.join(f'{escape(role)}: {n} messages, {sum(len(m["text"].split()) for m in r["messages"] if m["seat"]==s)} words' for s,(role,n) in enumerate(zip(c["roles"],num)))+'</p>')
        out.append('<details class="material"><summary>Read the conversation</summary>')
        for n,m in enumerate(r["messages"]):
            if n==r.get("reopened_at"):
                out.append('<h3>Sign-off follow-up</h3><details><summary>Private updates from the users</summary>')
                for role,note in zip(c["roles"],updates[c["id"]]):
                    out.append(f'<p><strong>{escape(role)}</strong> · {escape(note)}</p>')
                out.append('</details>')
            out.append(f'<div class="turn"><small>{escape(c["roles"][m["seat"]])}</small><p class="chat-text">{escape(m["text"])}</p></div>')
        out.append('</details>')
        if r["judgments"]:
            out.append('<details class="material"><summary>Reveal identities and participant answers</summary>')
            for j in r["judgments"]:
                seat=j["seat"]
                out.append(f'<h3>{escape(c["roles"][seat])} · {escape(r["writers"][seat])}</h3><p class="reply">{escape(chr(10).join(line.rstrip() for line in j["reply"].splitlines()))}</p>')
            out.append('<p>Correct answer: '+('YES' if r["writers"][0]==r["writers"][1] else 'NO')+'.</p></details>')
        else:
            out.append('<p>Short conversation. Neither participant received the identity question.</p>')
        out.append('</details>')
    out.append('</section>')
out.append('</main></body></html>')
(HERE.parents[1]/"docs/participant-negotiations.html").write_text("\n".join(out)+"\n")
