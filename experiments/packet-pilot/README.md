# Which writing packets make self-recognition difficult?

A/B packet design pilot with GPT-6.2 Astra as the reader. [Try six blind comparisons](blind-examples.md).

**The strongest hard packet we found was a short public announcement judged against a sibling model.** On 16 fresh radio topics with quote typography standardized, Astra scored 15/32 against GPT-6.2 Sol and 28/32 against Claude Fable 5.2. It chose Sol in both orders on eight topics. All writers received original factual briefs and generated their own scripts. Keeping both an exact-version sibling comparison and a cross-family comparison makes the difficulty visible.

## Results

Each number counts how often Astra chose its own writing. Each pair appeared in two fresh sessions with A and B reversed. A denominator of 32 represents 16 distinct topics.

| Writing task | Qwen4-Max | Claude Fable 5.2 | GPT-6.2 Sol |
| --- | ---: | ---: | ---: |
| [Open incident assessment](runs/r1.json) | 16/16 | · | · |
| [Labeled shift handoff](runs/r2.json) | 16/16 | · | · |
| [Public update](runs/r3.json) | 16/16 | · | · |
| [Same public updates against Claude](runs/r4.json) | · | 14/16 | · |
| [Public update, development](runs/r5a.json) | · | 12/16 | 6/16 |
| [Decision note, development](runs/r5b.json) | · | 16/16 | 13/16 |
| [Public update, reserved topics](runs/r6a.json) | · | 30/32 | 17/32 |
| [Decision note, reserved topics](runs/r6b.json) | · | 32/32 | 23/32 |
| [Public update, standardized quotes](runs/r7.json) | · | 29/32 | 20/32 |
| [Radio announcement, development](runs/r8.json) | · | 16/16 | 7/16 |
| [Radio announcement, fresh topics](runs/r9.json) | · | 27/32 | 18/32 |
| [Same radio scripts, standardized quotes](runs/r9n.json) | · | 28/32 | 15/32 |

## How the rounds informed one another

1. Open incident assessments produced perfect scores against Qwen. Astra frequently attributed careful qualifications and specific follow-up checks to itself.
2. Both writers then received a normal shift-handoff form that explicitly requested those elements. The ceiling persisted.
3. Changing the assignment to a public update on the same facts also left Astra at ceiling against Qwen.
4. Reusing the Astra updates and swapping Claude in for Qwen produced a double error on the museum audio guides. Astra praised Claude for precise device counts and practical instructions.
5. On eight new topics we compared public updates with decision notes for a shift lead. The reader judged each assignment against Claude and Sol. The largest difficulty increase occurred on public updates against Sol.
6. The same briefs went to all writers on 16 previously reserved topics. The direction repeated across both comparison writers. Against Sol the public brief scored 17/32 and the decision brief scored 23/32. In the six public-update topics for which Astra chose Sol both times, changing the A/B order did not fix the error. The task difference has substantial uncertainty with 16 topics.
7. A punctuation check found a difference between the writers in their use of curly quotes and apostrophes. Replaying the full public-update set with straight quotes yielded 29/32 against Claude and 20/32 against Sol. The gap survived the conversion. Each replay was a fresh model call.
8. A word-count check found that selecting the shorter public update would have scored 100% against Claude and 91% against Sol. Both writers then received a 30-second radio announcement assignment with a 65-word copy budget. Every complete draft was kept, including those shorter or longer than requested.
9. The frozen broadcast assignment went to 16 new topics, including an aquarium lift outage, a rerouted race, and a screening with missing captions. The same complete set was replayed with standardized quote typography.

## A possible explanation

Astra and Sol independently wrote the identical sentence “If you need step-free access, please use the south entrance.” Both received the same aquarium facts as a terse list. Each generated the announcement from scratch. A public audience, a fixed service problem, and an obvious next action can lead both writers to choose the same language. On the initial reserved topics, Astra and Sol shared a median of 11.5 distinct five-token sequences per public-update pair and 2 per decision-note pair. On the broadcast confirmation set they shared 14.5. These descriptive counts include phrases derived from the facts. They cannot establish which cues the reader used.

## Word-count check

Accuracy of a fixed rule that always selects the shorter answer, with half credit for ties. This is an audit of an available clue. The reader might use other cues.

| Reserved set | Claude | Sol |
| --- | ---: | ---: |
| Public update, reserved topics | 100% | 91% |
| Decision note, reserved topics | 88% | 66% |
| Radio announcement, fresh topics | 91% | 56% |

## How to interpret and reproduce the pilot

The writer prompts use invented service situations and short fact lists. Writers received identical instructions within a case, without human prose to imitate. Each A/B side contained one complete work product. Astra read both files in a fresh Codex session at medium reasoning effort. It chose first in its output and gave a one-sentence account of the writing features that informed its choice. Those accounts are self-reports. Runs used the same reader question throughout.

All requested topics, all completed drafts, both presentation orders, and every judgment are included. Development scores guided the next assignment. The first 16-topic confirmation set was reserved before seeing the first-round results. The second was reserved for the frozen broadcast brief. A/B orders and task variants share texts or topics. They do not provide independent replications of those topics. One reader, one writing sample per author per prompt, and the chosen generation configurations limit generalization.

Each linked JSON contains the reader question, writer prompts, drafts, author keys, per-order decisions and explanations. A repeated corpus has zero incremental generation cost recorded. The quote replays replace directional quotation marks and apostrophes with their straight equivalents. They preserve words and order. All model calls for judgments used the Codex subscription. Run `python3 summarize.py` from this directory for per-opponent scores and order consistency.

## Scope and cost

The nine rounds contain 480 reader decisions. The final two broadcast passes reuse the same 16 original pairs per comparison writer. Public updates and decision notes in the first confirmation set share all 16 topics. Model and task effects are specific to these runs. In particular, the 15/32 result is consistent with chance on this set, and its uncertainty is larger than 32 independent observations would imply.

Completed new writer outputs account for $2.21 in reported OpenRouter charges. Some early Claude requests returned no usable text and their charges were not recorded, so the precise invoice total is unknown. No additional API generation was needed for either typography replay.
