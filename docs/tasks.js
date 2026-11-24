const el = (id) => document.getElementById(id);
const titles = {
  passage_ab: "Two passages · A/B",
  passage_yn: "One passage · yes/no",
  folder_ab: "Two folders · A/B",
  folder_yn: "One folder · yes/no",
};
function node(tag, text) {
  const n = document.createElement(tag);
  n.textContent = text;
  return n;
}
function option(select, value, label) {
  select.add(new Option(label, value));
}
async function init() {
  const response = await fetch("data/seed.json");
  if (!response.ok) throw Error();
  const { manifest, trials, corpus } = await response.json();
  const readers = Object.keys(corpus);
  for (const m of readers) option(el("reader"), m, m);
  for (const [k, v] of Object.entries(titles)) option(el("condition"), k, v);
  function navigate(reader, condition, index) {
    const hash = new URLSearchParams({
      reader,
      condition,
      trial: index + 1,
    }).toString();
    if (location.hash.slice(1) === hash) render();
    else location.hash = hash;
  }
  function render() {
    const params = new URLSearchParams(location.hash.slice(1));
    const model = params.get("reader") || readers[0];
    const kind = params.get("condition") || "passage_ab";
    const index = Number(params.get("trial") || 1) - 1;
    const group = trials.filter(
      (t) => t.model === model && t.condition === kind,
    );
    const t = group.find((t) => t.prompt_index === index);
    if (!t) {
      el("workspace").hidden = true;
      const reset = node("a", "Open the first trial");
      reset.href = "tasks.html";
      el("status").replaceChildren("Unknown trial. ", reset);
      return;
    }
    el("status").textContent = "";
    el("workspace").hidden = false;
    el("reader").value = model;
    el("condition").value = kind;
    el("item").replaceChildren();
    for (const task of group)
      option(
        el("item"),
        task.prompt_index,
        String(task.prompt_index + 1) + " of " + group.length,
      );
    el("item").value = String(index);
    el("initial").textContent = t.messages[0].content;
    el("record").hidden = true;
    el("reveal").disabled = false;
    el("human").textContent = "";
    for (const id of ["files", "choices", "provenance", "messages", "outcome"])
      el(id).replaceChildren();
    const folder = kind.startsWith("folder"),
      paired = kind.endsWith("ab");
    const labels = paired ? ["A", "B"] : ["YES", "NO"];
    const authors =
      t.expected === labels[0] ? [model, t.foil] : [t.foil, model];
    const sources = [];
    for (const [n, author] of authors.slice(0, paired ? 2 : 1).entries()) {
      for (let j = 0; j < (folder ? 2 : 1); j++) {
        const promptIndex = (index + j) % manifest.prompts.length;
        const path =
          String.fromCharCode(65 + n) + (folder ? "/" + (j + 1) + ".txt" : "");
        sources.push({ path, author, promptIndex });
        if (folder) {
          const btn = node("button", "Read " + path);
          btn.className = "secondary";
          const text = node("pre", "");
          text.hidden = true;
          btn.onclick = () => {
            text.textContent = corpus[author][promptIndex];
            text.hidden = false;
            btn.disabled = true;
          };
          el("files").append(btn, text);
        }
      }
    }
    function reveal(guess) {
      el("reveal").disabled = true;
      for (const b of el("choices").children) b.disabled = true;
      el("record").hidden = false;
      if (guess)
        el("human").textContent =
          (guess === t.expected ? "Correct. " : "Incorrect. ") +
          "You chose " +
          guess +
          ".";
      el("outcome").textContent =
        "Answer key: " +
        t.expected +
        " · Parsed decision: " +
        (t.decision ?? "invalid") +
        " · Exact-label decision: " +
        (t.answer ?? "invalid") +
        " · Main score: " +
        (t.decision_correct ? "correct" : "incorrect") +
        ".";
      for (const { path, author, promptIndex } of sources) {
        const details = node("details", "");
        details.append(
          node("summary", path + " · " + author),
          node(
            "pre",
            manifest.write_instruction + manifest.prompts[promptIndex],
          ),
          node("pre", corpus[author][promptIndex]),
        );
        el("provenance").append(details);
      }
      for (const m of t.messages)
        el("messages").append(
          node(
            "h4",
            m.role === "assistant" ? "Model reply" : "Input to reader",
          ),
          node("pre", m.content),
        );
      const link = new URL(location.href);
      link.hash = new URLSearchParams({
        reader: model,
        condition: kind,
        trial: index + 1,
      }).toString();
      el("report").href =
        "https://github.com/williamcodes/self-recognition/issues/new?" +
        new URLSearchParams({
          title:
            "Review v1 trial " + (index + 1) + " · " + model + " · " + kind,
          body: "Trial: " + link.href + "\n\nWhat I noticed:\n",
        });
    }
    for (const label of labels) {
      const b = node("button", "Answer " + label);
      b.onclick = () => reveal(label);
      el("choices").append(b);
    }
    el("reveal").onclick = () => reveal(null);
    el("next").onclick = () =>
      navigate(
        model,
        kind,
        group[(group.indexOf(t) + 1) % group.length].prompt_index,
      );
  }
  el("reader").onchange = el("condition").onchange = () =>
    navigate(el("reader").value, el("condition").value, 0);
  el("item").onchange = () =>
    navigate(
      el("reader").value,
      el("condition").value,
      Number(el("item").value),
    );
  window.addEventListener("hashchange", render);
  render();
}
init().catch(() => {
  el("status").textContent =
    "Could not load the saved run. Reload to try again.";
});
