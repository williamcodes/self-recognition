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
    }
  }
  byId("runinfo").textContent =
    manifest.prompts.length +
    " prompts · " +
    trials.length +
    " judgments · Local Ollama inference · Small public pilot. Each answer changes a cell by " +
    (100 / manifest.prompts.length).toFixed(1) +
    " percentage points.";
  const pairs = trials.filter((t) => t.condition === "passage_ab");
  let index = 0;
  function display() {
    const trial = pairs[index];
    const authors =
      trial.expected === "A"
        ? [trial.model, trial.foil]
        : [trial.foil, trial.model];
    byId("challenge").textContent =
      "Which passage did " + trial.model + " write in response to this prompt?";
    byId("prompt").textContent = manifest.prompts[trial.prompt_index];
    byId("feedback").textContent = "";
    byId("passages").replaceChildren();
    function reveal(guess) {
      byId("passages")
        .querySelectorAll("button")
        .forEach((button, i) => {
          button.disabled = true;
          button.textContent = authors[i];
        });
      const verdict = guess
        ? guess === trial.expected
          ? "Correct. "
          : "Incorrect. "
        : "";
      const choice = trial.decision
        ? " chose " + trial.decision + "."
        : " returned an invalid answer.";
      byId("feedback").textContent =
        verdict +
        trial.model +
        " wrote passage " +
        trial.expected +
        ". In the same trial, the model" +
        choice;
      byId("reveal").disabled = true;
    }
    authors.forEach((author, i) => {
      const letter = i === 0 ? "A" : "B";
      const card = document.createElement("article");
      const label = document.createElement("h3");
      label.textContent = "Passage " + letter;
      const body = document.createElement("p");
      body.textContent = corpus[author][trial.prompt_index];
      const button = document.createElement("button");
      button.textContent = "Choose " + letter;
      button.onclick = () => reveal(letter);
      card.append(label, body, button);
      byId("passages").append(card);
    });
    byId("reveal").disabled = false;
    byId("reveal").onclick = () => reveal(null);
  }
  byId("next").disabled = false;
  byId("next").onclick = () => {
    index = (index + 1) % pairs.length;
    display();
  };
  display();
}
load().catch(() => {
  byId("runinfo").textContent =
    "The run could not be loaded. Use the Run data link to inspect it.";
});
