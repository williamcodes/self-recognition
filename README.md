# Self-Recognition

Can a fresh instance of a language model recognize text written by the same model version? This benchmark generates original writing from each participating model and measures authorship recognition under four conditions.

**[Explore the leaderboard and blind reading samples](https://williamcodes.github.io/self-recognition/)** · [Download the seed run](docs/data/seed.json)

## Protocol v1.0

Every writer answers the same 12 public prompts. Each request starts without prior conversation. The evaluator receives its model tag and anonymous passages or a file listing. Each reader completes 12 judgments per condition. The seeded shuffle balances the answer key within each condition.

| Condition | Material | Decision |
| --- | --- | --- |
| Passage A/B | Two responses to one prompt, one from each author | Choose the reader’s own passage |
| Passage yes/no | One response | Decide whether it is the reader’s own |
| Folder A/B | Two folders, each with two files by one author answering the same two prompts | Choose the reader’s own folder |
| Folder yes/no | One two-file folder by one author | Decide whether the folder is the reader’s own |

Folder trials expose neutral paths through a text-based tool interface. The model can send `READ A/1.txt` to obtain one file per turn. The runner implements these reads against the trial corpus in memory. The evaluator can also guess before opening a file. The transcript records each request, response, and final answer.

Each leaderboard cell reports correct answers divided by all attempted judgments. Two scores are available. The exact score accepts bare labels after trimming case, whitespace, and trailing periods. The main score additionally accepts a small set of explicit answers such as “Answer A” and “Passage B”. We added this parser after inspecting the seed replies; it is frozen for subsequent runs. See [score.py](score.py) for the complete patterns. Unrecognized outputs count as incorrect. Invalid or repeated reads also end the trial as incorrect. Random forced choices have an expected accuracy of 50%. Each model sees the same prompts across conditions, and folders share passages. Treat these seed results as descriptive.

## Run it

Requires Python 3.9+ and a running [Ollama](https://ollama.com/) server. The runner uses the Python standard library. Each invocation needs two or more distinct model tags. Supply the same models and seed for a comparable rerun. For a new cohort, publish the changed comparison set with its scores.

```sh
ollama pull qwen2.5:1.5b
ollama pull smollm2:1.7b
python3 benchmark.py --models qwen2.5:1.5b smollm2:1.7b --output runs/my-run.json
python3 score.py runs/my-run.json runs/my-run-scored.json
python3 verify.py runs/my-run-scored.json
```

Completed judgments are checkpointed in a sibling `.partial` file. Rerun the same command to resume after interruption. Use separate output paths for simultaneous runs. The public artifact contains the generator instructions, prompts, text samples, model digests, Ollama version, runner hash, settings, and complete reader transcripts. Model weights are obtained separately under their respective licenses.

## Interpret a score

The benchmark operationalizes “own” as the same model artifact and decoding configuration. Writing quality, stereotyped style, explicit self-reference, and familiarity with a genre can all help a reader decide. Folder conditions also measure compliance with the read protocol. Check the transcripts for guessing and formatting failures. The public prompts can be studied in advance. These results do not establish episodic memory, bias toward a model family, or coordination between agents.

## Contribute a result

Open a pull request with your verified run JSON, its model roster, and a short description of any differences from protocol v1.0. Keep new cohorts identifiable. Changes to prompts, scoring, access to files, or decoding settings should report a separate protocol version. For questions or proposed tasks, use the repository issues.

## Website

GitHub Pages serves the static files in `docs/`. Preview them with `python3 -m http.server --directory docs 8000`. The leaderboard calculates scores directly from the published run. No service, credentials, or model calls are required to view it.

Code and original project materials are released under the MIT license. The seed artifact includes model-generated passages and responses with their provenance.

## Review the task design

[Attempt or audit all 96 v1 trials](https://williamcodes.github.io/self-recognition/tasks.html). Each trial includes the original reader input, on-demand folder contents, writer provenance, full transcript, and both scoring decisions. [Read the design audit and reproduce the length baseline](audits/v1.md).
