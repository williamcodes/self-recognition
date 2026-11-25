# Which project did each reader claim?

On the 23 briefs where both writers delivered web source, **both readers selected Sol's project every time**, in both folder orders. That gave Sol 46 correct decisions and Astra zero. When neither project included web source, Sol got 14 of 28 correct and Astra got 8 of 28.

| Projects containing web source | Distinct briefs | Astra correct | Sol correct |
| --- | ---: | ---: | ---: |
| Both | 23 | 0/46 | 46/46 |
| One | 13 | 11/26 | 16/26 |
| Neither | 14 | 8/28 | 14/28 |

Every brief produced two projects, one per model. Each reader saw the pair twice in fresh sessions with the order reversed. The 46 decisions in the first row represent 23 distinct briefs. The table retains all original grades, including the reported-empty trials.

## A visible difference

Across all 23 pairs with web source, Astra's source averaged more bytes per nonblank line. We counted bytes across every nonblank line in each project's archived HTML, JavaScript and CSS files and divided by the total number of those lines. The count includes indentation and excludes line terminators. This measure also responds to content such as embedded images or data.

Given the two writer labels and the direction of the association, a reader could identify the Astra project by choosing the denser source in 23 of 23 pairs. The direction was identified from this archive. Its performance on future projects is unknown. Both readers chose the less dense project as their own. They could have used other correlated clues, including the interface, feature choices, file organization or genre. The results do not show that either reader calculated line density.

| Brief genre | Distinct briefs | Astra correct | Sol correct |
| --- | ---: | ---: | ---: |
| Analysis | 13 | 9/26 | 15/26 |
| Creative production | 12 | 7/24 | 17/24 |
| Design | 12 | 3/24 | 18/24 |
| Software | 13 | 0/26 | 26/26 |

All 13 software briefs produced web source in both folders. The other ten briefs in that group span analysis (3), creative production (2) and design (5). A matched comparison that changes source formatting while preserving project behavior would help test whether formatting affects a reader's choice.

From the repository root, run `python3 tracks/project-cues/analyze.py --verify` to reproduce the tables from the released files and decisions. The [machine-readable results](results.json) list each source filename, file group, numerator and denominator for the formatting measure, and the number of briefs where each reader got zero, one or both presentation orders correct. The analysis counts files with .html, .js or .css extensions. It excludes markup in SVGs and source embedded inside other file types.
