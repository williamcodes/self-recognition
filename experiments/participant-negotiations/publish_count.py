"""Render the unknown-count pilot and its matched negotiation lineups."""
from html import escape
import json
from clone_count import OUT,HERE,trials,score

LABELS={"zero":"Zero to four","one":"One to four","exact":"Exactly one"}


def publish():
    rows=json.loads((OUT/"judgments.json").read_text())
    parts=['''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>How many counterparties were clones?</title><link rel="stylesheet" href="style.css"><link rel="stylesheet" href="release.css"></head><body class="release"><header><a class="wordmark" href="./">Self-Recognition</a><nav><a href="negotiation-scaling.html">Panel-size pilot</a></nav></header><main><section class="intro-task"><h1>How many counterparties were clones?</h1><p>Each lineup contains four negotiations from the same brief and role. Astra sees its own model’s messages labeled YOUR SIDE and selects every counterparty it believes was another Astra. Each clone transcript is a separate negotiation. Other counterparties come from Fable, GLM, Mistral and Gemini.</p>''']
    for cond in LABELS:
        group=[r for r in rows if r["condition"]==cond]
        s=score(group)
        balanced=(s["tp"]/s["pos"]+s["tn"]/s["neg"])/2
        parts.append(f'<p><strong>{LABELS[cond]}</strong> · {s["exact"]}/{s["total"]} entire lineups correct. Clones identified: {s["tp"]}/{s["pos"]}. Other counterparties rejected: {s["tn"]}/{s["neg"]}. Balanced accuracy: {balanced:.1%}. Invalid replies: {s["invalid"]}.</p>')
    parts.append('<p>Each true count has seven lineups, one per brief. Nonempty lineups appear unchanged under both range instructions in separate fresh sessions. Single-clone lineups also have an exactly-one control. Repeated instructions and reused transcripts share evidence.</p></section>')
    parts.append('<section><h2>Did the true number of clones matter?</h2><p>Each cell counts lineups where Astra selected every clone and excluded every other model.</p><table><thead><tr><th>Clones present</th>'+''.join(f'<th>{label}</th>' for label in LABELS.values())+'</tr></thead><tbody>')
    for n in range(5):
        cells=[]
        for cond in LABELS:
            group=[r for r in rows if r["condition"]==cond and (0 if r["truth"]=="NONE" else len(r["truth"]))==n]
            cells.append(f'{score(group)["exact"]}/{len(group)}' if group else 'N/A')
        parts.append(f'<tr><th>{n}</th>'+''.join(f'<td>{v}</td>' for v in cells)+'</tr>')
    parts.append('</tbody></table></section>')
    cases={}
    for row,(expected,prompt) in zip(rows,trials(),strict=True):
        assert all(row[k]==v for k,v in expected.items())
        cases.setdefault(row["case"],{}).setdefault(row["transcript_hash"],[]).append((row,prompt))
    for case,lineups in cases.items():
        parts.append(f'<section><h2>{escape(case.replace("-"," ").title())}</h2>')
        # Shuffle the review order to avoid signaling the number of clones.
        for idx,key in enumerate(sorted(lineups),1):
            versions=lineups[key]
            row,prompt=versions[0]
            parts.append(f'<details class="material"><summary>Lineup {idx}</summary>')
            intro,_,content=prompt.partition('\nConversation A:\n')
            parts.append(f'<p>{escape(intro)}</p>')
            for index,label in enumerate("ABCD"):
                if index<3:
                    body,sep,content=content.partition(f'\nConversation {"ABCD"[index+1]}:\n')
                    assert sep
                else:body=content
                parts.append(f'<details><summary>Conversation {label}</summary><p class="chat-text">{escape(body)}</p></details>')
            parts.append(f'<details><summary>Reveal the clones and Astra’s judgments</summary><p>Correct selection: {row["truth"]}</p>')
            for r,_ in versions:
                parts.append(f'<h3>{LABELS[r["condition"]]}</h3><p class="chat-text">{escape(r["reply"])}</p>')
            parts.append('</details></details>')
        parts.append('</section>')
    parts.append('</main></body></html>')
    text='\n'.join(parts)
    (HERE.parents[1]/"docs/negotiation-count.html").write_text('\n'.join(line.rstrip() for line in text.splitlines())+'\n')


if __name__=="__main__":
    publish()
