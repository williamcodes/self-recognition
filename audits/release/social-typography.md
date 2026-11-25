# What happens when the apostrophes match?

Of the 32 original group judgments, 31 stayed correct after every curly apostrophe was changed to a straight one. Astra kept all 16 answers. Fable kept 15 and changed one correct rejection into a false claim. The punctuation-only rule lost half its correct answers. [All paired judgments and scoring](../../tracks/social-typography/results.json)

| Reader | Original | After the edit | Correct clone claims | Correct rejections | Correct → miss |
|---|---:|---:|---:|---:|---:|
| GPT-6.2 Astra | 16/16 | 16/16 | 8/8 | 8/8 | 0 |
| Claude Fable 5.2 | 16/16 | 15/16 | 8/8 | 7/8 | 1 |

The one changed answer came from the school shipment, world 0. Originally Fable rejected Morgan and cited curly apostrophes and clipped prose. After the edit, Fable claimed Morgan and cited terse, precise confirmations and lack of filler. Other normalized replies referred to formatting, repeated openings, arithmetic or how each person explained a booking. These are the explanations the models supplied. They do not establish which features drove their decisions. [Original board and judgment](../../tracks/group/runs/confirmation/school/world-0.json) · [New Fable judgment](../../tracks/social-typography/judgments/08d4511c796722c26e102628d26a14e69591385a1ff5eed3fadd5a74d5c2e5f7.json)

## What the comparison measures

Two fresh readers judged the same 16 boards, drawn from eight shipment scenarios played in two worlds each. There were eight own and eight other targets per reader. We froze the full selection and prompt hashes, scoring rule and punctuation baseline before launching the 32 fresh subscription sessions. The transformation covered U+2018, U+2019, U+201C and U+201D. Only U+2019 appeared in the boards, 150 times in total. The question, transcript order, names, roles, all other message characters and requested models were preserved. The shared runner used Codex CLI 0.169.0-alpha.11.1 and Claude Code 2.1.331 at low effort. [Frozen manifest](../../tracks/social-typography/manifest.json) · [Run code](../../tracks/social-typography/run.py)

The baseline takes the messages from the known seat and target seat. For each seat it counts curly right apostrophes and straight apostrophes, then labels the seat curly, straight, or tied. It predicts a clone if those two labels match, including two ties. It receives no author IDs, ground truth, reader response, or information from other seats. On the original group boards it scored 16/16 for each reader. After normalization it predicted “yes” for every trial, scoring 8/16 for each. The model readers could still separate these authors when the baseline lost its signal. [Baseline implementation](../../tracks/social-typography/analyze.py)

## Same rule on the original negotiations

| Confirmation panel | Reader | Punctuation rule | Correct clone claims | Correct rejections |
|---|---|---:|---:|---:|
| Astra–Fable | Astra | 10/16 | 2/8 | 8/8 |
| Astra–Fable | Fable | 16/16 | 8/8 | 8/8 |
| Astra–Sol | Astra | 17/32 | 4/16 | 13/16 |
| Astra–Sol | Sol | 23/32 | 10/16 | 13/16 |

The negotiation figures score the fixed rule on original transcripts. There were no new negotiation reader calls. The cross-family panel used four of the eight primary confirmation scenarios. Its four Astra–Astra negotiations and the eight Astra clone judgments attached to them also appear in the primary panel. Across all negotiation panels and both splits there are 60 distinct games and 12 scenarios. A two-seat game can be read from either known seat. The predictor receives only the seat labels and their message bodies. The full results include the predictions for each seat and the development cases. [Negotiation results](../../tracks/social-typography/results.json)

Both model families used their own CLI, so family, model version and CLI remain confounded. Word choice, message length, Markdown, dashes, greetings and role-specific conventions all survived the edit. The diagnostic reuses the boards that motivated it, and each transformed prompt received one fresh judgment. With no unchanged-text rerun, the one changed answer could reflect ordinary run-to-run variation. High performance on these boards establishes that accurate decisions were possible after removing the curly-apostrophe cue. It leaves open how the original readers reached their answers and how well either reader generalizes to other tasks and opponents.
