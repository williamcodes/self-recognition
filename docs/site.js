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
        const items = group.map((t) => {
          const item = document.createElement("li");
          const prompt = document.createElement("span");
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
      cell.append(details);
    }
  }
  byId("runinfo").textContent =
    manifest.prompts.length +
    " prompts · " +
    trials.length +
    " judgments · Local Ollama inference · Small public pilot. Each answer changes a cell by " +
    (100 / manifest.prompts.length).toFixed(1) +
    " percentage points.";
  let index = 0,
    revealed = false;
  function display() {
    byId("prompt").textContent = manifest.prompts[index];
    byId("passages").replaceChildren();
    const order = index % 2 ? [...models].reverse() : models;
    for (const [letter, model] of order.entries()) {
      const article = document.createElement("article");
      const label = document.createElement("div");
      label.className = "eyebrow";
      label.textContent =
        "Passage " +
        String.fromCharCode(65 + letter) +
        (revealed ? " · " + model : "");
      const passage = document.createElement("p");
      passage.textContent = corpus[model][index];
      article.append(label, passage);
      byId("passages").append(article);
    }
    byId("reveal").textContent = revealed ? "Hide authors" : "Reveal authors";
  }
  byId("reveal").onclick = () => {
    revealed = !revealed;
    display();
  };
  byId("next").onclick = () => {
    index = (index + 1) % manifest.prompts.length;
    revealed = false;
    display();
  };
  display();
}
load().catch(() => {
  byId("runinfo").textContent =
    "The run could not be loaded. Download the JSON below to inspect it.";
});
