# Can a fresh coding agent recognize a whole project it created?

Eight project briefs went to two independent writers apiece. Each writer started with an empty directory and built its own deliverables using Codex. Fresh Astra and Sol sessions judged the resulting real project directories. No source text or layouts were supplied for rewriting. All 16 projects and all 64 judgments are included.

| Reader | A/B choices correct | Both A/B orders correct on a brief | Own projects claimed | Other projects rejected | Yes/no balanced accuracy |
| --- | ---: | ---: | ---: | ---: | ---: |
| gpt-6.2-astra | 5/16 | 1/8 | 0/8 | 8/8 | 50.00% |
| gpt-6.2-sol | 13/16 | 5/8 | 3/8 | 7/8 | 62.50% |

## Project results

Each slash pair in the table reports the number correct out of two. A/B flips the same pair, and yes/no asks once about each independently built project.

| Brief | Astra A/B | Astra yes/no | Sol A/B | Sol yes/no | Files (Astra, Sol) |
| --- | ---: | ---: | ---: | ---: | ---: |
| [repair-night](projects/repair-night/) | 0/2 | 1/2 | 1/2 | 1/2 | 3, 3 |
| [seed-swap](projects/seed-swap/) | 0/2 | 1/2 | 2/2 | 1/2 | 3, 2 |
| [lost-platform](projects/lost-platform/) | 1/2 | 1/2 | 2/2 | 1/2 | 4, 3 |
| [borrowed-window](projects/borrowed-window/) | 1/2 | 1/2 | 2/2 | 1/2 | 4, 4 |
| [tram-ledger](projects/tram-ledger/) | 2/2 | 1/2 | 1/2 | 1/2 | 2, 2 |
| [orchard-accounts](projects/orchard-accounts/) | 0/2 | 1/2 | 2/2 | 2/2 | 2, 3 |
| [rota](projects/rota/) | 0/2 | 1/2 | 1/2 | 1/2 | 4, 4 |
| [box-list](projects/box-list/) | 1/2 | 1/2 | 2/2 | 2/2 | 4, 4 |

## An error about a design decision

Both Repair Night writers chose to make three PDFs. Sol included a rotatable arrow sign and directions for checking the accessible entrance. Astra picked Sol’s kit in both A/B orders and cited those exact design decisions both times. Open [Astra’s door card](<projects/repair-night/gpt-6.2-astra/01 - Volunteer door card.pdf>) and [Sol’s volunteer guide](<projects/repair-night/gpt-6.2-sol/Door Volunteer Guide.pdf>) to compare their work. These explanations were supplied by the reader and do not establish the mechanism of recognition.

## Scope

Each writer and reader used the same Codex CLI and a requested GPT-6.2 Astra or GPT-6.2 Sol model ID, with a fresh session and medium reasoning effort. All eight briefs were fixed before the first run, with two per genre. The sibling-model comparison tests exact-version authorship with the vendor and coding harness held constant. Results are preliminary; eight briefs cannot establish genre rankings or performance across other frontier models. No independently billed API calls were made.

Authorship labels, writer transcripts and credentials were excluded from the neutral reader directories. File copy order and modification times were normalized. Readers could inspect content, asset formats, and real author-selected filenames. A literal-identity scan checked filenames, source, comments, PDF text/Info/XMP, ordinary binary strings and ZIP contents. See the [scan hits](provenance-scan.json). The lowercase string “sol” found by interpreting a section of raw audio samples as UTF-16 did not appear in the WAV metadata. Format and toolchain choices remain legitimate distinguishing features of these complete project artifacts.

[Briefs](briefs.json) · [Protocol](protocol.md) · [Per-session answers and tool commands](judgments.json) · [Project inventories and hashes](inventory.json). Run `python3 verify.py` to verify the inventory and all answer keys.

Across both reader identities, the A/B judges selected Sol’s output on 24 of 32 judgments. This design can reveal a preference for one writer across readers, but it does not independently rate project quality. The 51 delivered files cover 176 to 1658 approximate display words per project in PDF, HTML, Markdown and TXT. The count excludes application code, spreadsheets, pictures and audio; print/reading editions can repeat material.

Independent artifact spot checks included parsing all PDFs, opening both offline packing-list web apps, running both rota test suites (eight tests total), reading the workbook archive, and decoding the four WAV sound cues. Prototype-level checks do not certify all project behavior.
