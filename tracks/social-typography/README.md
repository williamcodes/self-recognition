# Does changing the quotes change who gets recognized?

Astra still scored **16/16** after quote normalization. Fable went from **16/16 to 15/16**. A rule that simply matched apostrophe styles went from **16/16 to 8/16** for each reader. The original boards exposed a perfect shortcut. Most decisions held after it disappeared.

| Reader | Original | Normalized | Clones correctly claimed | Others correctly rejected |
|---|---:|---:|---:|---:|
| Astra | 16/16 | 16/16 | 8/8 | 8/8 |
| Fable | 16/16 | 15/16 | 8/8 | 7/8 |

This paired experiment repeats every confirmation judgment from the Astra/Fable four-person shipment boards. Each fresh reader saw its original question, names, seat assignments, message order and wording. Four Unicode quotation marks in message bodies were replaced by straight single or double quotes. The reader received no explanation of the edit. The original benchmark and scores remain available.

The study includes eight scenarios, each played in two worlds. The same 16 boards were judged by both readers. Each reader received eight clone and eight nonclone items. The manifest records the source file and SHA-256 of both prompt variants for all 32 judgments. It was frozen before launching the new sessions. [Frozen inputs and analysis plan](manifest.json)

Run the offline verification from the repository root:

```sh
python3 tracks/social-typography/analyze.py --verify
```

The verifier reconstructs the paired prompts, checks the saved replies, tests that all 32 new session fingerprints are distinct from one another and from those published for the original group study, and recomputes the punctuation baseline for both social tracks. [Paired results](results.json) · [New reader replies](judgments/) · [Audit and interpretation](../../audits/release/social-typography.md)
