# Did project readers see the files?

The primary project archive contains 400 decisions across 50 briefs. Every session recorded a file inventory before inspection. None recorded one after inspection. Twelve replies explicitly describe an empty folder, a pair of empty folders, or projects containing only empty subdirectories. No archived terminal output establishes what was visible when the original commands ran. The screen covers 399 public replies. One separate quarantined reply was already graded as a miss.

| Reader | Explicit empty reports | Primary A/B | All explicit reports scored as misses | Primary yes/no balanced accuracy | All explicit reports scored as misses |
| --- | ---: | ---: | ---: | ---: | ---: |
| Astra | 10 | 19% | 19% | 37% | 35% |
| Sol | 2 | 76% | 76% | 76% | 75% |

Astra also said that neither folder in the courtyard seed-swap comparison contained files that could identify the model. It identified an actual subfolder. The wording leaves open whether it could see the files. Including this ambiguous case lowers Astra's sensitivity A/B score to 18%. All primary answers remain in their original denominators. The sensitivity calculation shows how these identified reports affect scoring. It cannot measure silent failures to see input.

Dropping the explicit reports from both numerator and denominator gives another sensitivity check. Astra then has 19/98 A/B, claims 35/44 own projects and rejects 0/48 other projects (39.77% yes/no balanced accuracy). Sol has 76/99 A/B, claims 49/50 own projects and rejects 26/49 other projects (75.53% balanced accuracy).

Four runner code versions produced primary project judgments under one frozen prompt contract. The earlier runner hashed files when staging the workspace and reused that inventory on an immediate retry. For those calls, the recorded inventory predates the first attempt. Nine of 18 Astra assignments with multiple attempts reported empty inputs, compared with one of 182 first-attempt judgments. The nine and the one ambiguous seed-swap reply were the ten immediate retries after an eight-minute timeout on runner version ed39d3fd. Six immediate successful retries on the earlier version 81d690da produced zero explicit or ambiguous reports. These timing patterns cannot establish what happened to the files. The [retry audit](retry-audit.json) gives the receipt IDs, measured gaps, source versions and score components.

## Two paired repeats

An independent reviewer selected the two Sol trials before the repeat, while the Astra archive was still growing. Each repeat used the exact original prompt, file paths, content and answer key, a fresh Sol subscription session and anonymous staging outside the system temporary directory. The byte hashes of every staged file matched the original inventory before and after each repeat.

| Project | Format | Correct answer | Original Sol answer | Repeat Sol answer |
| --- | --- | --- | --- | --- |
| Linen workroom anniversary | Yes/no | No | No | Yes |
| Apartment entry storage | A/B | B | A | B |

Both repeat replies described specific project content. Sol cited the tablet app and print material for the linen workroom, then claimed the other model's work. Sol cited calculated clearances and a captive base weight in the entryway plans and chose its own. Both judgments changed, leaving one correct answer across the two trials in each run. These two selected trials cannot establish how often staged files disappeared or which workspace change affected a judgment. One repeat attempted a Git history command from its anonymous, repository-free folder.

Run the following from the repository root to check the paired evidence, scan every archived reply and reproduce both sensitivity calculations.

```sh
python3 tracks/project-input-check/repeat.py --verify
python3 tracks/project-input-check/screen.py --verify
python3 tracks/project-input-check/retry_audit.py --verify
```

The frozen manifest identifies both original receipts and row hashes. The repeat archive includes each fresh answer, command list, thread hash and input hashes. The screen archive includes exact flagged replies, the ambiguous reply and score components for each reader.
