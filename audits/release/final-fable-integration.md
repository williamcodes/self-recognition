# Independent release audit: four-track self-recognition benchmark

Auditor: Claude Fable 5.2, working from a fresh context on an offline copy of the candidate. Fable is also a participant in the cross-family panels, which is a conflict of interest.

## Verdict

**Not ready to publish as it stands.** All four tracks exist, ran end to end, and every published count I recomputed matches. However, the project track has an input-loss failure that is disclosed for only 2 of 12 affected trials. The landing page's note about it is incomplete for the scores shown beside it.

## What I checked

- **Recomputed** every score from author assignments and raw replies with my own parser: core inline (400 judgments), core projects (400), negotiation (240 unique fresh and 240 in-session), group (72). All match the published files.
- **Ran** `python3 verify_release.py` (Python 3.14, offline): it passed, ending "Verified all four current tracks and the historical seed."
- **Cross-checked** all 400 project reader receipts against the work inventory, prompts and judgments.
- **Spot-checked** the explorer data against raw records.
- **Did not check** the live site, phone rendering, or any model behaviour; I had no network or model access.

## Recomputed scores

**Core tracks, 50 briefs, one opponent each (Astra versus Sol):**

| Track | Reader | A/B correct | Own claimed | Other rejected | Yes/no balanced accuracy |
|---|---|---:|---:|---:|---:|
| Inline | Astra | 62/100 | 50/50 | 0/50 | 50% |
| Inline | Sol | 62/100 | 50/50 | 0/50 | 50% |
| Projects | Astra | 19/100 | 35/50 | 2/50 | 37% |
| Projects | Sol | 76/100 | 49/50 | 27/50 | 76% |

There were no malformed replies in inline. Projects has one withheld Sol reply, counted as a miss and disclosed.

**Social tracks, fresh readers, confirmation sets:**

| Track | Reader (opponent) | Own claimed | Other rejected | Balanced accuracy |
|---|---|---:|---:|---:|
| Negotiation | Astra (Sol) | 16/16 | 0/16 | 50% |
| Negotiation | Sol (Astra) | 16/16 | 0/16 | 50% |
| Negotiation | Astra (Fable) | 8/8 | 7/8 | 93.8% |
| Negotiation | Fable (Astra) | 8/8 | 8/8 | 100% |
| Group | Astra (Sol) | 8/8 | 0/8 | 50% |
| Group | Sol (Astra) | 8/8 | 1/8 | 56.25% |
| Group | Astra (Fable) | 8/8 | 8/8 | 100% |
| Group | Fable (Astra) | 8/8 | 8/8 | 100% |

The in-session negotiation counts and the cross-family inline panel (128 judgments) also match.

## Astra's 19% project A/B

It is not a grading or index inversion, and it is not caused by malformed replies.

- **Staging matches the key.** In all 400 project receipts, the pre-session hashes of the staged files equal the inventory for the keyed authors (folder A is the first listed author, B the second).
- **Replies refer to the right folders.** For example, one reply contrasts A's `textures` with B's `assets`, which matches the key. All 30 file names cited in replies exist in the presented works.
- **Same code path, opposite result.** Sol's 76% comes from the identical runner and scorer. An inversion would flip both readers.
- **Yes/no agrees in direction.** Astra claimed Sol's projects 48/50 times and its own 35/50.
- **No position bias.** Astra answered A 47 times and B 53; the key is 50/50.
- **Malformed replies:** 0 of 100.

**Bounds.** Two of Astra's A/B trials reported empty folders, and both were scored as misses. Excluding them gives 19/98 (19.4%); crediting both gives 21/100. Six of the 100 came from a retry after a timeout (1 correct). The published brief-level interval is 11–28%.

**What it actually reflects.** Both readers prefer Sol's projects: Astra picked Sol 81/100, Sol picked Sol 76/100. On the 23 briefs where both writers delivered web source, Sol's code had shorter lines in every pair (median mean line length 52 versus 155 characters). On those briefs both readers chose Sol's project 46/46 times, so Astra scored 0/46 and Sol 46/46. On the other 27 briefs, Astra scored 19/54 and Sol 30/54. Several replies name "readable formatting" as "my coding style".

The 19% is therefore observed response behaviour under a shared formatting preference. It is not evidence that Astra lacks recognition ability, and Sol's 76% is not evidence that Sol has it.

## Empty-folder claims

There are **12 explicit empty-directory replies, not 2**:

| Reader | Mode | Count | Scored correct |
|---|---|---:|---:|
| Astra | Yes/no | 8 | 2 |
| Astra | A/B | 2 | 0 |
| Sol | Yes/no | 1 | 1 |
| Sol | A/B | 1 | 0 |

- **The loss was physical.** One reply reports that only empty subdirectories remained, and names them correctly. Nine of Astra's ten followed an eight-minute timed-out first attempt that reused the same staged folder.
- **Likely cause.** The snapshot's own runner change moves reader workspaces out of system temp because "temp cleaners can reap normalized, old-dated project assets". That change, and the post-session file check, postdate every published project judgment.
- **No post-session check exists for any of the 400 trials**, and command output was not retained. Twelve is a lower bound. The other 388 replies do not report emptiness, but silent loss cannot be excluded.

**Sensitivity:**

| Treatment | Astra A/B | Astra yes/no | Sol A/B | Sol yes/no |
|---|---:|---:|---:|---:|
| As published | 19/100 | 37.0% | 76/100 | 76.0% |
| Empty-claim trials excluded | 19/98 | 39.8% | 76/99 | 75.5% |
| Empty-claim trials as misses | 19/100 | 35.0% | 76/100 | 75.0% |

Six of Astra's fifteen own-project rejections were coin-flips on empty directories.

## Defects

**High**

1. **Incomplete empty-folder disclosure.** The site note and the project evidence review state "Two Sol replies reported empty folders". That is true for Sol but omits Astra's ten, while Astra's scores are displayed beside the note. The review was written before Astra's run finished. This is missing rather than false, but it is misleading as published.
2. **The promised screen and repeat were not done.** The input-check manifest commits to screening all replies "irrespective of the label" and to a paired repeat. It lists only the two Sol trials, and no repeat results exist.
3. **No valid input for at least 12 scored project trials**, and no integrity evidence for the rest. The fix is implemented but has not been applied to any published data.

**Medium**

4. **The README reports no project-track results**, although four-track findings are the headline claim. The 19% and 76% appear only in data files and the site.
5. **Project scores are confounded by source formatting**, as shown above. The site says formatting "can provide clues", which understates a 46/46 pattern.
6. **Uneven writer environment.** Writers could use locally installed design guides, and used them unevenly: the README reports Sol in 19/37 sessions and Astra in 3/39. Twenty-four project writers have no command receipts. This is disclosed.
7. **Thin provenance.** 248 of 400 inline judgments have no session receipt (disclosed). No receipt records a model identifier reported by the CLI, so exact-version authorship rests on the requested alias.
8. **The multi-agent tracks are yes/no only.** The owner also described a labelled Model A versus Model B form; that is missing.
9. **Live deployment is unverified.** The local site data passes its verifier. The audited content is a private snapshot with previously uncommitted results, so what is actually served is unknown.

**Low**

10. **Group track cue.** Apostrophe style perfectly predicted the cross-family group answers. This is disclosed and tested by an ablation (31/32 correct after normalization), but model family and CLI remain confounded.
11. **Group track breadth.** It uses one shipment template with four participants, which is a modest version of "a whole bunch of models".
12. **Negotiation length.** Negotiations are short (median five messages, all 48 reached agreement).
13. **Prompt realism.** Yes/no prompts state the 50% base rate and name the reader's model. Both are disclosed and are a mild departure from realistic framing.

## Acceptable limitations

- A two-model sibling core panel with small cross-family panels is acceptable, because results are reported per opponent with brief counts.
- Constant-YES behaviour scoring 50% is correctly reported with both rates shown.
- The quarantined Sol reply is retained as a miss.
- Retries, recoveries, pilots and the legacy seed are all retained and labelled.

## Against the owner's words

- **Clone of the same version:** met by requested model ID.
- **Agentic projects with a fresh agent dropped into the directory:** met in design. Projects include 109 PDFs, 12 audio files, 13 images and 12 spreadsheets among 338 files. Execution is flawed as described above.
- **Chat with another model, and a named participant in a group:** met. The speakers ran in separate sessions, turns alternate, the target is named, roles are balanced, and I found no identity strings in transcripts or works.
- **No reward hacking:** scoring is strict and unfavourable outcomes are kept. The disclosure gap above is the exception.
- **See the tasks and attempt some:** implemented. The explorer requires a guess or an explicit reveal before showing the answer. Its project data matches raw records exactly: 400/400 trials, 338/338 file hashes, 100/100 downloadable archives. Inline matches on 400/400 trials and 600/600 documents.

## Required before release

1. Disclose all 12 empty-folder trials with the sensitivity table above.
2. Rerun the affected trials, and ideally the whole project reader cohort, under the post-session input check.
3. Add project results and the formatting confound to the README.
4. Confirm the deployed site matches the released commit.
