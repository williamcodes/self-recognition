# Individual authorship tracks

The fixed brief banks are [inline writing](inline-briefs.json) and [agent-built projects](projects-briefs.json). Both published archives use GPT-6.2 Astra and GPT-6.2 Sol as writers, readers and comparison models. The model IDs identify provider-requested versions. Immutable provider checkpoint hashes are unavailable.

## Live run

From the repository root:

```sh
python3 -m tracks.core run runs/my-projects --track projects --limit 1 --workers 2
python3 -m tracks.core verify runs/my-projects
python3 -m tracks.core score runs/my-projects
```

Use Python 3.11+ on macOS or Linux and a subscription-authenticated Codex CLI for live calls. Set `SELFREC_CODEX` to select a specific executable. If omitted, the runner uses the ChatGPT desktop CLI on macOS when present, then `codex` on PATH. It looks for the signed-in subscription in the current Codex home. Offline verification and scoring do not require model access. Live sessions use medium reasoning effort. Writers and readers start independently, in empty temporary directories except for projects deliberately supplied for inspection.

The project writer gets workspace-write access and can use local tools. The project reader gets read-only access and a neutral copy of the work. It can choose what to inspect. Author keys, session transcripts and the briefs' source paths are outside that copy. File names inside a writer's work and ordinary choices such as graphics formats carry information about the author. Modification times are normalized and artifacts copied in sorted path order. Generated code is untrusted. For external submissions, perform live evaluation in a disposable environment that contains no unrelated credentials or projects.

For a different brief bank pass `--briefs path/to/briefs.json`. The JSON array contains objects with a unique filesystem-safe `id`, a `genre` and a `prompt`. Inline genres beginning with “short” receive a 70–150-word target; others receive a 1,200–1,800-word target. The first complete submission is retained, including out-of-range lengths. A project brief specifies the end user's needs and leaves file organization and media up to the writer. Do not include author identities or a passage to be minimally rewritten in a brief.

Pass `--writers-only` to stop after generation, then rerun without it to judge the saved works. Work products and completed judgments are checkpointed. Use the same arguments and output directory after an interruption. Use a new directory to change the cohort or briefs. Parallel runs should use separate output directories.

## Inspect a release

`manifest.json` records the protocol, exact requested models, reasoning effort and all briefs. `works/` stores complete outputs, with SHA-256 hashes listed in `inventory.json`. Each row in `judgments.json` includes the brief ID, reader, comparison writer, ordered candidate authors, reader answer, full reply and terminal commands. Reconstruct the correct label from the ordered authors, independently of the reader reply. `scores.json` can be verified from those records.

`inspect ARCHIVE DESTINATION --trial N` prepares trial N in a new destination folder. It prints the exact question for an agentic task or the full prompt for inline. Trial numbers begin at 1 in the order saved in `judgments.json`. Add `--reveal` when preparing a second destination if you want the answer and recorded decision.

The published cohort uses both A/B positions and one own/one other yes/no session per brief, reader and opponent. With more comparison writers, own yes/no documents are presented in fresh sessions once per opponent so the class prevalence remains 50%. Distinguish unique works and briefs from the number of model calls.

## Evaluate an additional reader against the frozen panel

For a new compatible subscription model, use the published archive as a comparison panel. Replace `MODEL_ID` with the reader's actual model ID. The runner copies and hash-checks the reference writing, generates only the entrant's missing works, and judges only the requested reader. This avoids rerunning every existing reader against a new arrival.

```sh
python3 -m tracks.core run runs/entrant --track inline \
  --panel-archive tracks/core/release/inline --models MODEL_ID
```

The new archive records the panel, reader list and hashes of the reference manifest and inventory. The default compares the entrant on all frozen briefs. A limited smoke run remains a different cohort. If the reader already belongs to the panel, its saved writing is reused and it is compared only to the other panel members.
