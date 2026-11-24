"""Check protocol invariants and scores in a published run without calling models."""
import hashlib
import itertools
import json
import sys
from collections import Counter
from pathlib import Path
from score import decision
from benchmark import CONDITIONS, ROOT, WRITE

def check(path):
    run = json.loads(Path(path).read_text())
    manifest, corpus, trials = run["manifest"], run["corpus"], run["trials"]
    prompts = manifest["prompts"]
    assert prompts == json.loads((ROOT / "prompts.json").read_text())
    assert manifest["runner_sha256"] == hashlib.sha256((ROOT / "benchmark.py").read_bytes()).hexdigest()
    assert manifest["write_instruction"] == WRITE
    assert set(manifest["models"]) == set(corpus)
    for samples in corpus.values():
        assert len(samples) == len(prompts) and all(p.strip() for p in samples)
    expected_keys = set(itertools.product(corpus, CONDITIONS, range(len(prompts))))
    assert len(trials) == len(expected_keys)
    balances = {}
    for t in trials:
        m, c, i = t["model"], t["condition"], t["prompt_index"]
        expected_keys.remove((m,c,i))
        paired = c.endswith("_ab")
        labels = ("A","B") if paired else ("YES","NO")
        assert t["expected"] in labels and t["answer"] in (*labels, None)
        assert t["correct"] == (t["answer"] == t["expected"])
        assert t["foil"] != m and t["foil"] in corpus
        balances.setdefault((m,c), Counter())[t["expected"]] += 1
        authors = [m,t["foil"]] if t["expected"] == labels[0] else [t["foil"],m]
        if not paired:
            authors = authors[:1]
        if c.startswith("passage"):
            assert not t["opened"]
            for label, author in zip("AB",authors):
                assert f"Passage {label}:\n{corpus[author][i]}\n" in t["messages"][0]["content"]
        else:
            assert len(set(t["opened"])) == len(t["opened"])
            for n, file in enumerate(t["opened"]):
                folder, name = file.split("/")
                assert folder in "AB"[:len(authors)] and name in ("1.txt","2.txt")
                index = (i + int(name[0]) - 1) % len(prompts)
                content = corpus[authors["AB".index(folder)]][index]
                assert t["messages"][2*n+2]["content"].startswith(f"Contents of {file}:\n{content}\n")
        if "scoring" in run:
            assert run["scoring"] == "explicit-label-v1"
            assert t["decision"] == decision(t)
            assert t["decision_correct"] == (t["decision"] == t["expected"])
        last = t["messages"][-1]
        assert last["role"] == "assistant"
        parsed = last["content"].strip().upper().rstrip(".")
        assert t["answer"] == (parsed if parsed in labels else None)
    for counts in balances.values():
        assert sorted(counts.values()) == [len(prompts)//2, len(prompts)//2]
    print(f"Verified {len(corpus)} models, {len(trials)} trials and {len(balances)} balanced cells.")

if __name__ == "__main__":
    check(sys.argv[1])
