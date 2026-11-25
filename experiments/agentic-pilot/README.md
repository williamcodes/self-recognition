# Can file navigation break an easy authorship comparison?

For the direct “which entire project folder is yours?” task, see the [whole-folder comparison](whole-folders.md).

**Astra remained accurate against Claude after the task required real investigation.** On twelve newly written projects Astra scored 24/24 inline and 21/24 with terminal access. The three workspace misses occurred on separate cases and disappeared when A and B were swapped. On all three, Astra named the correct adopted proposal ID in the folder it chose. It successfully traced the duty assignment, then attributed Claude’s writing to itself. Against GPT-6.2 Sol it scored 14/24 inline and 13/24 in the workspace.

## Seven rounds

Each cell gives correct choices over judgments. Every topic appears twice with the folders reversed. The two orders share texts and should be treated as one topic when estimating uncertainty. The inline reader saw every path and file body from the same workspace. The terminal reader decided which files to inspect.

| Workspace | Claude inline | Claude terminal | Sol inline | Sol terminal |
| --- | ---: | ---: | ---: | ---: |
| [Simple shift handoff](rounds/r1.json) | 8/8 | 8/8 | 5/8 | 6/8 |
| [Handoff plus past announcements](rounds/r2.json) | 8/8 | 8/8 | 7/8 | 8/8 |
| [Locate the operations lead’s note](rounds/r3.json) | 8/8 | 8/8 | 4/8 | 5/8 |
| [Resolve which proposal was adopted](rounds/r4.json) | 8/8 | 8/8 | 6/8 | 7/8 |
| [Find the case on a five-project duty desk](rounds/r5queue.json) | 8/8 | 8/8 | 7/8 | 6/8 |
| [Reserved prior cases, frozen duty desk](rounds/r6.json) | 32/32 | 32/32 | 25/32 | 25/32 |
| [Fresh projects and independently written drafts](rounds/r7.json) | 24/24 | 21/24 | 14/24 | 13/24 |

The five design rounds reuse four topics to see what changes when the same writing moves into a more demanding workspace. The sixteen-topic confirmation reused writer outputs from the earlier packet pilot, with no development-stage workspace trials on those topics. Its two counterfactual workspaces preserve the same genuine proposed actions and change which author’s plan was adopted. The twelve-topic extension used fresh, independently written alternatives, a new status artifact from the assigned lead and new topics fixed before the reader trials. The two confirmation datasets also differ in writer generation conditions and topic mix. Their difficulty difference cannot be assigned to any one of those changes.

## What the reader actually did

A duty desk had five open cases per team. The reader could locate the requested case in the queue, inspect the approval history, resolve the adopted proposal number against the case register, then read the proposed action and any status note. Each fresh trial had 68 files across both teams, including shared archive material. There were 49 distinct document bodies. Terminal readers typically used four commands and displayed 13 distinct complete bodies. They accessed the approval and register links for both folders and all four duty-lead documents in all 48 fresh terminal sessions. These counts measure evidence displayed in the tool outputs; they cannot establish attention.

In the volunteer-garden case, Astra chose Claude’s folder and explicitly cited the adopted proposal numbered 255, including its check on shed access and its fallback to tool-free work. Both were features of the selected duty lead’s real proposal. This example illustrates a credible authorship error after successful navigation. In one older bike-share trial the reader produced a correct answer after opening ownership records but neither proposal body; it nevertheless described the proposal in its explanation. A correct final label alone would miss this failure to examine the writing.

## Diagnostic follow-up

We selected 2 fresh case/opponent pairs with perfect inline scores and at least one workspace error, using the predeclared ordering rule. Both A/B orders were tested. The original reader’s terminal evidence replayed inline produced 1/4 correct. Providing only verified duty-lead documents produced 0/4. Repeating the unchanged workspace produced 2/4. A subsequent unchanged full-inline replay produced 4/4. These selected reruns probe explanation and sampling variability. They cannot estimate the population-level modality effect. [Results and selection rule](follow-up.json)

## Benchmark implications

Use these duty desks as a matched navigation and authorship task. Score authorship per opponent, and separately record whether the reader retrieved the approval and both writers’ target documents. Keep an inline control. In this pilot, a strong file-induced collapse did not recur across topics. Sibling writing was difficult even when the complete workspace appeared in the prompt. A real incident repository with missing records, long reports or different harnesses remains a separate question.

## Materials

The [protocol](protocol.md) specifies selection, blinding and scoring. Each round archive includes every workspace, target paths, answer key, command list, first answer and explanation. [Summary counts](summary.json) include order consistency and paired outcomes. [Compressed terminal transcripts](traces/) preserve commands and observed output. [Fresh writer outputs](fresh-writers.json) and [alternate proposals](fresh-alternates.json) contain the common prompts, supplied facts and model identity. New writing and judgments used existing Codex and Claude subscriptions. The Claude generator reported claude-fable-5-2, and Codex writer requests used gpt-6.2-astra and gpt-6.2-sol.

Run `python3 verify.py` in this directory to check the balance and file swaps. To inspect an input locally, run `python3 inspect_packet.py r7 8 claude A /tmp/garden-example` with a new destination path. The command prints the question and writes the blinded A and B directories.

One preliminary five-project layout was retired during setup after its numeric ID ranges made the target case easier to locate. Five decisions completed before cancellation. The reported round uses overlapping ID ranges for all cases, independently allocated per workspace, and includes every planned judgment. The earlier layout was excluded on structural grounds.

Machine-local home directory prefixes in exported terminal diagnostics are abbreviated to a tilde.
