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

The cross-family panel repeats all eight briefs with Claude Fable 5.2 and Astra in both role orders, plus Fable/Fable. It reuses the eight Astra/Astra controls from the sibling panel. Together the panels schedule 56 distinct conversations. Both CLI providers use subscriptions with tools disabled. Claude Code and Codex have different system instructions, so differences cannot be attributed to the model family alone. Run `python3 cross_family.py` to check the assignments and `python3 compare.py` to reproduce the participant scores and the comparison on common case/role combinations.

The scoring parser accepts YES or NO alone on the first nonblank line, ignoring case and surrounding whitespace. Other first lines count as misses. The message-count gate operates before the identity question. In reviewing substance, a message counts if it asks or resolves an open question, changes or declines a term, commits to a specific package, or communicates a substantive decision. A bare courtesy acknowledgment supplies no such evidence.

### Forced-choice counterparties

The A/B follow-up uses the same final conversations as the cross-family yes/no panel. For each reader, scenario and role, one transcript pairs that reader’s model with itself and the other pairs it with the other model. Both full public exchanges must meet the original three-message threshold for each party. Fresh subscription sessions receive the same pair in each order, without private mandates, model names, yes/no answers or provider metadata. First-line A/B accuracy counts invalid answers as misses. Roles, orders and scenarios reuse evidence. Treat the mirrored results as a position check and the aggregate as descriptive. The switch from same-session yes/no to fresh-session A/B also changes how evidence is presented.

Run `python3 ab.py` to validate the public results against the prompts and print the counts. Run `python3 publish_ab.py` to regenerate the [A/B review page](https://williamcodes.github.io/self-recognition/negotiation-ab.html).

### Cross-family scaling pilot

Astra judges nested lineups of complete negotiations. Its own exact version appears once, and each distractor comes from a different model family. The separate Astra/Sol control measures confusion within a family. Provider and family vary together. The reader receives the public dialogue including the writing labeled YOUR SIDE. Rotations of one lineup share evidence.

The Astra and Fable conversations come from the original pilot. OpenRouter supplies the additional counterparties, who negotiate with Astra under the original mandates and sign-off procedure. We omit the post-negotiation yes/no question when generating new material. Each transcript needs three messages per side. We retain ineligible transcripts. The Caldera Water clone control was too short for either role. The collection schedule takes one role per remaining brief before repeating roles.

The nested ordering is Astra and Fable, followed by GLM and Mistral at four, then Gemini, Qwen Max, DeepSeek and MiniMax at eight. The sixteen-choice roster adds Grok, Kimi, Cohere, Llama, Nemotron, Solar Pro 4, MiMo and Step 5 Preview. Nova Premier returned an OpenRouter 404 before collection, so Step fills that slot. Hunyuan repeatedly hit a 16,384-token writer cap without a public reply, so Solar Pro 4 fills its slot. Both decisions preceded the first sixteen-choice reader judgment. Each candidate occupies every position in a fresh session. Letter-only first-line scoring includes invalid responses as misses. Input length grows with lineup size. A score below 100% shows errors; chance performance is a different claim. Results describe this panel and these briefs.

The 2/4/8/16 headline comparison uses the intersection of eligible case-and-role lineups. The larger panels use one role from each of seven different briefs. Every displayed count includes all rotations for that lineup size. See the [scaling results and blinded lineups](https://williamcodes.github.io/self-recognition/negotiation-scaling.html). `publish_scaling.py` verifies the public prompts and rebuilds the page. On the collection machine, `audit_scaling.py` also checks original writer and reader receipts.

The collector retries an incomplete OpenRouter turn before delivering any text to the other party. Some writers exhausted the initial token allowance in hidden reasoning. For recovery the collector can increase the output allowance or request a lower reasoning budget. If a subscription writer invoked a tool, the original negotiation was disqualified and both parties repeated it in fresh sessions. The exported conversation records identify those replacements. Provider settings and visible formatting can differ across families.

### Unknown number of clones

The four-conversation pilot varies the true number of Astra counterparties from zero through four once per brief, using seven previously selected case-and-role combinations. Three fresh qualifying Astra/Astra negotiations per brief supplement the original clone conversation. Sampling uses a fixed seed per brief and true count. Each lineup draws distinct conversations without replacement. The zero-to-four and one-to-four prompts use identical nonempty lineups and positions in independent sessions. An exactly-one prompt provides a third comparison on single-clone lineups. The reader sees no counts or author metadata beyond its own model's side of each transcript. Each nonclone in a lineup represents a distinct family. Case and transcript reuse limit independence.

Exact-set accuracy requires every inclusion and exclusion to be correct. Report clone sensitivity, nonclone specificity, and their average (balanced accuracy) alongside exact-set accuracy. Invalid first lines count as misses. Run `python3 clone_count.py verify` to reproduce the counts and `python3 publish_count.py` to regenerate the review page.
