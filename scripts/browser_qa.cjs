/* Run against a served docs/ directory or the deployed Pages URL. */
const assert = require("node:assert/strict");
const { chromium, webkit, devices } = require(process.env.SELFREC_PLAYWRIGHT || "playwright");

async function main() {
  const base = new URL(process.argv[2] || "http://127.0.0.1:8000/");
  const asset = (path) => new URL(path, base).href;
  const getJson = async (path) => {
    const res = await fetch(asset(path));
    assert(res.ok, path);
    return res.json();
  };
  const catalog = await getJson("data/release/index.json");
  const iphone = process.argv.includes("--webkit");
  const engine = iphone ? webkit : chromium;
  const executablePath = iphone ? process.env.SELFREC_WEBKIT : process.env.SELFREC_CHROMIUM;
  const browser = await engine.launch(executablePath ? { executablePath } : {});
  try {
    const page = await browser.newPage(iphone ? { ...devices["iPhone 13"] } : { ...devices["Pixel 7"] });
    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(String(error)));
    const current = async () => await page.locator("#trial").inputValue();
    const width = async (w) => {
      const size = await page.evaluate(() => document.documentElement.scrollWidth);
      assert(size <= w + 1, "horizontal overflow at " + page.url() + ": " + size + " vs " + w);
    };
    const open = async (t, run, trial) => {
      const hash = new URLSearchParams({
        track: t.id,
        run: run.id,
        trial: trial.id,
      }).toString();
      await page.goto(asset("track.html#" + hash));
      await page.waitForFunction(
        (id) =>
          document.getElementById("trial").value === id && !document.getElementById("stimulus").hidden,
        trial.id,
      );
      assert(await page.locator("#record").isHidden());
      assert(await page.locator("#score-details").isHidden());
      assert(await page.locator("#reproduce").isHidden());
      assert.equal(await current(), trial.id);
      assert.equal(await page.locator("#reader").inputValue(), trial.reader);
      assert.equal(await page.locator("#mode").inputValue(), trial.mode);
      assert.equal(await page.locator("#case").inputValue(), trial.case);
    };
    let checked = 0;
    for (const track of catalog.tracks) {
      if (!track.runs.length && process.argv.includes("--allow-partial")) continue;
      assert(track.runs.length, "missing " + track.id);
      for (const run of track.runs) {
        await page.goto(asset("index.html#" + new URLSearchParams({ track: track.id, run: run.id })));
        await page.waitForFunction(
          (title) => document.getElementById("track-title").textContent === title,
          track.name,
        );
        assert.equal(
          await page.locator("#project-tools").isVisible(),
          track.id === "projects" && run.id === "release",
        );
        assert.match(
          await page.locator("#sample-count").textContent(),
          new RegExp("^" + run.cases + " distinct scenarios · " + run.n + " reader judgments$"),
        );
        const subset = await getJson(run.file);
        assert.equal(subset.trials.length, run.n);
        const links = await page
          .locator("#score-table td a")
          .evaluateAll((nodes) => nodes.map((n) => n.href));
        for (const url of links) {
          const parts = new URLSearchParams(new URL(url).hash.slice(1));
          const score = run.scores.find((s) => s.reader === parts.get("reader"));
          assert(score.modes[parts.get("mode")]);
        }
        const categories = new Map();
        for (const trial of subset.trials) {
          const key = trial.mode + ":" + trial.key;
          if (!categories.has(key)) categories.set(key, trial);
        }
        for (const trial of categories.values()) {
          await open(track, run, trial);
          await width(page.viewportSize().width);
          if (trial.exchange) {
            const exact = page.locator("#exact-reader-input");
            await exact.locator("xpath=ancestor::details[1]/summary").tap();
            assert.equal(await exact.textContent(), trial.exactInput);
            assert(await exact.isVisible());
            if (trial.opponent && trial.opponent !== trial.reader) {
              const displayed = await page.locator("body").innerText();
              assert(!displayed.includes(trial.opponent));
              assert(!displayed.includes(catalog.models[trial.opponent]));
            }
            const c = await getJson(subset.cases.find((s) => s.id === trial.case).file);
            assert.equal(await page.locator(".turn").count(), c.exchanges[trial.exchange].turns.length);
            assert.match(await page.locator("#question").textContent(), new RegExp(trial.known, "i"));
            assert.match(await page.locator("#question").textContent(), new RegExp(trial.target, "i"));
          } else {
            assert.equal(await page.locator(".material").count(), trial.materials.length);
          }
          const label = trial.mode === "ab" ? "Choose " + trial.key : trial.key === "YES" ? "Yes" : "No";
          await page.getByRole("button", { name: label, exact: true }).tap();
          assert(await page.locator("#record").isVisible());
          assert.match(await page.locator("#feedback").textContent(), /^Correct\./);
          assert.equal(await page.locator("#record > .reply").textContent(), trial.reply);
          await width(page.viewportSize().width);
          if (trial.replay) assert((await page.locator("#record").textContent()).includes(trial.replay));
          checked += 1;
        }
      }
    }
    const proj = catalog.tracks.find((t) => t.id === "projects");
    const r = proj.runs.find((run) => run.id === "design-pilot");
    const a = await getJson(r.file);
    const htmlTrial = a.trials.find((t) => t.case === "tram-ledger" && t.mode === "ab");
    await open(proj, r, htmlTrial);
    const previewButton = page.getByRole("button", { name: "Show static preview" }).first();
    await page
      .locator(".file-content button")
      .first()
      .locator("xpath=ancestor::details[1]/summary")
      .tap();
    await previewButton.tap();
    const preview = page.locator("iframe[sandbox]").first();
    assert.equal(await preview.getAttribute("sandbox"), "");
    assert(await preview.contentFrame().locator("body").innerText());
    const sheet = page.locator(".sheet-preview").first();
    await sheet.locator("xpath=ancestor::details[1]/summary").tap();
    assert((await sheet.locator("td").count()) > 0);
    await width(page.viewportSize().width);
    for (const [caseID, type] of [
      ["repair-night", "pdf"],
      ["lost-platform", "audio"],
    ]) {
      const trial = a.trials.find((row) => row.case === caseID && row.mode === "ab");
      await open(proj, r, trial);
      const loc = page.locator(type === "pdf" ? ".file-content img" : ".file-content audio").first();
      await loc.locator("xpath=ancestor::details[1]/summary").tap();
      if (type === "pdf")
        await page.waitForFunction(() => document.querySelector(".file-content img").naturalWidth > 0);
      else {
        const ready = await loc.evaluate(
          (el) =>
            new Promise((resolve, reject) => {
              if (el.readyState >= 1) {
                resolve(el.duration);
                return;
              }
              el.onloadedmetadata = () => resolve(el.duration);
              el.onerror = () => reject(new Error("audio load failed"));
              el.load();
            }),
        );
        assert(ready > 0);
      }
      const download = await page.locator(".material a[download]").first().getAttribute("href");
      assert((await fetch(asset(download), { method: "HEAD" })).ok);
    }
    const widths = iphone ? [320, 390] : [320, 375, 390, 430, 768, 1280];
    for (const w of widths) {
      await page.setViewportSize({ width: w, height: 840 });
      await page.goto(base.href);
      await page.waitForSelector("#score-table a");
      await width(w);
      await page.locator("#score-table a").first().tap();
      await page.waitForSelector("#stimulus:visible");
      await width(w);
      const prev = await current();
      await page.locator("#next").tap();
      await page.waitForFunction((id) => document.getElementById("trial").value !== id, prev);
      await page.locator("#choices button").last().tap();
      assert(await page.locator("#record").isVisible());
      await width(w);
      await page.goBack();
      await page.waitForFunction((id) => document.getElementById("trial").value === id, prev);
      assert(await page.locator("#record").isHidden());
    }
    assert.deepEqual(pageErrors, []);
    console.log(
      (iphone ? "iPhone WebKit" : "Chromium touch emulation") +
        ": " +
        checked +
        " representative scored judgments; all run tables, answer keys, media, navigation and widths passed.",
    );
  } finally {
    await browser.close();
  }
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
