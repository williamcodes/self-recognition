const byId = (id) => document.getElementById(id);

async function loadExamples() {
  const response = await fetch("data/packet-examples.json");
  if (!response.ok) throw Error("Example data unavailable");
  const data = await response.json();
  const items = new Map();
  const groups = new Map([["featured", data.featured]]);
  const options = byId("collection");
  options.add(new Option("Start here · six examples", "featured"));
  for (const group of data.collections) {
    const ids = [];
    for (const sample of group.cases) {
      sample.pairs.forEach((pair, i) => {
        const label = sample.pairs.length > 1 ? sample.topic + " · pair " + (i + 1) : sample.topic;
        items.set(pair.id, { sample, pair, group, label });
        ids.push(pair.id);
      });
    }
    groups.set(group.id, ids);
    options.add(new Option(group.title, group.id));
  }
  let current;
  function navigate(collection, id) {
    location.hash = new URLSearchParams({ collection, id }).toString();
  }
  function show() {
    const params = new URLSearchParams(location.hash.slice(1));
    const collection = groups.has(params.get("collection")) ? params.get("collection") : "featured";
    const ids = groups.get(collection);
    const id = ids.includes(params.get("id")) ? params.get("id") : ids[0];
    current = items.get(id);
    const { pair, sample, group } = current;
    options.value = collection;
    byId("comparison").replaceChildren(...ids.map((key, i) => {
      const label = collection === "featured" ? items.get(key).sample.topic : items.get(key).label;
      return new Option((i + 1) + " of " + ids.length + " · " + label, key);
    }));
    byId("comparison").value = id;
    byId("topic").textContent = sample.topic;
    byId("assignment").textContent = group.title;
    byId("textA").textContent = pair.own === "A" ? sample.astraText : pair.otherText;
    byId("textB").textContent = pair.own === "B" ? sample.astraText : pair.otherText;
    byId("feedback").textContent = "";
    byId("answer").hidden = true;
    byId("reader").open = false;
    byId("writers").open = false;
    byId("reveal").hidden = false;
    byId("guessA").disabled = false;
    byId("guessB").disabled = false;
  }
  function reveal(guess) {
    const { pair, sample, group } = current;
    const prefix = guess == null ? "" : guess === pair.own ? "Correct. " : "Different author. ";
    byId("feedback").textContent = prefix + "Astra wrote " + pair.own + ".";
    byId("authors").textContent = "The other writer was " + pair.other + ".";
    byId("prompt").textContent = sample.prompt;
    const container = byId("judgments");
    container.replaceChildren();
    for (const [type, rows, question] of [
      ["File reading", pair.file, group.question],
      ["Inline", pair.inline, data.inlineQuestion],
    ]) {
      if (!rows) continue;
      const heading = document.createElement("h3");
      heading.textContent = type + " · " + rows.filter((row) => row.choice === row.own).length + " of 2 correct";
      const readerPrompt = document.createElement("p");
      readerPrompt.textContent = question;
      container.append(heading, readerPrompt);
      for (const row of rows) {
        const label = document.createElement("strong");
        label.textContent = "With Astra’s text in position " + row.own;
        const reply = document.createElement("p");
        reply.textContent = row.reply;
        container.append(label, reply);
      }
    }
    byId("answer").hidden = false;
    byId("guessA").disabled = true;
    byId("guessB").disabled = true;
    byId("reveal").hidden = true;
    byId("feedback").focus();
  }
  options.onchange = () => navigate(options.value, groups.get(options.value)[0]);
  byId("comparison").onchange = () => navigate(options.value, byId("comparison").value);
  byId("next").onclick = () => {
    const ids = groups.get(options.value);
    const index = ids.indexOf(current.pair.id);
    navigate(options.value, ids[(index + 1) % ids.length]);
    byId("comparison").focus();
    byId("comparison").scrollIntoView({ block: "start" });
  };
  for (const side of ["A", "B"]) byId("guess" + side).onclick = () => reveal(side);
  byId("reveal").onclick = () => reveal(null);
  addEventListener("hashchange", show);
  show();
  byId("status").hidden = true;
  byId("workspace").hidden = false;
}
loadExamples().catch(() => {
  byId("status").textContent = "Couldn’t load the examples. Refresh to try again.";
});
