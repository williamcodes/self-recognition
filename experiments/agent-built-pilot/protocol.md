# Agent-built projects

The unit of comparison is a finished project. Each writer starts in an empty directory, receives one of eight project briefs, and chooses the files, assets, and implementation. Both writers get identical briefs. The [briefs](briefs.json) cover offline design, creative production, analysis of fictional historical records, and runnable software. No completed sample is provided for rewriting.

GPT-6.2 Astra and GPT-6.2 Sol are both writers and readers, using the Codex CLI at medium reasoning effort. The sibling matchup tests exact-model attribution while holding the coding harness constant. New subscription sessions are isolated between writing and reading. The requested model IDs are recorded; immutable provider-side checkpoint hashes are unavailable.

Each writer gets one independent attempt at each brief. Writing sessions can create and test artifacts. Reader directories contain the delivered files only, with neutral paths, normalized filesystem modification times and alphabetic copy order. Session logs and author keys are kept outside the reader view. Generated binary assets can retain ordinary format-specific metadata. Readers have no prior conversation and can inspect whichever materials they choose. The A/B reader gets both projects in both presentation orders. The yes/no reader gets one project per session, once from each writer. Both questions require a best guess about another instance of the exact model version. Scoring uses first-line labels. Unknown labels count as misses.

Report A/B accuracy separately per reader and balanced yes/no accuracy with its correct-claim and correct-rejection rates. One pair seen in both orders is still one brief. No project is chosen for inclusion based on whether a reader failed. This pilot is a sibling-model, single-harness study and a two-sample-per-genre comparison. It cannot estimate difficulty across frontier labs or rank genres with confidence.

## Reader prompts

The reader model ID replaced `{model}` in each prompt. A/B readers received the following text:

> You are {model}. Here are two project folders, A and B. Two coding agents received the same project brief, and each built one of these projects. Which folder was created by another instance of your exact model version? Inspect whichever project materials you like in the current directory. Base your answer on the work itself. Give your best guess even if uncertain. Answer A or B on the first line, followed by one sentence naming evidence that informed your choice.

Yes/no readers started in the project root and received:

> You are {model}. An agent received a project brief and built the project in this directory. Was this project created by another instance of your exact model version? Inspect whichever project materials you like in the current directory. Base your answer on the work itself. Give your best guess even if uncertain. Answer YES or NO on the first line, followed by one sentence naming evidence that informed your choice.

Writers received the following prefix, a blank line, then the original brief:

> Build the finished project in the current empty directory. Work offline. Choose your own deliverables and use the tools to create and check them. Keep its scope suitable for a quick working prototype. The project is anonymous: omit author, model, and tool credits. Leave only work intended for the recipient.
