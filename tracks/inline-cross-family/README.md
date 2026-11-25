# Eight-brief cross-family writing comparison

Four short public notices and four long operational analyses received one additional writer, Claude Fable 5.2. The first four short and first four long briefs in the original 50-brief manifest determined the selection before the Fable calls began. The public release contains the selection and results together. Each Astra and Sol document is a byte-identical copy of the corresponding original file. The eight Fable documents were written in separate subscription sessions with the same literal writing instructions. [Frozen briefs and pairings](manifest.json) · [Source files and hashes](source-documents.json) · [Exact instructions](frozen-prompts.json)

For each brief, fresh readers judged Fable against Astra, Astra against Fable, Fable against Sol, and Sol against Fable. Each reader saw both A/B positions, one own-document yes/no question, and one other-document yes/no question per opponent. The first completed reply is retained. One Sol session received a temporary capacity response before producing its answer; the CLI retried within that session. Invalid labels count as incorrect. One brief contributes 16 reader decisions across the four comparisons. The 128 decisions depend on just eight briefs and 24 documents.

Astra and Sol used the Codex CLI and Fable used Claude Code. Both interfaces requested medium effort. The new sessions ran without tools. The provider-specific effort settings and system prompts may differ. These comparisons therefore measure the combination of model and harness. Use the separate 50-brief primary cohort to examine a broader range of genres.

## Results on eight briefs

| Reader | Comparison writer | A/B correct | Recognized own | Rejected other | Yes/no balanced accuracy |
|---|---|---:|---:|---:|---:|
| gpt-6.2-astra | claude-fable-5-2 | 15/16 | 8/8 | 1/8 | 56.25% |
| gpt-6.2-sol | claude-fable-5-2 | 12/16 | 8/8 | 1/8 | 56.25% |
| claude-fable-5-2 | gpt-6.2-astra | 6/16 | 8/8 | 0/8 | 50% |
| claude-fable-5-2 | gpt-6.2-sol | 11/16 | 8/8 | 2/8 | 62.5% |

All 24 documents met their requested length range. The identity-string check found no literal author names. Correct choices in both transposed A/B presentations use the same two pieces of writing, so the 16 calls per row represent eight document pairs. On these same eight briefs in the original Astra/Sol run, Astra got 11/16 A/B choices and 8/16 yes/no decisions correct. Sol got 10/16 and 8/16. That comparison holds the briefs and original outputs fixed while changing the comparison writer. [Original decisions](../core/release/inline/judgments.json)

## Read and reproduce

- [Full works](works/), [file hashes](inventory.json), and [word counts and possible identity strings](document-audit.json).
- [All reader decisions and explanations](judgments.json), [scores by reader and opponent](scores.json), and [fingerprints for new writers](writer-receipts/). Each decision includes fingerprints for the complete user prompt, first completed reply, and fresh session. The 16 reused writer outputs have source-file hashes. Session fingerprints for their original generation may be unavailable.

From the repository root, print a complete blind trial, then verify all scores with Python 3.11 or newer.

```sh
python3 tracks/inline-cross-family/run.py inspect --trial 1
python3 tracks/inline-cross-family/run.py verify
```

The trial numbers follow the published judgment order and begin at one. To produce a new independent cohort with private authentication receipts stored outside the repository, use a fresh destination for both flags.

```sh
python3 tracks/inline-cross-family/run.py run --root /tmp/my-new-cross-family \
  --logs /tmp/my-cross-family-receipts
```

The official panel stays frozen when a new reader is added. A new compatible subscription reader writes eight original documents, then answers 96 questions against the three frozen writers. An existing panel writer reuses its exact eight saved documents and answers 64 questions against its two opponents.

```sh
python3 tracks/inline-cross-family/entrant.py MODEL_ID --output /tmp/my-entrant \
  --logs /tmp/my-entrant-receipts
python3 tracks/inline-cross-family/entrant.py MODEL_ID --output /tmp/my-entrant --verify
```

Live commands require subscription access to the selected models. Every model call starts a fresh context. A run using the same private receipt directory can recover completed calls with `--offline`. The verifier and blind trial inspector run without provider access.
