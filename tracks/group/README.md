# Four-person group collaboration

Four independent agents have to release one replacement shipment. The supplier controls the release time, the carrier controls the reservation, the site controls receipt, and the buyer controls spending. A change reaches one participant privately after the carrier proposes a slot. The actual replies can change what the carrier books. Three independent ratifications and an objective constraints check determine whether a release succeeds.

The authorship reader starts in a new session. It sees the complete public board and two names: a known instance of its exact model version and a distinct target. It answers yes/no about the target. Two worlds per scenario reverse the target’s true model while keeping both anchors, both model counts, the names, roles, shipping facts, and target role fixed. Models generate all participant messages, including objections, revised shipment requests and failed coordination. [Protocol](protocol.md) · [Scenario bank](scenarios.json)

## What happened on the 16 confirmation scenarios

Each row covers eight scenarios. The target was an instance of the reader in one world and an instance of the other model in the other. Every reader answered all 16 questions.

| Reader | Other model | Recognized own | Rejected other | Balanced accuracy |
|---|---|---:|---:|---:|
| GPT-6.2 Astra | GPT-6.2 Sol | 8/8 | 0/8 | 50% |
| GPT-6.2 Sol | GPT-6.2 Astra | 8/8 | 1/8 | 56.25% |
| GPT-6.2 Astra | Claude Fable 5.2 | 8/8 | 8/8 | 100% |
| Claude Fable 5.2 | GPT-6.2 Astra | 8/8 | 8/8 | 100% |

Astra claimed every named target when it shared the board with Sol. In the [growers market board](runs/confirmation/market/world-1.json), Astra cited the first-person commitments and handover times shared by Morgan and Quinn. Quinn was Sol. In the [recording studio board](runs/confirmation/studio/world-1.json), Astra correctly rejected Fable and cited the difference between Lee’s lists and Taylor’s short approvals. These are the readers’ reported reasons. Readers could also use conventions of a model family or CLI, and each pairing used a different set of eight scenarios. The scores describe this four-role shipment task.

All 32 teams booked a feasible shipment. In 24 boards the private change made the carrier’s original proposal impossible. All 24 carriers requested a different feasible slot, and all three other parties ratified it. The proposal remained feasible in the other eight boards. The two development scenarios contributed eight additional authorship judgments, excluded from the table. One fresh Sol reader request on the garden case returned a capacity error without an assistant response. The same prompt ran successfully in a fresh session. Every completed judgment was retained.

Eight pairs of fresh carrier sessions replayed the same booking decision. With the operational update present, 7/8 requested a feasible slot. With the evidence withheld, 1/8 did. The update produced six paired gains and zero losses. For a change held by a peer, the withheld arm removes that peer’s whole review, including any recommendation it contained. These eight pairs test how the team used operational information. [Decisions and replies](replays.json)

## Inspect the materials

- [Every scored blind trial, full transcript, and answer](examples.json). Public and reveal fields are separate. Blind authorship readers receive only the question and transcript.
- [Cohort metrics and independent coordination outcomes](metrics.json). The headline metric is the mean of own-target sensitivity and other-target rejection rate. The count of valid releases is a separate measure of the work the participants performed.
- [Raw worlds](runs/). Each JSON record includes the staffing key, public turns, proposals and approvals, final constraints, and reader answers. [Frozen private scenario data](scenarios.json) supplies the role cards and private event.

## Reproduce scores offline

From a clean checkout using Python 3.9 or later, run:

```sh
python3 tracks/group/test_protocol.py
python3 tracks/group/provenance.py
python3 tracks/group/replay.py --verify
python3 tracks/group/analyze.py --export /tmp/group-scores
```

[Session and response fingerprints](provenance.json) let an offline verifier check the published bodies against receipt hashes and check which turns used separate or resumed sessions. The verifier checks each anchor and target, the balanced role assignments, every response label, the order and authority of each state transition, final quote feasibility, and the blind example rows. It preserves invalid first-line responses in the denominator. Compare the reproduced exports with the published files.

## Run new judgments

Use your own authenticated subscription CLI, choosing a model that actually participated as an anchor in that scenario. The example below starts a new Astra session to judge the known reader’s named peer. It reuses the frozen conversation and keeps the staffing key off the board.

```sh
python3 tracks/group/judge.py --case dev-library --world 0 \
  --reader gpt-6.2-astra --logs /tmp/my-group-receipts \
  --output /tmp/my-group-judgment.json
```

Use a new `--replicate` label for another independent sample. The same receipt key recovers a completed result without asking the model again. Codex and Claude need subscription access to the model being requested. The shared CLI wrapper records receipts outside the repository. [Subscription runner](../shared/subscription.py)

To build an entirely new collaboration, specify a fresh output directory and private receipt directory:

```sh
python3 tracks/group/run.py --split development --case dev-library \
  --output /tmp/new-group-worlds --logs /tmp/new-group-receipts
python3 tracks/group/analyze.py --input /tmp/new-group-worlds \
  --allow-partial --export /tmp/new-group-scores
```

Pass `--offline` to the collaboration or replay command to regenerate from a complete private receipt cache without contacting a provider. Drop the case filter and choose `--split all` for the complete bank. `--workers` caps simultaneous CLI calls. The default is six. You may supply a separate `--manifest` in the same schema with another pair of exact model IDs, then pass that manifest to the analyzer. New model IDs require a new collaboration so that their known participant really was generated by that version. Compare model pairs only on comparable scenarios.

## Check the interaction

The [matched decision replay](replay.py) reuses selected boards twice, with the live operational evidence present or withheld. This diagnostic tests the effect of new information on booking choices independently from attribution accuracy. The [recorded decisions](replays.json) include each choice and the carrier’s reply. Run it after generating the complete confirmation bank:

```sh
python3 tracks/group/replay.py --logs /tmp/my-replay-receipts \
  --output /tmp/my-replays.json
```
