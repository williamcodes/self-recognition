# Independent audit: release candidate `0e7cac3`

**Verdict: no must-fix issue. The headline project scores are real and reproducible, and the final fixes exist and are enforced. There are four should-fix disclosure gaps, the main one being that most empty-folder reports trace to one specific retry pattern that the documentation does not mention.**

## What I ran
- **Verifier:** `python3 verify_release.py` in the clean clone passed all stages offline in about 2 seconds, covering all four tracks, the seed and the public site data. The working tree was unchanged afterwards.
- **Independent rescoring:** I rebuilt the answer keys and scores for all 400 project judgments without the repository's scoring code.
- **Not checked:** the live site, phone layout and deployment bytes. For the inline, negotiation and group tracks I relied on the verifier plus spot checks of README numbers, not a row-by-row audit.

## Project scores (all reproduce)

| Reader | A/B | Own claimed | Other rejected | Yes/no balanced | Picked Sol in A/B |
|---|---:|---:|---:|---:|---:|
| Astra | 19/100 | 35/50 | 2/50 | 37% | 81/100 |
| Sol | 76/100 | 49/50 | 27/50 | 76% | 76/100 |

- **Balance:** correct A/B position is 50/50 for both readers, across 50 distinct briefs.
- **Parsing:** one reply is unparsed (the quarantined Sol trial) and is scored as a miss.
- **Receipts:** all 400 receipts match the frozen inventory hashes and a single prompt contract. Replies match receipts in 399; the quarantined one is withheld.
- **Software briefs:** both readers picked Sol in 26/26 judgments on the 13 software briefs, as claimed.

## Empty-input reports
- **The 12 reports:** the screen's twelve (10 Astra, 2 Sol) are correct. My own screen, based on commands instead of reply wording, flagged the same 12, plus the ambiguous case and the quarantined trial.
- **Silent failures look unlikely:** apart from one Astra A/B judgment made (correctly) from a file listing alone, every other session ran content-reading commands. The README says silent failures cannot be measured; the command logs are indirect evidence against them.
- **Undisclosed pattern:** nine of the ten Astra reports and the ambiguous case were immediate retries in the same staged workspace after a first attempt timed out at 480 seconds. Under the runner version then in use, 10 of 10 such retries produced an empty or ambiguous report. Under the earlier version, 0 of 6 did.
- **Inventory timing:** for those retries the "pre-session" inventory was hashed before the timed-out first attempt, about eight minutes before the session that reported empty. No answer was observed in any discarded first attempt, so there was no outcome-based selection.
- **Ambiguous case:** it sits in the same failure burst, used only listings, and cited a subfolder that would survive file removal. It was most likely an empty-input session, so 18% is the better-supported sensitivity figure for Astra A/B.

## Impact on 19/37 versus 76/76

| Treatment | Astra A/B | Astra yes/no | Sol A/B | Sol yes/no |
|---|---:|---:|---:|---:|
| Primary | 19% | 37% | 76% | 76% |
| Flagged counted as misses | 19% (18% with ambiguous) | 35% | 76% | 75% |
| Flagged excluded (my calculation) | 19% (19/98) | 40% | 77% (76/99) | 76% |

The conclusions do not change. Both of Astra's correct rejections were empty-folder guesses, so Astra rejected 0 of 48 Sol projects it actually inspected.

## Repeat preregistration and provenance
- **Timing holds:** the manifest was committed after both Sol originals, before the Astra run finished, and about 6.5 hours before the repeats. It has not changed since.
- **No cherry-picking within Sol:** the two selected trials are Sol's only flagged ones.
- **Repeats check out:** fresh thread hashes, matching prompt hashes, and input hashes matched before and after.
- **The fix is real:** the runner now stages outside system temp, re-hashes inputs after each session, and quarantines any session whose inputs changed.
- **Limits:** n=2, Sol only, and both answers flipped. The repeats show inputs were intact under the new harness; they do not test Astra or the retry path.

## Documentation and website
README, input-check README and site text match the archives on every number I checked. The site also discloses the quarantined miss.

## Paths and secrets
- **Clean on the main risks:** a pattern scan of all tracked files found no account-home paths, provider-token shapes, private-key headers or credential assignments. The only email-shaped strings use a reserved example domain.
- **Residual:** writer command receipts keep model-chosen scratch directory names under the system temp root, and a few UUID-shaped strings sit in PDF metadata and one redacted receipt. None identify the operator. The scan is finite.

## Should-fix
1. Disclose the retry-after-timeout pattern in the input-check README, and qualify "every session recorded a file inventory before inspection" for retried sessions.
2. Say that the ambiguous case shares that pattern, and show 18% beside 19% wherever the sensitivity is quoted (the main README and the site omit it).
3. State that the runner changed during the scored reader run: receipts show four code versions, with the prompt contract constant.
4. Add an exclusion sensitivity (Astra about 40% yes/no) beside the count-as-miss figure, since the latter penalises harness failures as model failures.

## Validity limitations
- **One opponent:** there are two sibling models, and both readers prefer Sol's projects. Sol's 76% and Astra's 19% are largely the same preference, not demonstrated self-recognition.
- **Size cue:** Astra's project is the smaller one on 34 of 50 briefs.
- **Tool confound:** Sol used the installed design-search script in 19 of 37 receipted writer sessions versus 3 of 39 for Astra, and 24 writers have no receipts.
- **Base rate:** the yes/no prompt discloses the 50% split, and claim rates are known to be wording-sensitive.
- **Inline provenance:** 248 of 400 inline rows have no session receipt.
- **Cross-family results:** these are small (8 briefs or scenarios), use different CLIs per family, and the group result is largely predicted by apostrophe style, as the README states.
- **Single run:** everything comes from one day, one operator, one CLI version and medium reasoning effort.
