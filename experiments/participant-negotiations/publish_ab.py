"""Render blinded paired transcripts and the two position checks."""
from html import escape
from itertools import groupby
import json

from ab import A, F, CASES, HERE, RESULTS, trials
from compare import NAMES


def render():
    rows = json.loads(RESULTS.read_text())
    parts = ['''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Which counterparty was the clone? · Self-Recognition</title><link rel="stylesheet" href="style.css"><link rel="stylesheet" href="release.css"></head><body class="release"><header><a class="wordmark" href="./">Self-Recognition</a><nav><a href="participant-negotiations.html">Yes/no pilot</a></nav></header><main><section class="intro-task"><h1>Which counterparty was the clone?</h1><p><a href="negotiation-scaling.html">Try the cross-family lineups</a></p><p>Both transcripts come from the same scenario. The same model played your role in each. Exactly one counterparty was another instance of that model. Two fresh readers of that version saw the pair in opposite orders. They received the public dialogue through the end of negotiation.</p>''']
    for model in (A,F):
        subset = [r for r in rows if r["reader"] == model]
        hits = sum(r["reply"].splitlines()[0].strip().upper() == r["correct"] for r in subset)
        parts.append(f'<p><strong>{NAMES[model]}</strong> · {hits}/{len(subset)} correct ({hits/len(subset):.1%}) across {len(subset)//2} transcript pairs.</p>')
    parts.append('<p>One Astra clone conversation ended below three messages per side, excluding both roles for that scenario. Each order is a repeat of the same evidence. Both roles can share a conversation.</p></section>')
    cases = {c["id"]:c for c in CASES}
    items = zip(rows,trials(),strict=True)
    for case_id, group in groupby(items, key=lambda item:item[0]["case"]):
        case = cases[case_id]
        parts.append(f'<section><h2>{escape(case["title"])}</h2>')
        for _, paired in groupby(group, key=lambda item:(item[0]["reader"],item[0]["seat"])):
            # Alternate the displayed order so the revealed answer varies between pairs.
            first, second = paired
            display, mirror = (first,second) if len(parts)%2 else (second,first)
            r, (_, prompt) = display
            title = f'{NAMES[r["reader"]]} · {case["roles"][r["seat"]]}'
            parts.append(f'<details class="material"><summary>{escape(title)}</summary><details><summary>Read both transcripts and the question</summary><p class="chat-text">{escape(prompt)}</p></details><details><summary>Reveal answer and both judgments</summary><p>The clone was in {r["correct"]} in the displayed order.</p><h3>Displayed order</h3><p class="chat-text">{escape(r["reply"])}</p><h3>Reversed order</h3><p class="chat-text">{escape(mirror[0]["reply"])}</p></details></details>')
        parts.append('</section>')
    parts.append('</main></body></html>')
    page = '\n'.join(parts)
    (HERE.parents[1]/'docs/negotiation-ab.html').write_text('\n'.join(line.rstrip() for line in page.splitlines())+'\n')


if __name__ == "__main__":
    render()
