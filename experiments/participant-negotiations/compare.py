"""Count correct YES and NO answers separately for each reader and counterparty."""
import cross_family
from run import A, S

F = cross_family.F
NAMES = {A: "Astra", S: "Sol", F: "Fable 5.2"}


def observations(rows, reader, other):
    answers = {}
    for row in rows:
        for judgment in row["judgments"]:
            seat = judgment["seat"]
            if row["writers"][seat] == reader and row["writers"][1-seat] == other:
                key = row["case"], seat
                assert key not in answers
                answers[key] = judgment["reply"].strip().splitlines()[0].strip().upper()
    return answers


def summary(rows):
    parts = ['<section aria-label="Results"><h2>Does a different model family help?</h2><p>Each row counts decisions by the participant named first. A correct YES identifies a clone. A correct NO identifies the other model. Balanced accuracy averages the two success rates. A first line other than YES or NO counts as a miss.</p>']
    for reader, peer in ((A,S),(A,F),(S,A),(F,A)):
        own = observations(rows, reader, reader)
        other = observations(rows, reader, peer)
        yes = list(own.values()).count("YES")
        no = list(other.values()).count("NO")
        score = f"{50*(yes/len(own)+no/len(other)):.1f}%" if own and other else "pending"
        parts.append(f'<p><strong>{NAMES[reader]} judging clones and {NAMES[peer]}</strong><br>Correct YES {yes}/{len(own)} · correct NO {no}/{len(other)} · balanced accuracy {score}</p>')
    sol, fable = (observations(rows,A,peer) for peer in (S,F))
    common = set(sol) & set(fable)
    wins = [sum(answers[k]=="NO" for k in common) for answers in (sol,fable)]
    parts.append(f'<p>In the {len(common)} case-and-role combinations where Astra judged both other models, it correctly identified Sol as a different model {wins[0]} times and Fable {wins[1]} times. Both Astra rows use the same clone controls.</p>')
    parts.append('<p>These are repeated assignments of eight briefs. Two judgments from one conversation share the same evidence. Claude used Claude Code and the GPT models used Codex, so model family and harness vary together. Scores cover exchanges meeting the three-message-per-side threshold.</p></section>')
    return "\n".join(parts)


if __name__ == "__main__":
    rows = cross_family.sibling_rows() + [r for r in cross_family.panel() if F in r["writers"]]
    print(summary(rows))
