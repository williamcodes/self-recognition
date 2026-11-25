import {
  $,
  element,
  json,
  fragment,
  options,
  modeName,
  name,
  rate,
  details,
  anchor,
} from "./release-ui.js";

// The template is inert. Copy only presentation elements into the opaque preview.
function staticPage(file, files) {
  const allowed = new Set(
    "article aside blockquote br button caption code dd details div dl dt em fieldset figcaption figure footer form h1 h2 h3 h4 h5 h6 header hr i img input label legend li main nav ol option p pre section select small span strong summary table tbody td textarea tfoot th thead tr u ul".split(
      " ",
    ),
  );
  const attributes = new Set(
    "alt aria-label aria-hidden checked class colspan disabled height hidden id max min open placeholder readonly rowspan selected style type value width".split(
      " ",
    ),
  );
  const base = new URL(file.name, "https://project.invalid/");
  function relative(path) {
    try {
      const url = new URL(path, base);
      if (url.origin === base.origin)
        return files.find((f) => f.name === decodeURIComponent(url.pathname.slice(1)));
    } catch {
      /* The original source remains available. */
    }
  }
  const input = document.createElement("template");
  input.innerHTML = file.body;
  const view = document.createElement("div");
  function copy(source, parent) {
    if (source.nodeType === Node.TEXT_NODE) {
      parent.append(document.createTextNode(source.data));
      return;
    }
    const tag = source.localName;
    if (
      !tag ||
      ["script", "iframe", "object", "svg", "math", "template", "title", "noscript"].includes(tag)
    )
      return;
    if (tag === "link" || tag === "style") {
      const css =
        tag === "style"
          ? source.textContent
          : source.relList.contains("stylesheet")
            ? relative(source.getAttribute("href"))?.body
            : null;
      if (css) parent.append(element("style", css.replaceAll("<", "\\3c ")));
      return;
    }
    const safe = allowed.has(tag) ? document.createElement(tag) : document.createElement("span");
    if (allowed.has(tag)) {
      for (const { name, value } of source.attributes)
        if (attributes.has(name)) safe.setAttribute(name, value);
    }
    if (tag === "img") {
      const target = relative(source.getAttribute("src"));
      if (target?.kind === "image") safe.src = new URL(target.url, document.baseURI);
    }
    for (const child of source.childNodes) copy(child, safe);
    parent.append(safe);
  }
  for (const child of input.content.childNodes) copy(child, view);
  const images = files
    .filter((f) => f.kind === "image")
    .map((f) => new URL(f.url, document.baseURI).href);
  const policy =
    "default-src 'none'; style-src 'unsafe-inline'; img-src " +
    (images.join(" ") || "'none'") +
    "; base-uri 'none'; form-action 'none'";
  return (
    '<!doctype html><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="' +
    policy +
    '"><meta name="viewport" content="width=device-width,initial-scale=1"><body>' +
    view.innerHTML
  );
}

function renderFile(file, files) {
  const content = element("div", undefined, "file-content");
  if (file.kind === "sheet") {
    const wrap = element("div", undefined, "tablewrap");
    const table = element("table", undefined, "sheet-preview");
    table.setAttribute("aria-label", file.sheet.name);
    const grid = table.createTBody();
    for (const row of file.sheet.rows) {
      const tr = grid.insertRow();
      for (const value of row) tr.insertCell().textContent = value;
    }
    wrap.append(table);
    content.append(
      element("p", file.sheet.name + " · preview of the first 12 rows and 8 columns", "meta"),
      wrap,
    );
  } else if (file.kind === "vector") {
    const image = element("img");
    image.loading = "lazy";
    image.alt = file.name;
    image.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(file.body);
    content.append(image, details("View SVG source", element("pre", file.body, "evidence-pre")));
  } else if (file.kind === "text" && /\.html?$/i.test(file.name)) {
    const button = element("button", "Show static preview", "secondary");
    button.type = "button";
    button.onclick = () => {
      const frame = element("iframe");
      frame.setAttribute("sandbox", "");
      frame.title = "Static preview of " + file.name;
      frame.referrerPolicy = "no-referrer";
      frame.srcdoc = staticPage(file, files);
      button.replaceWith(frame);
    };
    content.append(
      button,
      element("p", "Download the project to use its scripts and controls.", "note"),
      details("View original HTML", element("pre", file.body, "evidence-pre")),
    );
  } else if (file.kind === "text") {
    content.append(element("pre", file.body, "evidence-pre"));
  } else if (file.kind === "pdf" || file.kind === "image") {
    const image = element("img");
    image.alt = file.kind === "pdf" ? "First page of " + file.name : file.name;
    image.loading = "lazy";
    image.src = file.preview || file.url;
    content.append(image);
    if (file.kind === "pdf")
      content.append(
        element("p", "First page. The download contains the complete original PDF.", "note"),
      );
  } else if (file.kind === "audio" || file.kind === "video") {
    const player = element(file.kind);
    player.controls = true;
    player.preload = "none";
    player.src = file.url;
    content.append(player);
  } else {
    content.append(element("p", "Download the project to open this original file."));
  }
  content.append(element("p", file.bytes.toLocaleString() + " bytes", "note"));
  return details(file.name, content);
}

function renderWork(work, label) {
  const card = element("article", undefined, "material");
  card.append(element("h3", label));
  if (work.text !== undefined) {
    const words = work.text.trim().split(/\s+/u).length;
    card.append(element("p", words.toLocaleString() + " words", "meta"));
    const text = element("p", work.text, "prose");
    if (words > 450) {
      const box = details("Read full document", text);
      box.className = "document";
      const excerpt = element(
        "p",
        work.text.trim().split(/\s+/u).slice(0, 45).join(" ") + "…",
        "document-excerpt",
      );
      box.addEventListener("toggle", () => {
        excerpt.hidden = box.open;
      });
      card.append(excerpt, box);
    } else {
      card.append(text);
    }
  } else {
    const download = anchor("Download project (.zip)", work.download);
    download.download = "anonymous-" + label.toLowerCase().replaceAll(" ", "-") + ".zip";
    card.append(element("p", work.files.length + " files", "meta"), download);
    for (const file of work.files) card.append(renderFile(file, work.files));
  }
  return card;
}

function renderConversation(exchange, trial) {
  const container = element("div", undefined, "messages");
  if (exchange.context) container.append(element("p", exchange.context, "chat-text"));
  for (const turn of exchange.turns) {
    const item = element("div", undefined, "turn");
    const marked =
      turn.speaker === trial.known
        ? " · known " + trial.reader
        : turn.speaker === trial.target
          ? " · target"
          : "";
    const role = turn.role && turn.role !== turn.speaker ? " · " + turn.role : "";
    item.append(element("small", turn.speaker + role + marked), element("p", turn.text, "chat-text"));
    container.append(item);
  }
  return container;
}

function showScores(catalog, score, mode) {
  const entry = score.modes[mode];
  const list = $("scoring");
  list.replaceChildren(
    element(
      "p",
      rate(entry.rate) + " across " + entry.cases + " distinct scenarios and " + entry.n + " judgments.",
    ),
  );
  for (const c of entry.cells) {
    const label =
      mode === "ab"
        ? "Against " + name(catalog, c.opponent)
        : c.key === "YES"
          ? "Own contributions correctly claimed"
          : "Other contributions correctly rejected";
    list.append(element("p", label + " · " + c.correct + "/" + c.n));
  }
  if (entry.panels?.length) {
    const panels = element("div");
    for (const p of entry.panels) {
      const percent = rate((p.claimed / p.own + p.rejected / p.other) / 2);
      panels.append(
        element(
          "p",
          name(catalog, p.opponent) +
            " · " +
            percent +
            " · claimed own " +
            p.claimed +
            "/" +
            p.own +
            " · rejected other " +
            p.rejected +
            "/" +
            p.other,
        ),
      );
    }
    list.append(details("By comparison model", panels));
  }
}

function showTrial(catalog, track, scenario, trial, run) {
  const record = $("record");
  record.hidden = true;
  record.replaceChildren();
  $("feedback").textContent = "";
  $("title").textContent = scenario.title;
  $("trial-info").textContent = [scenario.genre, modeName(trial.mode) + " judgment"]
    .filter(Boolean)
    .join(" · ");
  const materials = $("materials");
  materials.replaceChildren();
  const reader = name(catalog, trial.reader);
  if (trial.exchange) {
    $("question").textContent = trial.question;
    if (trial.privateBrief) {
      materials.append(element("p", "The original negotiator received the final question in the same session, with its private brief and earlier turns still in context.", "note"));
      materials.append(
        details("Your original participant brief", element("p", trial.privateBrief, "reply")),
      );
    }
    const exact = element("pre", trial.exactInput, "evidence-pre");
    exact.id = "exact-reader-input";
    materials.append(details(trial.privateBrief ? "Exact final question" : "Exact reader input", exact));
    materials.append(renderConversation(scenario.exchanges[trial.exchange], trial));
  } else {
    const project = track.id === "projects";
    const noun = project ? "project" : "document";
    $("question").textContent =
      trial.mode === "ab"
        ? "Which " + noun + " was created by " + reader + "?"
        : "Was this " + noun + " created by " + reader + "?";
    if (trial.question) {
      if (trial.question.includes("Exactly half the items"))
        materials.append(
          element("p", "The reader was told that half the items were its own work.", "note"),
        );
      materials.append(details("Reader instructions", element("p", trial.question, "reply")));
    }
    const layout = element("div", undefined, trial.mode === "ab" ? "reading side-by-side" : "reading");
    trial.materials.forEach((key, i) => {
      const label = (project ? "Project" : "Document") + (trial.mode === "ab" ? " " + "AB"[i] : "");
      layout.append(renderWork(scenario.works[key], label));
    });
    materials.append(layout);
  }
  const choices = $("choices");
  choices.replaceChildren();
  function reveal(guess) {
    const correct = guess === trial.key;
    $("feedback").textContent =
      (guess ? (correct ? "Correct. " : "Incorrect. ") : "") + "The answer was " + trial.key + ".";
    $("feedback").focus();
    choices.querySelectorAll("button").forEach((button) => {
      button.disabled = true;
    });
    record.hidden = false;
    $("score-details").hidden = false;
    $("reproduce").hidden = false;
    for (const option of $("reader").options) option.text = name(catalog, option.value);
    for (const option of $("run").options) option.text = track.runs.find(r => r.id === option.value).title;
    record.append(element("h3", "Trial record"));
    if (trial.authors) {
      trial.authors.forEach((author, i) => {
        const label = trial.mode === "ab" ? "AB"[i] : track.id === "projects" ? "Project" : "Document";
        record.append(element("p", label + " · " + name(catalog, author)));
      });
    } else {
      record.append(
        element("p", trial.known + " · " + reader),
        element("p", trial.target + " · " + name(catalog, trial.targetModel)),
      );
    }
    const result =
      trial.disposition === "invalid_miss" ? "excluded response, scored as a miss" : trial.answer === null
        ? "unrecognized answer"
        : trial.answer === trial.key
          ? "correct"
          : "incorrect";
    record.append(element("h4", "Reader response · " + result), element("p", trial.reply, "reply"));
    if (trial.disposition === "invalid_miss")
      record.append(element("p", "The run withheld this response after reviewing which inputs the reader accessed. The judgment counts in the score.", "note"));
    if (trial.receipt)
      record.append(anchor("Session receipt ↗", "https://github.com/williamcodes/self-recognition/blob/main/" + run.sourceFile.replace(/judgments\.json$/, "") + trial.receipt));
    if (scenario.brief) record.append(details("Assignment", element("p", scenario.brief, "reply")));
    if (trial.commands?.length)
      record.append(
        details(
          "Terminal commands (" + trial.commands.length + ")",
          element("pre", trial.commands.join("\n"), "evidence-pre"),
        ),
      );
    if (trial.outcome)
      record.append(details("Interaction outcome", element("p", trial.outcome, "reply")));
    if (trial.participants) {
      const list = element("ul");
      for (const [role, model] of Object.entries(trial.participants))
        list.append(element("li", role + " · " + name(catalog, model)));
      record.append(details("All participant identities", list));
    }
    const source = anchor(
      "Original scored archive ↗",
      "https://github.com/williamcodes/self-recognition/blob/main/" + run.sourceFile,
    );
    record.append(
      source,
      element(
        "p",
        "JSON path: " +
          trial.sourceRef.map((s) => (typeof s === "number" ? "[" + s + "]" : "." + s)).join(""),
        "note",
      ),
    );
    if (trial.replay)
      record.append(details("Replay this trial locally", element("pre", trial.replay, "evidence-pre")));
  }
  for (const key of trial.mode === "ab" ? ["A", "B"] : ["YES", "NO"]) {
    const button = element("button", key === "YES" ? "Yes" : key === "NO" ? "No" : "Choose " + key);
    button.type = "button";
    button.onclick = () => reveal(key);
    choices.append(button);
  }
  const button = element("button", "Reveal answer", "secondary");
  button.type = "button";
  button.onclick = () => reveal(null);
  choices.append(button);
}

async function start() {
  const catalog = await json("data/release/index.json");
  let sequence = 0;
  function visit(values) {
    location.hash = fragment(values);
  }
  async function render() {
    const iteration = ++sequence;
    const q = new URLSearchParams(location.hash.slice(1));
    const tracks = catalog.tracks.filter((t) => t.runs.length);
    const track = tracks.find((t) => t.id === q.get("track")) || tracks[0];
    if (!track) throw Error("No scored runs available");
    const run = track.runs.find((r) => r.id === q.get("run")) || track.runs[0];
    options(
      $("track"),
      tracks.map((t) => [t.id, t.name]),
      track.id,
    );
    options(
      $("run"),
      track.runs.map((r) => [r.id, r.title.replace("Astra/Sol", "Panel 1").replace("Astra/Fable", "Panel 2")]),
      run.id,
    );
    const base = { track: track.id, run: run.id };
    $("track").onchange = () => visit({ track: $("track").value });
    $("run").onchange = () => visit({ ...base, run: $("run").value });
    $("results-link").href = "./" + fragment(base);
    $("run-description").textContent = run.note;
    $("command").textContent = run.replay;
    $("source").href = run.source;
    $("raw").href = run.file;
    $("stimulus").hidden = true;
    $("score-details").hidden = true;
    $("score-details").open = false;
    $("reproduce").hidden = true;
    $("status").hidden = false;
    $("status").textContent = "Loading trial…";
    const archive = await json(run.file);
    if (iteration !== sequence) return;
    const requested = archive.trials.find((t) => t.id === q.get("trial"));
    const score =
      run.scores.find((s) => s.reader === (requested?.reader || q.get("reader"))) || run.scores[0];
    const reader = score.reader;
    const modes = Object.keys(score.modes).sort();
    const mode = requested?.mode || (modes.includes(q.get("mode")) ? q.get("mode") : modes[0]);
    const filter = { ...base, reader, mode };
    options(
      $("reader"),
      run.scores.map((s, i) => [s.reader, s.reader === reader ? name(catalog, reader) : "Reader " + (i + 1)]),
      reader,
    );
    options(
      $("mode"),
      modes.map((m) => [m, modeName(m)]),
      mode,
    );
    $("reader").onchange = () => visit({ ...filter, reader: $("reader").value });
    $("mode").onchange = () => visit({ ...filter, mode: $("mode").value });
    showScores(catalog, score, mode);
    const subset = archive.trials.filter((t) => t.reader === reader && t.mode === mode);
    const caseSet = new Set(subset.map((t) => t.case));
    const cases = archive.cases.filter((c) => caseSet.has(c.id));
    const chosen = cases.find((c) => c.id === (requested?.case || q.get("case"))) || cases[0];
    options(
      $("case"),
      cases.map((c) => [c.id, c.title]),
      chosen.id,
    );
    const genres = new Set(cases.map(c => c.genre));
    if (genres.size > 1 && !genres.has("")) {
      const groups = Array.from(genres, genre => {
        const group = element("optgroup");
        group.label = genre[0].toUpperCase() + genre.slice(1);
        for (const c of cases.filter(c => c.genre === genre))
          group.append(new Option(c.title, c.id));
        return group;
      });
      $("case").replaceChildren(...groups);
      $("case").value = chosen.id;
    }
    $("case").onchange = () => visit({ ...filter, case: $("case").value });
    const group = subset.filter((t) => t.case === chosen.id).sort((a, b) => a.id.localeCompare(b.id));
    const trial = requested || group[0];
    options(
      $("trial"),
      group.map((t, i) => [t.id, i + 1 + " of " + group.length]),
      trial.id,
    );
    $("trial").onchange = () => visit({ ...filter, case: chosen.id, trial: $("trial").value });
    $("case-data").href = chosen.file;
    $("permalink").href = fragment({
      ...filter,
      case: chosen.id,
      trial: trial.id,
    });
    const scenario = await json(chosen.file);
    if (iteration !== sequence) return;
    showTrial(catalog, track, scenario, trial, run);
    $("stimulus").hidden = false;
    $("status").hidden = true;
    const ordered = cases.flatMap((c) =>
      subset.filter((t) => t.case === c.id).sort((a, b) => a.id.localeCompare(b.id)),
    );
    const at = ordered.findIndex((t) => t.id === trial.id);
    for (const [id, step] of [
      ["previous", -1],
      ["next", 1],
    ]) {
      $(id).disabled = !ordered[at + step];
      $(id).onclick = () => {
        const destination = ordered[at + step];
        if (!destination) return;
        visit({ ...filter, case: destination.case, trial: destination.id });
        $("case").focus();
        $("case").scrollIntoView({ block: "start" });
      };
    }
    document.title = scenario.title + " · " + track.name + " · Self-Recognition";
  }
  const update = () =>
    render().catch(() => {
      $("status").hidden = false;
      $("status").textContent = "Couldn’t load the trial. Refresh to try again.";
    });
  addEventListener("hashchange", update);
  await update();
}
start().catch(() => {
  $("status").textContent = "Couldn’t load the scored runs. Refresh to try again.";
});
