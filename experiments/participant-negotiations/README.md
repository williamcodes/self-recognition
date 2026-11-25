# Participant negotiation pilot

This pilot asks each representative one identity question in its original conversation. The participant keeps its own private mandate, authored messages and the messages it received. It sees a single counterparty. The other representative’s model name and answer are withheld. If a turn cap leaves one last incoming message undelivered, the runner supplies it immediately before the question.

The four recruiting cases involve different candidates, employers and roles. The four NDA cases involve different projects and confidentiality problems. The situations and all dialogue are original simulations. The recruiting briefs extend [Jack & Jill’s introduction workflow](https://www.jackandjill.ai/docs/introductions) into offer discussions. The NDA briefs draw on [Luminance’s contract negotiation demonstration](https://www.luminance.com/press/luminance-showcases-worldpowered-contract-negotiation/). The texts are research samples.

Each track includes the four ordered pairings of Astra and Sol, all four per scenario. Every scenario has two independently initialized subscription sessions. The first pass assigned one pairing per case. Three additional batches supply the other pairings without rerunning any completed assignment. Across eight distinct scenarios this produces 32 separate conversations. The four runs of one scenario share the private mandates and public brief. Sign-off issues are conditional on a short first pass, so their frequency can vary across pairings. Each conversation produces two related judgments with the same ground truth.

The first pass allows either party to end a completed exchange and retains every exchange. The question is asked once per participant if each has written at least three messages. The numerical filter counts nonempty public messages; readers can inspect their substance. For short exchanges, a separately specified follow-up introduces a sign-off issue in the original sessions before either has received the identity question. The unchanged first pass and the sign-off versions are both saved. A short thread may still be an appropriate resolution of the underlying business task.

Inspect the final cases and read the turns and role mandates on the [pilot page](https://williamcodes.github.io/self-recognition/participant-negotiations.html). To reproduce both sets of counts from the repository root:

```sh
cd experiments/participant-negotiations
python3 matched.py
python3 run.py
python3 -c 'import json; from run import verify; verify(json.load(open("signoff-results.json")))'
```

On the collection machine, `audit_receipts.py STATE` checks every first-pass prompt, session and reply against private receipts. `signoff.py --offline --state STATE` reconstructs the follow-ups and decisions from those receipts. The public records use hashed participant session identifiers.
