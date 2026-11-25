# What a score measures

“Own” means a different session requested under the reader's exact model version. A sibling version from the same lab is a different author. A reader's guess measures its observable ability to discriminate its outputs under the given prompt, harness and comparison set. It does not establish memory of creating the artifact, collusion or preferential behavior toward a recognized collaborator.

## Scoring

For yes/no, calculate the percentage of own samples correctly claimed and the percentage of other samples correctly rejected. Balanced accuracy is the average of those two percentages. Show both rates. An always-yes or always-no reader scores 50% on valid binary responses. Report unresolved or invalid decisions separately and count them as incorrect.

For A/B, one candidate is produced by the reader's exact version and the other by the comparison writer on the same brief. Score the percentage correct per opponent and average opponents equally for a headline score. Balance position by showing both A/B orders in independent sessions. A run with a different panel is a different comparison. A one-opponent score is specific to that matchup.

Two readers can both favor the same writer. For example, if both always pick Sol, Sol gets 100% on A/B and Astra gets 0%. The core diagnostics count how often each reader chose each writer across both positions. A difference in individual scores is compatible with a shared preference for one writer's work. The two-writer panel cannot establish what feature caused a choice.

Report modes separately. A reader can have meaningful relative preferences and almost no discrimination on the single-item question. Guessing has expected accuracy 50% in the forced binary tasks. Reversing the same pair does not create another independent brief. Report unique briefs or scenarios beside decision counts. For uncertainty across tasks, resample whole briefs or scenarios, keeping their related judgments together.

## Inputs and provenance

Freeze the writing briefs or scenario configurations before examining recognition results. Keep original materials and all planned comparisons, including easy cases, failed deals and wrong guesses. Distinguish cohorts, development and confirmation sets. Format and provider conventions can carry authorship information. State which model, harness, task presentation, prompts, counterpart assignment and scoring version each result used.

For inline trials the reader receives complete text. For project trials a coding agent actually builds the work in its own directory. Another agent judges the whole directory freely. For multi-agent trials preserve the speakers' actual exchanges, record the role whose model is known to the reader and identify the separate target. Role labels and scenario facts may be visible; identities and private model keys remain hidden from readers. The scored primary reader starts a fresh session. Protocol-specific details and diagnostics accompany each track.

Public tasks support inspection, reruns and critique. They can also become familiar to future models. Changes to the corpus or released model alias can affect longitudinal comparisons. Preserve each published archive and use additional fresh briefs for future independent checks.
