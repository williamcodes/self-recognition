"""Generate the size curve and blinded review examples from verified reader outputs."""
from collections import Counter
import sibling
from html import escape
import json
from scaling_reader import A,CASES,HERE,OUT,IDS,NAMES,evaluate,jobs,picked,filename

DISPLAY=dict(zip(NAMES,["Astra","Fable 5.2","GLM 5.3","Mistral Large 4","Gemini Carbon","Qwen4 Max","DeepSeek V4 Pro","MiniMax M3","Grok 4.7","Kimi K3.1 Pro","Command A+","Llama 4 Maverick","Nemotron 3 Ultra","Solar Pro 4","MiMo V2.6 Pro","Step 5 Preview"]))


def publish():
    sibling.verify()
    runs={}
    for path in sorted(OUT.glob("judgments-*.json")):
        names=path.stem.split("-")[1:]
        runs[tuple(names)]=evaluate(names)
    sizes=[k for k in (2,4,8,16) if tuple(NAMES[:k]) in runs]
    if not sizes:raise ValueError("Missing size curve")
    largest=runs[tuple(NAMES[:max(sizes)])]
    matched={(r["case"],r["seat"]) for r in largest}
    out=['''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Astra against a cross-family panel · Self-Recognition</title><link rel="stylesheet" href="style.css"><link rel="stylesheet" href="release.css"></head><body class="release"><header><a class="wordmark" href="./">Self-Recognition</a><nav><a href="negotiation-ab.html">Original A/B pilot</a></nav></header><main><section class="intro-task"><h1>Can Astra find its clone as the lineup grows?</h1><p><a href="negotiation-count.html">What happens when the number of clones is unknown?</a></p><p>One counterparty in each lineup is Astra. Every other one comes from a different model family. Astra sees complete negotiations from the same brief and role, including examples of its own model’s writing labeled YOUR SIDE. Fresh sessions see each candidate in every position.</p>''']
    for k in sizes:
        rows=runs[tuple(NAMES[:k])]
        subset=[r for r in rows if (r["case"],r["seat"]) in matched]
        hit=sum(picked(r)==A for r in subset)
        out.append(f'<p><strong>{k} choices</strong> · {hit}/{len(subset)} correct ({hit/len(subset):.1%}); chance {1/k:.1%}.')
        if len(subset)!=len(rows):out.append(f' All eligible cases: {sum(picked(r)==A for r in rows)}/{len(rows)}.')
        out.append('</p>')
    out.append(f'<p>The matched figures use {len(matched)} case-and-role combinations at every size. Reordering a lineup tests position effects on the same evidence. More choices also mean more text.</p></section>')
    out.append('<section><h2>Two-choice controls</h2>')
    for name in NAMES[1:4]:
        rows=runs.get(("astra",name),[])
        subset=[r for r in rows if (r["case"],r["seat"]) in matched]
        if subset:
            out.append(f'<p>Astra versus {DISPLAY[name]}: {sum(picked(r)==A for r in subset)}/{len(subset)} correct on the matched briefs.</p>')
    out.append('</section>')
    paid=[json.loads(path.read_text()) for n in NAMES[2:] for path in (OUT/n).glob("*.json")]
    capped=sum(r["ending"]=="turn cap" for r in paid)
    repeats=sum("replacement_reason" in r for r in paid)
    out.append(f'<section><h2>Where the conversations came from</h2><p>The original pilot supplied the Astra and Fable transcripts. We generated {len(paid)} additional negotiations with OpenRouter counterparties. In {capped} the runner closed the exchange at its turn limit. We repeated {repeats} after a participant invoked a tool. Each published transcript includes every public message through its endpoint.</p></section>')
    for k in sizes:
        names=NAMES[:k]
        rows=runs[tuple(names)]
        tally=Counter(picked(r) for r in rows)
        out.append(f'<section><h2>{k} choices</h2><p>Selections across all eligible lineups: '+', '.join(f'{DISPLAY[n]} {tally[IDS[n]]}' for n in names)+f'. Invalid answers: {tally["invalid"]}.</p>')
        examples={}
        for idx,(r,(_,prompt)) in enumerate(zip(rows,jobs(names),strict=True)):
            key=(r["case"],r["seat"])
            if key not in examples:examples[key]=[]
            examples[key].append((r,prompt))
        for i,((cid,seat),rotations) in enumerate(examples.items()):
            r,prompt=rotations[i%len(rotations)]
            c=next(c for c in CASES if c["id"]==cid)
            identities=', '.join(f'{letter}: {escape(model)}' for letter,model in zip("ABCDEFGHIJKLMNOP",r["order"]))
            prompt_head,separator,first=prompt.partition("\nConversation A:\n")
            assert separator
            sections=[]
            text=first
            for pos in range(1,len(names)):
                letter="ABCDEFGHIJKLMNOP"[pos]
                previous,sep,text=text.partition(f"\nConversation {letter}:\n")
                assert sep
                sections.append(previous)
            sections.append(text)
            transcript_html=''.join(f'<details><summary>Conversation {label}</summary><p class="chat-text">{escape(body)}</p></details>' for label,body in zip("ABCDEFGHIJKLMNOP",sections))
            out.append(f'<details class="material"><summary>{escape(c["title"])} · {escape(c["roles"][seat])}</summary><details><summary>Try the lineup</summary><p>{escape(prompt_head)}</p>{transcript_html}</details><details><summary>Reveal the identities and Astra’s answer</summary><p>{identities}</p><p class="chat-text">{escape(r["reply"])}</p></details></details>')
        out.append('</section>')
    sibling_rows=json.loads((HERE/"choices-sol.json").read_text())
    same_roles=[r for r in sibling_rows if (r['case'],r['seat']) in matched]
    out.append(f'<section><h2>Sibling comparison</h2><p>Against Sol, Astra picked itself {sum(picked(r)==A for r in sibling_rows)}/{len(sibling_rows)} times across 14 case-and-role pairs shown in both orders. On the cases and roles used in the matched curve, Astra scored {sum(picked(r)==A for r in same_roles)}/{len(same_roles)} against Sol.</p></section></main></body></html>')
    page='\n'.join(out)
    (HERE.parents[1]/"docs/negotiation-scaling.html").write_text('\n'.join(line.rstrip() for line in page.splitlines())+'\n')


if __name__=="__main__":
    publish()
