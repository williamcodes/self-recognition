import { $, element, json, fragment, options, modeName, name, rate, anchor } from "./release-ui.js";

async function start() {
  const catalog = await json("data/release/index.json");
  const tabs = $("track-tabs");
  const params = () => new URLSearchParams(location.hash.slice(1));
  const select = (track, run) => {
    location.hash = fragment({ track, run });
  };
  function render() {
    const query = params();
    const track = catalog.tracks.find((t) => t.id === query.get("track")) || catalog.tracks[0];
    const run = track.runs.find((r) => r.id === query.get("run")) || track.runs[0];
    tabs.replaceChildren(
      ...catalog.tracks.map((t) => {
        const button = element("button", t.name);
        button.type = "button";
        button.setAttribute("aria-pressed", String(t.id === track.id));
        button.onclick = () => select(t.id);
        return button;
      }),
    );
    $("loading").hidden = Boolean(run);
    $("run-view").hidden = !run;
    if (!run) {
      $("loading").textContent = "No scored run is published for this track.";
      return;
    }
    options(
      $("run"),
      track.runs.map((r) => [r.id, r.title]),
      run.id,
    );
    $("run").onchange = () => select(track.id, $("run").value);
    $("track-title").textContent = track.name;
    $("track-description").textContent = track.description;
    $("sample-count").textContent = run.cases + " distinct scenarios · " + run.n + " reader judgments";
    const modes = [...new Set(run.scores.flatMap((s) => Object.keys(s.modes)))].sort();
    const wrap = element("div", undefined, "tablewrap");
    const table = element("table", undefined, "scoreboard");
    table.setAttribute("aria-label", track.name + ", " + run.title);
    const header = table.createTHead().insertRow();
    for (const label of [
      "Reader",
      ...modes.map((m) => (m === "yn" ? "Yes/no balanced accuracy" : "A/B accuracy")),
    ]) {
      const th = element("th", label);
      th.scope = "col";
      header.append(th);
    }
    const body = table.createTBody();
    for (const score of run.scores) {
      const row = body.insertRow();
      const th = element("th", name(catalog, score.reader));
      th.scope = "row";
      row.append(th);
      for (const mode of modes) {
        const cell = row.insertCell();
        const value = score.modes[mode];
        if (!value) {
          cell.textContent = "—";
          continue;
        }
        const link = anchor(
          "",
          "track.html" +
            fragment({
              track: track.id,
              run: run.id,
              reader: score.reader,
              mode,
            }),
        );
        link.setAttribute(
          "aria-label",
          name(catalog, score.reader) +
            ", " +
            modeName(mode) +
            ", " +
            rate(value.rate) +
            ", inspect trials",
        );
        link.append(
          element("span", rate(value.rate), "value"),
          element("small", value.cases + " scenarios · " + value.n + " judgments"),
        );
        cell.append(link);
        if (mode === "yn") {
          const own = value.cells.find((c) => c.key === "YES");
          const other = value.cells.find((c) => c.key === "NO");
          cell.append(
            element("small", "Claimed own " + own.correct + "/" + own.n, "score-part"),
            element("small", "Rejected other " + other.correct + "/" + other.n, "score-part"),
          );
        }
      }
    }
    wrap.append(table);
    $("score-table").replaceChildren(wrap);
    $("run-note").textContent = run.note;
    $("project-tools").hidden = !(track.id === "projects" && run.id === "release");
    $("project-evidence").hidden = $("project-tools").hidden;
    $("typography").hidden = !(track.id === "group" || (track.id === "negotiation" && run.id.startsWith("cross-family-")));
    $("typography-note").textContent = track.id === "group"
      ? "An apostrophe-only rule got all 32 Astra/Fable confirmation judgments right. After apostrophes were standardized, the models still got 31 of 32 right."
      : "Astra and Fable used different harnesses and punctuation. The related group experiment tested how much apostrophe style mattered.";
    $("browse-run").href = "track.html" + fragment({ track: track.id, run: run.id });
    $("download-run").href = run.file;
    $("run-source").href = run.source;
  }
  addEventListener("hashchange", render);
  render();
  if (params().has("track")) $("results").scrollIntoView({ block: "start" });
}
start().catch(() => {
  $("loading").textContent = "Couldn’t load the scores. Refresh to try again.";
});
