"use strict";

const $ = (id) => document.getElementById(id);
const STORAGE_KEY = "selvedge-catalog-v1";
const PAGE_SIZE = 8;
const DRAWERS = "ABCDEF";
const STATUS = { available: "In cabinet", out: "Checked out" };
const SWATCHES = {
  ivory: "#e4d8be", beige: "#c7ac84", gray: "#8c8c84", green: "#748765",
  brown: "#846047", ochre: "#bd944e", blue: "#63828e", rust: "#ae674d",
  pink: "#ca9a98", black: "#464441", white: "#f9f8f4",
  red: "#a83d3e", orange: "#c7783e", purple: "#866884", yellow: "#ddc062",
};
const codeOrder = new Intl.Collator("en", { numeric: true, sensitivity: "base" });
const labelOrder = new Intl.Collator("en", { sensitivity: "base" });
const filterFields = { color: $("color-filter"), fabric: $("fabric-filter"), status: $("status-filter") };
const recordFields = Object.fromEntries(["code", "drawer", "color", "fabric", "status", "reference"].map((id) => [id, $(id)]));
const recordDialog = $("record-dialog");
const dataDialog = $("data-dialog");

let samples = [];
let matches = [];
let page = 1;
let ascending = true;
let editing = null;
let returnFocus = null;
let pendingReplacement = null;
let backupRead = 0;
let toastTimer;

const fold = (value) => value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
const codeKey = (value) => fold(value).replace(/[^a-z0-9]/g, "");
const normalizeCode = (value) => value.trim().replace(/[\u2010-\u2015\u2212]/g, "-").toUpperCase();
const validCode = (value) => value.length <= 24 && /^[A-Z0-9]+(?:-[A-Z0-9]+)*$/.test(value);

function readBackup(text) {
  const backup = JSON.parse(text);
  if (backup?.version !== 1 || !Array.isArray(backup.samples)) {
    throw new Error("Choose a catalog backup exported as a .json file.");
  }
  const codes = new Set();
  return backup.samples.map((sample, index) => {
    const fields = ["code", "color", "fabric", "drawer", "status", "reference"];
    if (!sample || !fields.every((field) => typeof sample[field] === "string")) {
      throw new Error(`Swatch ${index + 1} has missing or invalid fields.`);
    }
    const { code, color, fabric, drawer, status, reference } = sample;
    if (!validCode(code) || !color.trim() || color.length > 50 || !fabric.trim() || fabric.length > 50 ||
        drawer.length !== 1 || !DRAWERS.includes(drawer) || !Object.hasOwn(STATUS, status) ||
        reference.length > 90 || (status === "available" && reference !== "")) {
      throw new Error(`Swatch ${index + 1} contains invalid catalog data.`);
    }
    if (codes.has(codeKey(code))) throw new Error(`The backup contains a duplicate code: ${code}.`);
    codes.add(codeKey(code));
    return { code, drawer, color: color.trim(), fabric: fabric.trim(), status, reference: reference.trim() };
  });
}

function fromStorage() {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored === null ? starterSamples.slice() : readBackup(stored);
}

function storeSamples(nextSamples) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, samples: nextSamples }));
  samples = nextSamples;
  $("storage-notice").hidden = true;
  $("storage-label").textContent = "Offline catalog";
}

// Serialize writes in browsers that offer locks. Each write reads the latest saved records.
function withCatalogLock(action) {
  if (navigator.locks) return navigator.locks.request(STORAGE_KEY, action);
  return Promise.resolve().then(action);
}

function syncStorage() {
  try {
    samples = fromStorage();
    $("storage-notice").hidden = true;
    $("storage-label").textContent = "Offline catalog";
  } catch (error) {
    $("storage-label").textContent = "Storage needs attention";
    $("storage-notice").textContent = error instanceof DOMException
      ? "This browser blocked access to local storage. Use a regular browser window that allows local storage."
      : "The saved catalog could not be read. Restore a catalog backup from Export data.";
    $("storage-notice").hidden = false;
  }
}

function node(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function icon(name) {
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  const use = document.createElementNS(ns, "use");
  svg.setAttribute("class", "icon");
  svg.setAttribute("aria-hidden", "true");
  use.setAttribute("href", `#i-${name}`);
  svg.append(use);
  return svg;
}

function updateFilterOptions() {
  for (const [key, listId] of [["color", "colors"], ["fabric", "fabrics"]]) {
    const labels = new Map();
    for (const record of samples) {
      if (!labels.has(fold(record[key]))) labels.set(fold(record[key]), record[key]);
    }
    const values = Array.from(labels.values()).sort(labelOrder.compare);
    const current = filterFields[key].value;
    const all = filterFields[key].options[0];
    filterFields[key].replaceChildren(all, ...values.map((value) => new Option(value, fold(value))));
    filterFields[key].value = labels.has(current) ? current : "";
    $(listId).replaceChildren(...values.map((value) => new Option(value, value)));
  }
}

function renderRow(record) {
  const row = node("tr");
  const code = node("td", "code", record.code);
  const color = node("td");
  const colorCell = node("span", "color-cell");
  const chip = node("span", "color-chip");
  chip.setAttribute("aria-hidden", "true");
  const colorKey = fold(record.color);
  chip.style.setProperty("--swatch", Object.hasOwn(SWATCHES, colorKey) ? SWATCHES[colorKey] : "#b5ad9c");
  colorCell.append(chip, node("span", "", record.color));
  color.append(colorCell);

  const drawer = node("td");
  drawer.append(node("span", "drawer-chip", record.drawer));

  const status = node("td");
  const statusCell = node("span", "status-cell");
  statusCell.append(node("span", `status-pill ${record.status}`, STATUS[record.status]));
  if (record.reference) statusCell.append(node("span", "reference", record.reference));
  status.append(statusCell);

  const action = node("td");
  const edit = node("button", "text-button edit", "Edit");
  edit.type = "button";
  edit.prepend(icon("edit"));
  edit.setAttribute("aria-label", `Edit swatch ${record.code}`);
  edit.dataset.code = record.code;
  edit.addEventListener("click", () => openRecord(record, edit));
  action.append(edit);
  row.append(code, color, node("td", "", record.fabric), drawer, status, action);
  return row;
}

function render() {
  const query = $("search").value.trim();
  const terms = fold(query).split(/\s+/).filter(Boolean);
  const { color, fabric, status } = Object.fromEntries(Object.entries(filterFields).map(([key, field]) => [key, field.value]));
  const drawer = document.querySelector('[name="drawer-filter"]:checked').value;
  const active = Boolean(query || color || fabric || status || drawer);

  matches = samples.filter((sample) => {
    if ((color && color !== fold(sample.color)) || (fabric && fabric !== fold(sample.fabric)) ||
        (status && status !== sample.status) || (drawer && drawer !== sample.drawer)) return false;
    const searchable = fold([sample.code, sample.color, sample.fabric, `Drawer ${sample.drawer}`, STATUS[sample.status], sample.reference].join(" "));
    return terms.every((term) => searchable.includes(term) ||
      (/[a-z0-9]/.test(term) && codeKey(sample.code).includes(codeKey(term))));
  }).sort((a, b) => (ascending ? 1 : -1) * codeOrder.compare(a.code, b.code));

  const pages = Math.max(1, Math.ceil(matches.length / PAGE_SIZE));
  page = Math.min(page, pages);
  const start = (page - 1) * PAGE_SIZE;
  const visible = matches.slice(start, start + PAGE_SIZE);
  $("rows").replaceChildren(...visible.map(renderRow));
  const outCount = samples.filter((sample) => sample.status === "out").length;
  $("total-count").textContent = samples.length;
  $("available-count").textContent = samples.length - outCount;
  $("out-count").textContent = outCount;
  for (const card of document.querySelectorAll(".summary-card")) {
    card.setAttribute("aria-pressed", String(card.dataset.status === status));
  }
  $("clear").hidden = !active;
  $("empty").hidden = matches.length > 0;
  $("empty-title").textContent = active ? "No matching swatches" : "The catalog is empty";
  $("empty-text").textContent = active ? "Try a different search or clear the filters." : "Add a swatch to begin cataloging your cabinet.";
  $("empty-action").textContent = active ? "Clear filters" : "Add swatch";
  $("empty-action").onclick = active ? clearFilters : () => openRecord(null, $("add"));
  $("results").textContent = matches.length > 1
    ? `Showing ${start + 1}–${start + visible.length} of ${matches.length} swatches`
    : matches.length === 1 ? "1 swatch" : "0 swatches";
  $("pagination").hidden = pages === 1;
  $("page-label").textContent = `Page ${page} of ${pages}`;
  $("previous").disabled = page <= 1;
  $("next").disabled = page >= pages;
  $("sort").closest("th").setAttribute("aria-sort", ascending ? "ascending" : "descending");
  $("sort").lastElementChild.textContent = ascending ? "↑" : "↓";
}

function filterChanged() {
  page = 1;
  render();
}

function clearFilters() {
  $("search").value = "";
  for (const field of Object.values(filterFields)) field.value = "";
  document.querySelector('[name="drawer-filter"][value=""]').checked = true;
  filterChanged();
  $("search").focus();
}

function announce(message) {
  clearTimeout(toastTimer);
  $("toast").textContent = message;
  toastTimer = setTimeout(() => { $("toast").textContent = ""; }, 4400);
}

function updateReference() {
  $("reference-field").hidden = recordFields.status.value !== "out";
}

function recordError(message, field) {
  const error = $("record-error");
  error.hidden = !message;
  error.textContent = message;
  for (const input of Object.values(recordFields)) {
    input.removeAttribute("aria-invalid");
    input.removeAttribute("aria-describedby");
  }
  if (field) {
    field.setAttribute("aria-invalid", "true");
    field.setAttribute("aria-describedby", "record-error");
    field.focus();
  }
}

function openRecord(record, source) {
  editing = record;
  returnFocus = source || document.activeElement;
  $("record-form").reset();
  $("record-title").textContent = record ? `Edit ${record.code}` : "Add swatch";
  $("save-record").textContent = record ? "Save changes" : "Add swatch";
  if (record) {
    for (const [key, control] of Object.entries(recordFields)) control.value = record[key];
  }
  updateReference();
  recordError("");
  recordDialog.showModal();
  recordFields.code.focus();
}

async function saveRecord(event) {
  event.preventDefault();
  const fields = recordFields;
  const code = normalizeCode(fields.code.value);
  const color = fields.color.value.trim();
  const fabric = fields.fabric.value.trim();
  if (!validCode(code)) return recordError("Use letters, numbers, and hyphens for the sample code.", fields.code);
  if (!color) return recordError("Enter a color family.", fields.color);
  if (!fabric) return recordError("Enter a fabric type.", fields.fabric);

  const original = editing;
  const draft = {
    code, drawer: fields.drawer.value, color, fabric, status: fields.status.value,
    reference: fields.status.value === "out" ? fields.reference.value.trim() : "",
  };

  $("save-record").disabled = true;
  try {
    const problem = await withCatalogLock(() => {
      const latest = fromStorage();
      const index = original ? latest.findIndex((sample) => sample.code === original.code) : -1;
      if (original && (index < 0 || Object.keys(fields).some((key) => latest[index][key] !== original[key]))) {
        return { message: "This swatch changed in another tab. Close this form and reopen the swatch." };
      }
      if (latest.some((sample, i) => i !== index && codeKey(sample.code) === codeKey(code))) {
        return { message: `A swatch with code ${code} already exists.`, field: fields.code };
      }
      for (const key of ["color", "fabric"]) {
        draft[key] = latest.find((sample, i) => i !== index && fold(sample[key]) === fold(draft[key]))?.[key] || draft[key];
      }
      if (index >= 0) latest[index] = draft;
      else latest.push(draft);
      storeSamples(latest);
      return null;
    });
    if (problem) {
      recordError(problem.message, problem.field);
      return;
    }
    updateFilterOptions();
    render();
    if (returnFocus?.classList.contains("edit")) {
      returnFocus = Array.from($("rows").querySelectorAll(".edit")).find((button) => button.dataset.code === draft.code) || $("search");
    }
    recordDialog.close();
    const changedStatus = original && original.status !== draft.status;
    announce(changedStatus
      ? `${draft.code} · ${STATUS[draft.status]}.`
      : `${draft.code} ${original ? "saved" : "added"}.`);
  } catch {
    recordError("Changes could not be saved. Check browser storage or restore a readable backup.");
  } finally {
    $("save-record").disabled = false;
  }
}

function dataFeedback(message = "", error = false) {
  const feedback = $("data-feedback");
  feedback.textContent = message;
  feedback.hidden = !message;
  feedback.toggleAttribute("data-error", error);
}

function downloadFile(format) {
  const ordered = samples.slice().sort((a, b) => codeOrder.compare(a.code, b.code));
  const csvQuote = (value) => {
    // Keep spreadsheet applications from interpreting a free-text field as a formula.
    const safe = /^[\s\uFEFF]*[=+\-@\t\r\n]/.test(value) ? "'" + value : value;
    return '"' + safe.replaceAll('"', '""') + '"';
  };
  const csv = format === "csv";
  const rows = () => [
    ["Sample code", "Color family", "Fabric type", "Drawer", "Checkout status", "Client or project reference"],
    ...ordered.map((record) => [record.code, record.color, record.fabric, record.drawer, STATUS[record.status], record.reference]),
  ].map((row) => row.map(csvQuote).join(",")).join("\r\n");
  const contents = csv ? "\uFEFF" + rows() + "\r\n" : JSON.stringify({ version: 1, samples: ordered }, null, 2) + "\n";
  const url = URL.createObjectURL(new Blob([contents], { type: csv ? "text/csv;charset=utf-8" : "application/json" }));
  const link = node("a");
  const now = new Date();
  const stamp = [now.getFullYear(), String(now.getMonth() + 1).padStart(2, "0"), String(now.getDate()).padStart(2, "0")].join("-");
  link.href = url;
  link.download = `selvedge-catalog-${stamp}.${format}`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
  dataFeedback(`Export ready · ${ordered.length} swatches.`);
}

function resetRestore() {
  backupRead++;
  pendingReplacement = null;
  $("backup-file").value = "";
  $("restore-confirm").hidden = true;
}

function confirmReplacement(records, blank = false) {
  pendingReplacement = { records, blank };
  const count = records.length;
  const intro = blank ? "Start with an empty cabinet catalog." : `This backup contains ${count} ${count === 1 ? "swatch" : "swatches"}.`;
  $("restore-summary").textContent = `${intro} Replacing the catalog will remove the current records. Export a backup first to keep a copy.`;
  $("confirm-restore").textContent = blank ? "Clear catalog" : "Replace catalog";
  $("restore-confirm").hidden = false;
  $("cancel-restore").focus();
}

async function previewBackup(event) {
  const file = event.target.files[0];
  resetRestore();
  dataFeedback();
  if (!file) return;
  const request = backupRead;
  try {
    const contents = await file.text();
    if (request !== backupRead) return;
    confirmReplacement(readBackup(contents));
  } catch (error) {
    if (request !== backupRead) return;
    dataFeedback(error instanceof SyntaxError ? "This file is not a readable JSON backup." : error.message, true);
    $("import").focus();
  }
}

async function restoreBackup() {
  if (!pendingReplacement) return;
  const { records, blank } = pendingReplacement;
  $("confirm-restore").disabled = true;
  try {
    await withCatalogLock(() => storeSamples(records));
    updateFilterOptions();
    clearFilters();
    resetRestore();
    dataFeedback(blank ? "Catalog cleared. You can now add your own swatches." : `Catalog restored · ${records.length} swatches.`);
    $("export-csv").focus();
  } catch {
    dataFeedback("The backup could not be saved. Check that this browser allows local storage.", true);
  } finally {
    $("confirm-restore").disabled = false;
  }
}

$("search").addEventListener("input", filterChanged);
$("search").addEventListener("keydown", (event) => {
  if (event.isComposing || event.key !== "Enter") return;
  const query = codeKey($("search").value);
  const record = (query && matches.find((sample) => codeKey(sample.code) === query)) ||
    (matches.length === 1 && matches[0]);
  if (record) {
    event.preventDefault();
    openRecord(record, $("search"));
  }
});
for (const field of Object.values(filterFields)) field.addEventListener("change", filterChanged);
$("drawer-filter").addEventListener("change", filterChanged);
$("clear").addEventListener("click", clearFilters);
for (const card of document.querySelectorAll(".summary-card")) {
  card.addEventListener("click", () => {
    filterFields.status.value = card.dataset.status;
    filterChanged();
  });
}
$("sort").addEventListener("click", () => {
  ascending = !ascending;
  filterChanged();
});
for (const [id, direction, alternate] of [["previous", -1, "next"], ["next", 1, "previous"]]) {
  $(id).addEventListener("click", () => {
    page += direction;
    render();
    if ($(id).disabled) $(alternate).focus();
  });
}

$("add").addEventListener("click", () => openRecord(null, $("add")));
$("record-form").addEventListener("submit", saveRecord);
$("record-form").addEventListener("input", () => {
  if ($("record-error").hidden === false) recordError("");
});
recordFields.code.addEventListener("change", () => {
  const drawer = /^([A-F])-/.exec(normalizeCode(recordFields.code.value))?.[1];
  if (drawer && !recordFields.drawer.value) recordFields.drawer.value = drawer;
});
recordFields.status.addEventListener("change", updateReference);
recordDialog.addEventListener("close", () => {
  if (recordDialog.open) return;
  editing = null;
  if (returnFocus?.isConnected) returnFocus.focus();
  else $("search").focus();
});

$("open-data").addEventListener("click", () => { dataDialog.showModal(); });
dataDialog.addEventListener("close", () => {
  if (dataDialog.open) return;
  resetRestore();
  dataFeedback();
  $("open-data").focus();
});
$("export-csv").addEventListener("click", () => downloadFile("csv"));
$("export-json").addEventListener("click", () => downloadFile("json"));
$("import").addEventListener("click", () => $("backup-file").click());
$("start-blank").addEventListener("click", () => {
  resetRestore();
  dataFeedback();
  confirmReplacement([], true);
});
$("backup-file").addEventListener("change", previewBackup);
$("cancel-restore").addEventListener("click", () => {
  const source = pendingReplacement?.blank ? $("start-blank") : $("import");
  resetRestore();
  dataFeedback();
  source.focus();
});
$("confirm-restore").addEventListener("click", restoreBackup);

for (const close of document.querySelectorAll("[data-close]")) {
  const dialog = close.closest("dialog");
  close.addEventListener("click", () => {
    if (!dialog.querySelector(".primary:disabled")) dialog.close();
  });
}
for (const dialog of [recordDialog, dataDialog]) {
  dialog.addEventListener("cancel", (event) => {
    if (dialog.querySelector(".primary:disabled")) event.preventDefault();
  });
}
document.addEventListener("keydown", (event) => {
  if (event.defaultPrevented || event.isComposing || event.repeat || event.ctrlKey || event.altKey ||
      event.metaKey || document.querySelector("dialog[open]") ||
      event.target.closest?.("input, select, textarea, [contenteditable]")) return;
  if (event.key === "/") {
    event.preventDefault();
    $("search").focus();
    $("search").select();
  } else if (event.key.toLowerCase() === "n") {
    event.preventDefault();
    openRecord(null, $("add"));
  }
});
window.addEventListener("storage", (event) => {
  if (event.key !== STORAGE_KEY && event.key !== null) return;
  const focusedCode = document.activeElement?.dataset.code;
  syncStorage();
  updateFilterOptions();
  render();
  if (focusedCode) {
    const edit = Array.from($("rows").querySelectorAll(".edit")).find((button) => button.dataset.code === focusedCode);
    (edit || $("search")).focus();
  }
});

syncStorage();
updateFilterOptions();
render();
