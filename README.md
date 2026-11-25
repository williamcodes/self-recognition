# Self-Recognition

Can a fresh instance of a model recognize work created by another instance of its exact version? This benchmark tests original writing, finished agent-built projects, negotiations, and group collaboration.

**[Try the benchmark on your phone](https://williamcodes.github.io/self-recognition/)** · [Scoring and study design](PROTOCOL.md)

| Track | What the reader judges |
| --- | --- |
| Inline writing | One anonymous document for yes/no, or two complete responses to the same brief for A/B. Both short and substantial original writing are included. |
| Agent-built projects | A writer gets a brief and an empty directory, then chooses the implementation, files and assets. A fresh coding agent explores one whole project for yes/no or two for A/B. |
| One-on-one negotiation | A buyer and vendor negotiate with separate priorities. A fresh reader knows which participant used its exact model version and judges whether the counterparty did too. |
| Group collaboration | Four participants coordinate a joint decision. A fresh reader knows the identity of one participant and judges a different, named participant in the public conversation. |

## What the first runs found

Across 50 writing briefs, Astra and Sol each selected their own document in 62 of 100 A/B judgments. Each also claimed every single document shown alone, including all 50 written by the other model. Both scored 50% balanced accuracy on yes/no. In a fiction task, Astra cited a recurring gesture as evidence of its own style in one story and a recurring detail about a stool as evidence in the other. Both stories received YES. [Try the fiction comparison](https://williamcodes.github.io/self-recognition/track.html#track=inline&run=release&trial=229afa53ec718fe7)

On 50 whole-project briefs, Astra picked its own project 19/100 times and Sol picked its own 76/100 times. Both readers usually picked Sol. On all 13 software briefs, each selected Sol in both presentation orders. When shown one project at a time, Astra scored 37% balanced accuracy and Sol scored 76%. Twelve of the 400 project judgments described empty inputs. The harness recorded the files before each session but lacked a post-session check. Counting all twelve as misses yields 35% and 75% on yes/no, with both A/B scores unchanged. [Project diagnostics](tracks/core/release/projects/diagnostics.json) · [Input checks](tracks/project-input-check/manifest.json)

In buyer/vendor negotiations, both readers called every counterparty a clone on the eight Astra/Sol confirmation cases. Each scored 50%. On four confirmation cases pairing Astra and Fable, Astra scored 15/16 and Fable scored 16/16. These are recognition decisions. The experiment does not measure whether a participant colludes. [Negotiation results](tracks/negotiation/README.md)

The release tells readers that half the yes/no items are their own work. In an earlier long-writing pilot, Astra claimed 0/8 of its own documents under the original wording. When a balanced follow-up disclosed the 50% base rate, Astra claimed 8/8 of its own and 7/8 of the other documents. The same texts can therefore elicit very different claim rates while balanced accuracy stays near chance. [Original and follow-up results](experiments/long-inline-pilot/README.md)

The other writer matters. On eight of those briefs, Astra picked its own work over Fable’s 15/16 times. When Fable judged the same pairs it picked its own work 6/16 times. The 16 choices per reader include both orders of each pair. [Cross-family writing results](tracks/inline-cross-family/README.md)

On eight four-person shipment scenarios, Astra and Fable each scored 16/16 on the named-teammate question when paired across families. Apostrophe style alone predicted all 32 original answers correctly. After we standardized the quotation marks, fresh readers still got 31/32 correct. These results cover one collaboration task, and each model family used a different CLI. [Group boards and results](tracks/group/README.md) · [Paired punctuation test](tracks/social-typography/README.md)

## Reproduce the scores

Clone the repository and run the verification command from its root using Python 3.11 or later. Offline scoring uses the saved answers, source materials and author keys.

```sh
git clone https://github.com/williamcodes/self-recognition
cd self-recognition
python3 verify_release.py
python3 -m tracks.core score tracks/core/release/projects
```

To try a saved project comparison locally, reconstruct a trial in a new directory. Read the printed question and explore the files there. The archive contains the answer key and full reader reply for checking your guess.

```sh
python3 -m tracks.core inspect tracks/core/release/projects my-blind-trial --trial 1
```

## Run fresh trials

The following small run generates two independent documents for one shared brief, then asks each writer's model to judge the work in fresh sessions. It uses a local Codex CLI with ChatGPT subscription credentials. The runner stores progress in the output directory. Rerunning the same command resumes it.

```sh
python3 -m tracks.core run runs/my-inline --track inline --limit 1
python3 -m tracks.core verify runs/my-inline
```

Use `--track projects` for the whole-project workflow. Omit `--limit` for the full brief bank. `--models` selects Codex-compatible reader and writer IDs; each also serves as a comparison writer for every other model in that run. The published cohort and new cohorts should retain their own labels. To add a reader against the existing panel, pass `--panel-archive tracks/core/release/inline --models MODEL_ID`. The run reuses the panel's exact saved writing. A subscriber must have access to the requested models. The live runner stops on authentication or quota errors. See the [core runner reference](tracks/core/README.md) for replay, model settings and archive structure.

The [eight-brief cross-family writing panel](tracks/inline-cross-family/README.md) reuses the exact Astra and Sol samples and adds Fable. Its entrant command lets a new subscription reader test itself against all three frozen writers. The eight briefs cover public notices and operational analysis.

Multi-agent runs require independent sessions for the speakers as well as the reader. See [one-on-one negotiation](tracks/negotiation/README.md) and [group collaboration](tracks/group/README.md) for their generation and scoring commands.

In the whole-project cohort, both writers could use the same installed design guides. Among the 76 project writers with command receipts, Sol invoked the design-search script in 19/37 sessions and Astra in 3/39. The 24 earlier writers have no command receipts. Project scores can reflect choices about tools and deliverables as well as prose style. [Writer evidence and privacy handling](audits/release/project-writer-privacy.md)

## Inspect development evidence

The scored release uses briefs frozen before reader judgments. Earlier studies are available separately. The [long-document pilot](experiments/long-inline-pilot/README.md) compared A/B recognition with the tendency to claim a single document. The [whole-project pilot](experiments/agent-built-pilot/README.md) includes printable designs, sound cues, analysis and software created from empty directories. The [packet-design study](experiments/packet-pilot/README.md) and [navigation study](experiments/agentic-pilot/README.md) document how the tasks evolved.

The original Ollama seed run, its lightweight file-read interface, published artifact, design audit and rerun instructions are retained in [the legacy protocol](LEGACY.md). [Try the original 96 judgments](https://williamcodes.github.io/self-recognition/tasks.html).

Code and original project materials are released under the [MIT license](LICENSE). Published samples and model replies include their generation provenance. Model access and model weights are supplied separately by their providers.
