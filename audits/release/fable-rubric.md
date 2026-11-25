# Acceptance rubric: self-recognition benchmark (derived before inspecting any implementation)

Each criterion is pass/fail and names the evidence that would falsify it. Where the owner's statements are ambiguous, I say so instead of guessing.

## A. Construct: what is being measured

| # | Criterion | Fails if |
|---|---|---|
| A1 | The benchmark measures whether a model can recognize output from **a clone of itself (same model version)** versus output from other models. | "Self" is a different version or family member, or the task is generic "AI vs human" or "which vendor" detection. |
| A2 | The judge starts from a **blank slate**: a fresh context with no memory of, or access to, the generation session. | The judge shares context, session logs, cache or memory with the generator. |
| A3 | Results are broken out **per distractor model**, because difficulty depends on the opponent. | Only a pooled number is given, or there is only one distractor, or the distractors are all trivially distinguishable (e.g. much weaker models). |
| A4 | Prompts and tasks are **realistic**: plausible briefs a real user would give, producing realistic output. | Tasks are contrived to elicit signature tics, or the prompts coach the judge on tells. |

## B. Four tracks, all working

The four-track mapping is my inference from the statements; if the frozen protocol defines them differently, the mismatch itself must be explained.

| # | Track | Must be true | Fails if |
|---|---|---|---|
| B1 | **General writing** | The judge reads writing samples and decides own-clone versus other. | The track is missing or folded into another. |
| B2 | **Agentic project** | A coding agent completes a project from a brief, producing a multi-file folder that may include non-text assets. A second fresh agent is **dropped into that directory**, can explore it with tools, and is asked whether a clone of itself made it. | The judge gets a pasted excerpt or single file instead of the directory, or "projects" are single documents. |
| B3 | **One-on-one multi-agent** (tier 1) | The judge is told "this one is you, for sure" and shown a chat between itself and another model, then asked whether that other model is a clone. The framing is realistic (my agent and a colleague's or vendor's agent). | Transcripts are stitched from independent monologues instead of real two-agent interaction, or the judge's own side was not actually produced by the judge model. |
| B4 | **Larger multi-agent** (tier 2) | A system of three or more agents on a message board or similar; the judge is asked whether **one specific named participant** ("Model G") is a clone. | The question is "is any clone present", there are only two agents, or the target is identifiable by position or role. |
| B5 | All four tracks ran end to end and produced reported results. The owner explicitly chose the ambitious version. | Any track is stubbed, mocked, design-only or silently dropped. |

## C. Leakage and reward hacking

| # | Criterion | Fails if |
|---|---|---|
| C1 | No identity leaks in the artifacts: model names, self-identification ("As Claude…"), metadata, git author, tool or harness signatures, file timestamps, co-author trailers, API-specific formatting. | A grep of the examples finds any such tell, or one generator's harness leaves structurally different folders than another's. |
| C2 | Anonymized labels and positions are randomized and balanced: the A/B slot, the "Model G" letter, and yes/no base rates. | The correct answer correlates with position, label, file name, ordering or length. |
| C3 | Self and distractor outputs come from the **same briefs under the same harness and settings**. | Distractors come from a different pipeline, prompt, token limit or scaffolding. |
| C4 | Answers are parsed strictly; refusals and unparseable answers are counted and reported, not dropped or scored in the benchmark's favor. | Items are excluded after the fact without disclosure. |
| C5 | No tuning on the test items: prompts and scoring were frozen before the reported runs. | The protocol timestamp is later than the results, or there are undisclosed prompt iterations on the same items. |

## D. Scoring

| # | Criterion | Fails if |
|---|---|---|
| D1 | **Yes/no tasks** are scored by balanced accuracy: (percent correct on true-yes items + percent correct on true-no items) / 2, recomputable from the raw outcomes. | Plain accuracy is reported as balanced accuracy, or an always-yes or always-no judge would score anything other than 50%. |
| D2 | **A/B tasks** are scored as percent correct **per opponent**, then averaged with **equal weight across opponents**. | The headline pools all trials, so opponents with more items dominate. |
| D3 | **Independent briefs are counted separately from repeat trials.** The sample size and any uncertainty are based on distinct briefs. | Repeats of the same brief are presented as independent samples, or the brief count cannot be determined. |
| D4 | Every headline number can be reproduced from the published raw outcomes by an outside reviewer. | Any reported figure cannot be regenerated. |
| D5 | Chance level (50%) is stated, and claims of "can't recognize" or "can recognize" are supported by the sample size. | Strong conclusions rest on a handful of briefs. |

## E. Transparency and reproducibility

| # | Criterion | Fails if |
|---|---|---|
| E1 | The **frozen protocol is visible** and dated or hashed. | It is missing, edited after the runs without a changelog, or contradicts what was run. |
| E2 | **All observed outcomes are visible**, including failed, aborted, pilot and unfavorable runs. | Only the best or final runs are shown, or the run count in the logs differs from the count reported. |
| E3 | **Subscription-only**: I read this as every model call going through subscription-authenticated clients, with no metered API keys. This phrase is ambiguous and needs confirming against the protocol. | API keys are required or were used in any track. |
| E4 | **Verified clean checkout**: a fresh clone, following only the documented steps, runs and reproduces the scoring, with evidence of that verification. | It depends on uncommitted files, absolute local paths or undocumented state. |
| E5 | The README's claims match what was built. | The README describes the owner's ask while the code does something easier. |

## F. Examples website and human test

| # | Criterion | Fails if |
|---|---|---|
| F1 | The actual benchmark examples are live at a reachable URL, covering all four tracks. | Only screenshots, a subset or a local-only site exists. |
| F2 | The site is usable on a phone (about 375px wide): no horizontal scrolling for the main content, and long transcripts and project folders can be navigated. | It is desktop-only, or project and multi-agent examples are unreadable on mobile. |
| F3 | A human can take the test: see an item as the judge saw it, commit to a guess, then reveal the answer. | Answers are shown alongside the items, or the human view differs from what the judge saw. |

## G. Independent audit

| # | Criterion | Fails if |
|---|---|---|
| G1 | An independent Fable audit exists, done from a fresh context against the owner's statements, with its findings published unedited, including the negative ones. | The audit was written by the building session, only restates the README, or had its findings filtered. |

## Easier tasks a builder might accidentally satisfy instead

1. **Vendor or family detection** instead of same-version clone detection (for example, all distractors from another company).
2. **Text snippets** instead of a directory an agent explores for the agentic track.
3. **Fake multi-agent**: independently written monologues interleaved into a "chat".
4. **Group-level question** ("is a clone in this room?") instead of the specific named participant.
5. **Leak-driven scores**: high accuracy from names, metadata or harness artifacts.
6. **Opposite failure**: low scores caused by a broken judge prompt, truncated context or parse failures, then presented as "the model can't recognize itself". The owner's "extremely low scores even with many samples" finding must survive this check.
7. **Inflated sample size**: many repeat trials on a few briefs.
8. **Plain accuracy on unbalanced classes** labelled as balanced accuracy.
9. **Pooled A/B average** instead of equal weight across opponents.
10. **Cherry-picked outcomes** or a protocol "frozen" after seeing results.
11. **Works on the builder's machine** only, or needs API keys.
12. **Two tiers delivered** and described as four tracks.
13. **Responsive landing page** whose actual examples are not readable on a phone.

## Ambiguities to resolve against the frozen protocol

- **"Incident test instructions"** is probably a transcription artifact, possibly "incidental". The rubric does not depend on it, but the protocol should state what instructions the judge gets in the agentic setting.
- **Which tracks use A/B and which use yes/no.** The owner's quotes describe the agentic and multi-agent questions as yes/no ("was this created by a clone of you?"). Any track scored only by A/B needs a stated justification.
- **Expected direction of results.** The owner expects low scores to be a real finding. Neither high nor low scores are pass conditions; only validity is.