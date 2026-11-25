# Independent final release audit

Claude Fable 5.2 received William's original task descriptions and the [acceptance rubric](fable-rubric.md). The first review ran in a separate checkout containing all four result archives. The second ran in a fresh clone of the deidentified release candidate, with the added file-integrity screen and repeats. Both used fresh Claude Code sessions authenticated through a Claude subscription. The [first prompt](final-fable-prompt.txt), [second prompt](final-fable-closure-prompt.txt), and [input hashes](final-fable-inputs.json) identify the scope. The review texts below are verbatim. Any changes made in response are documented separately.

## Independent check of the project arithmetic

A separate count decoded the first line of each public reply and reconstructed the expected answer from the ordered author list. Astra selected its own project 8/50 times when it occupied A and 11/50 when it occupied B. It accepted 35/50 of its own projects and rejected 2/50 Sol projects. Its A/B accuracy was 19% and its balanced yes/no accuracy was 37%. It answered all 200 questions.

Sol selected its own project 39/50 times in A and 37/50 in B. It accepted 49/50 of its own projects and rejected 27/50 Astra projects. One withheld answer counted as a miss. Its two scores were both 76%. The 20 Astra attempts that timed out had no answer and preceded a completed trial. The primary archive contains all 400 planned judgments from 50 distinct briefs.

Both readers chose Sol's project in every A/B presentation of the 13 software briefs. Across all 50 briefs Astra chose Sol in both orders on 35, itself in both orders on four, and opposite authors on 11. This establishes a repeated preference for Sol's work under the recognition prompt. It does not by itself establish why the readers preferred it.

Ten Astra replies and two Sol replies reported empty inputs. Nine of Astra's ten reports came from 18 trials that had an earlier timeout. One came from the other 182 trials. Historical terminal output and post-session file hashes were unavailable. If every explicitly flagged Astra trial had received credit, Astra's maximum would be 21% A/B and 43% yes/no; that calculation covers the identified reports. The released [integrity screen and repeat results](../../tracks/project-input-check/README.md) include the opposite sensitivity calculation.

## Disposition of the integration review

The [integration reviewer](final-fable-integration.md) flagged an incomplete project disclosure. The later release candidate publishes all 12 explicit reports and the ambiguous thirteenth, shows the counts behind the scores, and reports two separately frozen, integrity-checked Sol repeats. It also reports the web-source formatting pattern. Attribution to formatting remains a hypothesis because changing the source formatting while keeping a project fixed was not tested. The core panel has one opposing model per reader. The multi-agent tracks use the named-target yes/no form William described.

Two details in the unedited review need correction. The two negotiation panels together contain 60 distinct transcripts. After accounting for shared games they have 120 distinct fresh-reader decisions and 120 distinct original-participant decisions, 240 combined. A reader's statement that files were absent is evidence of its experience. The original sessions did not retain terminal output or post-session hashes that could independently establish physical deletion.

## Closure review

The [second reviewer](final-fable-closure.md) found no release-blocking defect in candidate `0e7cac3`. It identified four disclosure improvements concerning the timing of inventory hashes before retries, one additional ambiguous A/B presentation, runner changes during collection, and additional sensitivity estimates. The [project integrity report](../../tracks/project-input-check/README.md) provides the investigation and calculations.

The closure review's phrase “actually inspected” goes beyond the records available. Among the 48 Sol-authored projects left after excluding two explicit empty reports in Astra's negative class, Astra rejected zero. All 48 had pre-session inventory records. Commands show inspection attempts, while the original harness did not retain the tools' output or verify files after the reader finished. The review's “single CLI version” remark applies to the core project experiment. The multi-agent cross-family tracks used both Codex and Claude Code.

