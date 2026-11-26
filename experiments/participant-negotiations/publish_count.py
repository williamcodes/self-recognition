"""Render the unknown-count pilot and its matched negotiation lineups."""
from html import escape
import json
from clone_count import OUT,HERE,CASES,PEERS,inputs,trials,score,answer
from collections import Counter
from independent_count import INSTRUCTION, evaluate
from swap_fable import evaluate_swap, jobs as swap_jobs

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
    followup=evaluate("verify")
    by_lineup={r["transcript_hash"]:r for r in followup}
    parts.append(f'<section id="independent"><h2>Does asking Astra to judge independently help?</h2><p>Fresh sessions saw the same 35 zero-to-four lineups with this instruction added:</p><blockquote>{escape(INSTRUCTION)}</blockquote>')
    for label,group in (("Original prompt",[r for r in rows if r["condition"]=="zero"]),("Added instruction",followup)):
        empty=score([r for r in group if r["truth"]=="NONE"])
        present=score([r for r in group if r["truth"]!="NONE"])
        parts.append(f'<p><strong>{label}</strong> · Correct NONE answers: {empty["exact"]}/7. Nonempty lineups entirely correct: {present["exact"]}/28. Actual clones selected: {present["tp"]}/70.</p>')
    parts.append('</section>')
    swaps=evaluate_swap("verify")
    correct=sum(answer(r)==set() for r in swaps)
    parts.append(f'<section id="fable-swap"><h2>What if Fable is absent?</h2><p>We replaced the Astra/Fable conversation with an Astra/Qwen4 Max conversation on the same brief, in the same role and letter position. The other three conversations and the independent-judgment prompt stayed identical. Every correct answer was NONE.</p><p>With Fable: 0/7 correct. With Qwen4 Max: {correct}/7 correct.</p>')
    for r,(_,prompt) in zip(swaps,swap_jobs(),strict=True):
        c=next(c for c in CASES if c["id"]==r["case"])
        slot=next(l for l,name in r["order"].items() if name=="qwen")
        parts.append(f'<details><summary>{escape(c["title"])}</summary><p>Fable previously occupied position {slot}. New lineup: '+', '.join(f'{l}: {name}' for l,name in r["order"].items())+f'.</p><p class="chat-text">{escape(r["reply"])}</p><details><summary>Read the exact revised prompt</summary><p class="chat-text">{escape(prompt)}</p></details></details>')
    parts.append('</section>')
    cases={}
    false_positives=Counter()
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
            identities={}
            case_data=next(c for c in CASES if c["id"]==row["case"])
            pool=inputs(case_data,row["seat"],PEERS)
            for index,label in enumerate("ABCD"):
                if index<3:
                    body,sep,content=content.partition(f'\nConversation {"ABCD"[index+1]}:\n')
                    assert sep
                else:body=content
                if row["truth"]!="NONE" and label in row["truth"]:
                    identities[label]="Astra"
                else:
                    matches=[r["writers"][1-row["seat"]] for r in pool.values() if all(m["text"] in body for m in r["messages"])]
                    assert len(matches)==1
                    identities[label]=matches[0]
                parts.append(f'<details><summary>Conversation {label}</summary><p class="chat-text">{escape(body)}</p></details>')
            parts.append(f'<details><summary>Reveal the clones and Astra’s judgments</summary><p>Correct selection: {row["truth"]}</p>')
            parts.append('<p>'+', '.join(f'{label}: {escape(m)}' for label,m in identities.items())+'</p>')
            if row["truth"]=="NONE":
                for label in answer(row) or set():
                    false_positives[identities[label]]+=1
            for r,_ in versions:
                parts.append(f'<h3>{LABELS[r["condition"]]}</h3><p class="chat-text">{escape(r["reply"])}</p>')
            parts.append(f'<h3>Zero to four with independent judgment instruction</h3><p class="chat-text">{escape(by_lineup[key]["reply"])}</p></details></details>')
        parts.append('</section>')
    parts.insert(1,'<p>With the original zero-to-four prompt and four other models, Astra selected '+', '.join(f'{escape(m)} {n} times' for m,n in false_positives.items())+'.</p>')
    parts.append('</main></body></html>')
    text='\n'.join(parts)
    (HERE.parents[1]/"docs/negotiation-count.html").write_text('\n'.join(line.rstrip() for line in text.splitlines())+'\n')


if __name__=="__main__":
    publish()
