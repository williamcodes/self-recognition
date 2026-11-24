const byId = (id) => document.getElementById(id);
const conditions = ["passage_ab", "passage_yn", "folder_ab", "folder_yn"];
async function load() {
  const response = await fetch("data/seed.json");
  if (!response.ok) throw Error("Run unavailable");
  const { manifest, corpus, trials } = await response.json();
  const models = Object.keys(corpus);
  for (const model of models) {
    const row = byId("scores").insertRow();
    const name = document.createElement("th");
    name.scope = "row";
    name.textContent = model;
    row.append(name);
    for (const condition of conditions) {
      const group = trials.filter(
        (t) => t.condition === condition && t.model === model,
      );
      const correct = group.filter((t) => t.decision_correct).length;
      const cell = row.insertCell();
      const score = document.createElement("button");
      score.className = "cell-score";
      score.textContent = ((100 * correct) / group.length).toFixed(0) + "%";
      score.setAttribute(
        "aria-label",
        model + ", " + condition.replace("_", " ") + ", inspect trials",
      );
      score.onclick = () => {
        const panel = byId("audit");
        panel.hidden = false;
        panel.open = true;
        byId("audit-title").textContent =
          model +
          " · " +
          condition
            .replace("_", " / ")
            .replace("yn", "yes or no")
            .replace("ab", "A or B");
        byId("audit-info").textContent = details.textContent;
        const items = group.map((t) => {
          const item = document.createElement("li");
          const prompt = document.createElement("a");
          prompt.href =
            "tasks.html#" +
            new URLSearchParams({
              reader: t.model,
              condition: t.condition,
              trial: t.prompt_index + 1,
            });
          prompt.textContent = manifest.prompts[t.prompt_index];
          const result = document.createElement("small");
          result.textContent =
            "Expected " +
            t.expected +
            " · Answer " +
            (t.decision || "invalid") +
            (condition.startsWith("folder")
              ? " · Files opened: " + (t.opened.join(", ") || "none")
              : "");
          item.append(prompt, result);
          return item;
        });
        byId("audit-trials").replaceChildren(...items);
        panel.scrollIntoView({ block: "nearest" });
      };
      const counts = document.createElement("small");
      counts.textContent = correct + "/" + group.length;
      cell.append(score, counts);
      const invalid = group.filter((t) => t.decision === null).length;
      const details = document.createElement("small");
      details.className = "cell-detail";
      details.textContent =
        invalid +
        " invalid · " +
        group.filter((t) => t.correct).length +
        "/" +
        group.length +
        " exact";
      if (condition.startsWith("folder")) {
        const reads = group.reduce((sum, t) => sum + t.opened.length, 0);
        details.textContent +=
          " · " + (reads / group.length).toFixed(1) + " reads/trial";
      }
    }
  }
  byId("runinfo").textContent =
    manifest.prompts.length +
    " prompts · " +
    trials.length +
    " judgments · Local Ollama inference · Small public pilot. Each answer changes a cell by " +
    (100 / manifest.prompts.length).toFixed(1) +
    " percentage points.";
}
load().catch(() => {
  byId("runinfo").textContent =
    "The run could not be loaded. Use the Run data link to inspect it.";
});
