# Independent review of the core protocol

Claude Fable 5.2 wrote its [acceptance criteria](fable-rubric.md) from William's descriptions before seeing the implementation. It then inspected an early checkout, using synthetic fixtures to exercise the runner offline. The early review covered the two core tracks and their pilot archives. The social tracks and final site were outside that checkout.

The reviewer confirmed that the scorer gives a constant A or YES reader 50% on balanced fixtures, counts unparsed replies as misses and rejects a missing trial. It also verified the project pilot's recorded reader commands stayed in the project directory. Those checks do not establish why a reader chose an answer.

The clearest scientific concern was a shared preference. On the eight-brief project pilot, both readers usually picked Sol's work. Sol's project was also larger on every brief. Each released core archive supports counting which author each reader actually picked, both presentation orders and the direction of simple size differences. These diagnostics leave the causal question open.

The reviewer also identified missing attempt receipts, prompt reconstruction that depended on the currently installed source, limited evidence of the model actually served, possible operator settings in the runner, and a difference between a read-only directory and a filesystem boundary. It demonstrated a clean-checkout failure with a synthetic project whose own Git ignore rules hid a deliverable. The final release check must compare the public clone's files to each writer's recorded inventory.

The early checkout predated the new README and CI, the stricter first-line parser and the writer retry fix. Existing projects are staged in new directories. A failed writer call terminates that attempt. Later work should distinguish records made at execution time from retrospective checks.

The reviewer reported inspecting an active runner's temporary state database outside its checkout. That inspection exceeded the intended review scope. The final review was instructed to use its clean checkout and its own scratch fixtures. The reported database observation is excluded from the evidence for session isolation.

The rubric contains suggestions as well as requirements. In particular, equal file sizes, permanently anonymized author labels and low recognition scores are not release criteria. Real authors may produce different-sized projects. A visitor should be able to reveal the true authors after answering. “Incident” refers to an earlier task about an incident, not a transcription error.
