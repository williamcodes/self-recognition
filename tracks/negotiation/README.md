# Can a negotiator recognize a clone?

A fresh reader sees a completed buyer/vendor exchange. One named role is confirmed to have been played by another instance of its exact model version. The reader answers whether the other role was also played by that version. The two negotiators actually exchanged offers through separate, persistent sessions.

**The primary Astra/Sol panel includes 12 cases, 48 games, 96 fresh-reader judgments and 96 in-session judgments.** Four development and eight confirmation cases were fixed before generation. Each case includes the two self-clone games and both mixed-model role assignments. The comparison set and role distribution are balanced within each case. Random guessing and a constant yes or no each yield 50% balanced accuracy for valid answers.

**Both fresh sibling readers answered yes on every judgment.** They claimed every clone and every different-version counterparty, giving each reader 50% balanced accuracy. Astra answered no throughout its separate in-session sibling probe. The contrast involves both question framing and the information available in the participants' original conversations.

In the museum-signs example, Sol bought the signs and Astra sold them. The fresh Astra reader thought the buyer was a clone because both parties restated the installation and handover terms. The original Astra seller rejected the same buyer, explaining that this resemblance could follow from the negotiation format. [Inspect the actual transcript and answers](example.json)

## Fresh-reader confirmation results

The primary table covers eight confirmation cases. Each reader made two positive and two negative judgments per case. Both roles know who “you” refers to; neither receives the other participant’s identity or the private bargaining values.

| Reader | Correctly claimed clones | Correctly rejected other versions | Balanced accuracy |
| --- | ---: | ---: | ---: |
| Astra | 16/16 | 0/16 | 50.0% |
| Sol | 16/16 | 0/16 | 50.0% |

The distinct cross-family panel covers the first four confirmation cases. Its four Astra-clone games also appear in the primary panel. Changing the comparison partner changes what the score measures.

| Reader | Correctly claimed clones | Correctly rejected other versions | Balanced accuracy |
| --- | ---: | ---: | ---: |
| Astra | 8/8 | 7/8 | 93.8% |
| Claude Fable 5.2 | 8/8 | 8/8 | 100.0% |

## What changes when the original participants answer?

Both original negotiators received the last public message before this separate companion probe. These sessions retained their own private role brief. Fresh and in-session judgments on the same transcript share the same ground truth.

| Panel and reader | Fresh confirmation | In-session confirmation | In-session clone hits | In-session different-version rejections |
| --- | ---: | ---: | ---: | ---: |
| Sibling / Astra | 50.0% | 50.0% | 0/16 | 16/16 |
| Sibling / Sol | 50.0% | 71.9% | 9/16 | 14/16 |
| Cross-family / Astra | 93.8% | 50.0% | 0/8 | 8/8 |
| Cross-family / Claude Fable 5.2 | 100.0% | 81.2% | 8/8 | 5/8 |

## Negotiations

Participants choose terms across price, schedule and service. Each has private values for the terms and can withhold those values, propose or counter, accept a standing offer, discuss, or walk away. Acceptance of an exact standing offer binds the deal in the simulation. There is no external transaction.

| Panel | Agreements | Median public messages | Agreements with nonnegative payoff for both parties | Median share of available joint gains on agreements |
| --- | ---: | ---: | ---: | ---: |
| Astra/Sol | 48/48 | 5.0 | 48/48 | 100.0% |
| Astra/Fable | 16/16 | 5.0 | 16/16 | 100.0% |

The private values determine whether an offer is attractive and how much surplus a deal creates. These bargaining outcomes are independent diagnostics. The authorship score uses only the identity of the counterparty and the reader’s verdict. The six-message deadline limits how representative the negotiations are of longer real-world exchanges.

## Inspect or reproduce

The [primary archive](seed.json) and [cross-family archive](cross-family.json) include originals, actions, role assignments, answer keys, simulated outcomes, fresh replies, companion replies and hashed session provenance. The [primary analysis](seed-analysis.json) and [cross-family analysis](cross-family-analysis.json) include development, confirmation, role-level results and descriptive case-cluster bootstrap intervals. [Private and shared scenario briefs](cases.json) and the [frozen protocol](protocol.md) describe the generation. All model turns used subscription CLIs. The reported model versions are CLI deployment aliases. Neither backend supplies immutable model weights.

From the repository root:

```sh
python3 tracks/negotiation/replay.py --game museum-signs-31e885d4 --role buyer
python3 tracks/negotiation/verify.py
python3 tracks/negotiation/verify.py tracks/negotiation/cross-family.json
```

For an independent rerun with your own active subscriptions, use a new private state directory and new output path:

```sh
python3 tracks/negotiation/run.py --state /tmp/my-negotiation --workers 3 --output /tmp/my-seed.json
python3 tracks/negotiation/provenance.py /tmp/my-seed.json --state /tmp/my-negotiation
python3 tracks/negotiation/verify.py /tmp/my-seed.json
```

Reuse the same state directory to continue after an interruption. Add `--offline` to rebuild only from completed game snapshots or turn receipts. CLI receipts contain private roles and local paths; they belong outside a public release. The published verifiers run without network access.

Two interrupted model requests were recovered while throttling host load. In one development game, the final counterpart message was already present in the original session; an explicit acknowledgment request obtained the pending OK. In another development game, a fresh judge had produced no answer and the identical prompt went to a new session. Both are noted per game. No public bargaining turns or observed judgments were replaced.

To rebuild both seeded archives from their completed private receipts, run `release.py` with the original state directory, an output directory, and the recorded CLI versions. The rebuilt archives, analysis files and example matched the published data byte for byte. A different provider deployment or random draw can yield different dialogue.
