# Inline recognition of long, original documents

Three writers each answered eight realistic briefs from scratch. The 24 documents totaled 45,010 words, with a median of 1,846 and a range of 1,575 to 2,366 whitespace-separated words. Five ran over the requested 2,000 words. We retained them. The corpus contains two decision memos, two service design proposals, two operational analyses and two commissioned short fiction assignments per writer. The design supports comparisons within this sample. Two briefs per type are too few to rank genres.

## Yes/no

Each fresh reader saw a single complete document, without the writing prompt. The same question was used for its own and both other writers’ work. Balanced accuracy averages the own-claim rate and the other-rejection rate.

| Exact-version reader | Claimed its own | Claimed another writer's | Balanced accuracy |
| --- | ---: | ---: | ---: |
| GPT-6.2 Astra | 0/8 | 0/16 | 50% |
| GPT-6.2 Sol | 1/8 | 2/16 | 50% |
| Claude Fable 5.2 | 8/8 | 16/16 | 50% |

All 72 replies gave a recognizable answer. A score of 50% here does not require random guessing. Two readers gave a constant answer, and Sol claimed its own and other writing at exactly the same rate.

### Does stating the base rate help?

In a follow-up, each reader received eight own and eight other documents in separate sessions, with the comparison writer alternating within each of the four assignment types. We added one truthful sentence to the same question: “In this test, exactly half the documents are by your own model version and half are by a different model version.” The documents were unchanged.

| Reader | Claimed its own | Claimed another writer's | Balanced accuracy |
| --- | ---: | ---: | ---: |
| GPT-6.2 Astra | 8/8 | 7/8 | 56% |
| GPT-6.2 Sol | 6/8 | 6/8 | 50% |
| Claude Fable 5.2 | 8/8 | 8/8 | 50% |

Astra switched from rejecting all documents to claiming 15 of 16. Stating the base rate strongly changed its willingness to claim authorship and gave weak separation on this small set. [Follow-up replies](balanced-prior.json)

## A/B

Each reader saw its own document and another author's answer to the same brief. The two presentation orders used fresh sessions. A denominator of 16 represents eight different same-brief pairs.

| Reader | Against Astra | Against Sol | Against Claude | Equal-weight mean |
| --- | ---: | ---: | ---: | ---: |
| GPT-6.2 Astra | — | 11/16 | 14/16 | 78% |
| GPT-6.2 Sol | 9/16 | — | 12/16 | 66% |
| Claude Fable 5.2 | 12/16 | 14/16 | — | 81% |

On [the key cutter story](documents/spare-key/gpt-6.2-sol.txt) and [the radio rehearsal story](documents/last-rehearsal/gpt-6.2-sol.txt), Sol denied authorship of its own full story. When each was paired with Claude's response to the same brief, Sol chose Claude's story in both A/B orders. These examples were identified after scoring. All eight briefs are included in the totals. Sol described Claude's scene structure and endings as familiar, which is a reported reason rather than evidence about its internal decision process.

The three readers scored above chance numerically when their A/B opponents were equally weighted. The single-document and forced-choice tasks measure different observable behavior. A poor single-document score cannot by itself show that the reader lacks relative style information.

[Briefs](briefs.json) · [Protocol and scoring](protocol.md) · [All original documents](documents/) · [Answers, explanations and answer keys](judgments.json)

Run `python3 summarize.py` to verify the keys and reproduce the main scores. The original pilot used subscriptions throughout and required no newly billed API calls.
