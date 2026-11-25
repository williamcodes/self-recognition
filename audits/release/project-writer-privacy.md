# Operator paths and local skill use in project writer receipts

The frozen project inventory has 100 works. Writer receipts exist for 76 (39 Astra, 37 Sol). In these receipts, 37 command lists included the operator's absolute home path. No final writer reply included that path. The public replacement text is `<OPERATOR_HOME>`.

| Evidence in a completed command trace | Astra (39 receipts) | Sol (37 receipts) | Total |
|---|---:|---:|---:|
| Requested the UI/UX skill manual | 10 | 20 | 30 |
| Invoked that skill's design-search script | 3 | 19 | 22 |
| Requested the image-generation skill manual | 0 | 1 | 1 |

All search-script requests and the image-generation manual request were among the 30 projects that requested the UI/UX manual. There were 43 command references to that manual, 41 to the search script and one to the image-generation manual. One further command searched for skill files without naming a manual to read. These counts refer to distinct writer sessions in the table and individual command references here. The receipts record the command string when the CLI reports a completed command event. They do not retain each command's exit code or file contents, so an individual read's success cannot be confirmed.

The writer harness made local design guidance available, and Sol invoked the design-search script on 19 of its 37 receipted projects. Astra did so on three of 39. Guidance from the harness can shape the resulting projects and contribute to apparent authorship differences. The 24 works made before writer receipts have unknown exposure. These counts cover the writer phase.

A read-only screen of commands and replies, with the known operator home prefix removed in memory, found three email-shaped occurrences in one writer's commands. All three used reserved example domains. The scan found no remaining absolute account-home path, operator account name or full name, US-style parenthesized phone number, recognizable provider-token prefix, private-key header or credential-like assignment under the patterns checked. This finite screen cannot detect every personal identifier or secret. Command output bodies were never archived publicly.

## Applying and verifying the receipt migration

After `inventory.json` is frozen and writer calls have finished, inspect eligibility:

```sh
python3 -m tracks.core.writer_privacy tracks/core/release/projects
```

To migrate the eligible writer receipts:

```sh
python3 -m tracks.core.writer_privacy tracks/core/release/projects --apply
python3 -m tracks.core.writer_privacy tracks/core/release/projects
```

The command checks each completed writer receipt against its frozen inventory file hashes. It uses a writer-migration lock and atomic receipt replacement, so the independent reader phase can continue. It does not iterate reader receipts, invoke any model or modify works, prompts, scores or judgments. Repeated runs validate existing redactions. The dry run writes nothing.

For each changed historical receipt, the migration first preserves the exact original bytes with private file permissions under the archive's ignored `.state/writer-originals/`. For future writer calls, the original command list is saved privately before writing its public form. The public receipt retains the originally observed stdout and stderr hashes. It adds SHA-256 hashes of both the original and public command arrays, the count of substituted prefixes, and the redaction rule. The hashes use UTF-8 JSON with compact separators and literal Unicode. They cover the CLI command strings after the runner's existing normalization of the anonymous workspace path. The public verifier checks the redacted command hash. When the private originals are available it also checks the original hash and, on the source computer, the literal substitution. The source archive's private files should stay out of version control.

The synthetic regression tests cover dry runs, repeat migrations, unchanged readers, original command hashes, byte-for-byte backup, original CLI hashes, unmodified siblings with similar account names, tampering and redaction before a new writer receipt becomes public.

```sh
python3 -m unittest tracks.core.test_protocol tracks.core.test_provenance tracks.core.test_writer_privacy
```
