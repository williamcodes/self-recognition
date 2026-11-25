# Subscription conversations

`SubscriptionRunner` delivers text turns through the installed Codex or Claude CLI and can continue a participant's exact session. Each fresh call starts in a separate working directory by default. Supply a stable key for each logical turn and keep the returned session dictionary private. Serialize turns sent to the same seat. Independent seats can run concurrently.

```python
from tracks.shared.subscription import SubscriptionRunner

with SubscriptionRunner("/path/to/private/receipts", workers=8) as runner:
    first = runner.ask("gpt-6.2-astra", "Remember the word amber.", key="seat-1/open")
    next_turn = runner.ask("gpt-6.2-astra", "What was the word?", session=first.session,
                           key="seat-1/recall")
```

Completed keys replay from receipts. Reusing a key with a different prompt, model, input session or working-directory argument fails. A completed CLI log can recover an interrupted receipt. An ambiguous, partly delivered turn requires inspecting the recorded standard output and standard error before restarting to avoid advancing the same private conversation twice. Set `offline=True` to permit cached replies only.

The runner uses the Codex subscription login or Claude subscription CLI, removes API credential and alternate-provider environment variables from child processes, and never invokes a separately billed API. Codex uses a private persistent CLI home linked to the existing login. Shell execution is disabled; transcripts containing tool use fail validation. Claude runs without tools. Both CLIs must return the same session ID when resuming. Claude's returned model ID must match the requested version. Codex reports the requested deployment alias; it does not expose a weight hash.

Keep receipt directories and the local CLI cache outside the public dataset. The public tracks contain the intended visible messages and scored decisions. The private receipt files are local audit and recovery material.
