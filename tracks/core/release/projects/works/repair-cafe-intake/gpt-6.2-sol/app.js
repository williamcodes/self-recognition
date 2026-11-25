"use strict";

const byId = id => document.getElementById(id);
const statusNames = { waiting: "Waiting", progress: "In progress", ready: "Ready" };
const itemLetters = ["A", "B", "C"];
const formatDate = new Intl.DateTimeFormat("en", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
const intakeForm = byId("intake-form");
const fields = byId("item-fields");
const search = byId("search");
const scope = byId("date-scope");
const filters = byId("filters");
const rows = byId("rows");
const dialog = byId("tags-dialog");

let database;
let tickets = [];
let day = "";
let activeFilter = "all";
let nextFieldId = 0;
let latestTicket;
let undoMove;
let saving = false;
let updating = false;
let changes;
try {
  if (typeof BroadcastChannel === "function") changes = new BroadcastChannel("mend-desk");
} catch {
  // Some browser policies restrict messaging between local files.
}

function element(tag, className, content) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (content !== undefined) node.textContent = content;
  return node;
}

function localDay(date) {
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0")].join("-");
}

function updateDay() {
  const now = new Date();
  const currentDay = localDay(now);
  if (day === currentDay) return;
  day = currentDay;
  byId("today").dateTime = day;
  byId("today").textContent = formatDate.format(now);
  if (database) renderBoard();
}

function ticketCode(id) {
  return String(id).padStart(3, "0");
}

function itemCode(id, index) {
  return ticketCode(id) + "-" + itemLetters[index];
}

function repairSummary(item) {
  return item.repair === "Other" ? item.detail : [item.repair, item.detail].filter(Boolean).join(" · ");
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("mend-desk-intake", 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore("tickets", { keyPath: "id", autoIncrement: true });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => storageFailure("Close other Mend Desk tabs, then reload this page.");
  });
}

function transact(mode, run) {
  return new Promise((resolve, reject) => {
    const tx = database.transaction("tickets", mode);
    const store = tx.objectStore("tickets");
    let result;
    let failure;
    tx.oncomplete = () => resolve(result);
    tx.onabort = () => reject(failure || tx.error || new Error("The storage operation was interrupted."));
    run(store, value => { result = value; }, error => {
      failure = error;
      tx.abort();
    });
  });
}

async function readBoard() {
  if (!database) return;
  try {
    const records = await transact("readonly", (store, done) => {
      const request = store.getAll();
      request.onsuccess = () => done(request.result);
    });
    tickets = records.reverse();
    if (document.activeElement?.matches(".status-select") && !updating) return;
    renderBoard();
  } catch {
    storageFailure("The repair board could not be read. Reload to reconnect to local storage.");
  }
}

function storageFailure(message) {
  byId("storage").dataset.state = "error";
  byId("storage-text").textContent = "Storage unavailable";
  byId("storage-error").textContent = message;
  byId("storage-error").hidden = false;
  byId("save-ticket").disabled = true;
  if (!database) {
    byId("empty-title").textContent = "Board unavailable";
    byId("result-count").textContent = "Storage unavailable";
  }
}

function normalise(value) {
  return value.trim().toLowerCase();
}

function matchesSearch(ticket, item, index, terms) {
  const code = itemCode(ticket.id, index).toLowerCase();
  const haystack = [code, ticket.id, item.garment, item.repair, item.detail, statusNames[item.status]].join(" ").toLowerCase();
  const codeTerms = terms.match(/^#?0*(\d+)(?:\s*-?\s*([abc]))?$/);
  if (codeTerms) {
    const [, id, letter] = codeTerms;
    return Number(id) === ticket.id && (!letter || letter === itemLetters[index].toLowerCase());
  }
  return terms.split(/\s+/).every(word => haystack.includes(word));
}

function setFeedback(message, isError = false) {
  byId("board-message").textContent = message;
  byId("board-feedback").hidden = !message;
  byId("board-feedback").dataset.error = String(isError);
  const undoButton = byId("undo");
  undoButton.hidden = !undoMove;
  if (undoMove) undoButton.setAttribute("aria-label", "Undo status change for " + itemCode(undoMove.id, undoMove.index));
}

function refreshItemFields() {
  const groups = Array.from(fields.children);
  groups.forEach((group, index) => {
    group.querySelector("legend").textContent = "Item " + itemLetters[index];
    const remove = group.querySelector(".remove-item");
    remove.hidden = groups.length === 1;
    remove.setAttribute("aria-label", "Remove item " + itemLetters[index]);
  });
  const add = byId("add-item");
  add.disabled = groups.length >= itemLetters.length;
  add.textContent = add.disabled ? "3-item limit reached" : "＋ Add another item";
}

function addItem(focus = false) {
  if (fields.children.length >= itemLetters.length) return;
  const group = byId("item-template").content.firstElementChild.cloneNode(true);
  nextFieldId += 1;
  for (const input of group.querySelectorAll("[data-field]")) {
    input.id = input.dataset.field + "-" + nextFieldId;
    group.querySelector('[data-label="' + input.dataset.field + '"]').htmlFor = input.id;
  }
  const repair = group.querySelector('[data-field="repair"]');
  const detail = group.querySelector('[data-field="detail"]');
  const detailLabel = detail.previousElementSibling.querySelector(".optional");
  repair.addEventListener("change", () => {
    detail.required = repair.value === "Other";
    detailLabel.textContent = detail.required ? "(required for Other)" : "(optional)";
  });
  group.querySelector(".remove-item").addEventListener("click", () => {
    const next = group.nextElementSibling || group.previousElementSibling;
    group.remove();
    refreshItemFields();
    next?.querySelector("input").focus();
  });
  fields.append(group);
  refreshItemFields();
  if (focus) group.querySelector("input").focus();
}

function createRow(ticket, item, index, showDate) {
  const code = itemCode(ticket.id, index);
  const tr = element("tr");
  const tagCell = tr.insertCell();
  const tag = element("button", "button ticket-link", code);
  tag.type = "button";
  tag.setAttribute("aria-label", "View tags for " + code);
  tag.addEventListener("click", () => openTags(ticket));
  tagCell.append(tag);
  if (showDate) {
    const date = element("time", "item-date", ticket.day);
    date.dateTime = ticket.day;
    date.style.display = "block";
    tagCell.append(date);
  }
  const requestCell = tr.insertCell();
  requestCell.append(element("div", "garment", item.garment),
    element("div", "repair", repairSummary(item)));
  const statusCell = tr.insertCell();
  const select = element("select", "status-select " + item.status);
  select.dataset.code = code;
  select.setAttribute("aria-label", "Status of " + code + ", " + item.garment);
  for (const [value, label] of Object.entries(statusNames)) select.add(new Option(label, value));
  select.value = item.status;
  select.addEventListener("change", () => changeStatus(ticket.id, index, item.status, select.value));
  statusCell.append(select);
  return tr;
}

function renderBoard() {
  const focusedCode = document.activeElement?.dataset.code;
  const terms = normalise(search.value);
  const counts = { all: 0, waiting: 0, progress: 0, ready: 0 };
  const visible = [];
  for (const ticket of tickets) {
    if (scope.value === "today" && ticket.day !== day) continue;
    ticket.items.forEach((item, index) => {
      counts.all += 1;
      counts[item.status] += 1;
      if ((activeFilter === "all" || activeFilter === item.status) &&
          (!terms || matchesSearch(ticket, item, index, terms))) {
        visible.push(createRow(ticket, item, index, scope.value === "all"));
      }
    });
  }
  for (const button of filters.querySelectorAll("button")) {
    button.setAttribute("aria-pressed", String(activeFilter === button.dataset.filter));
    button.querySelector("span").textContent = counts[button.dataset.filter];
  }
  rows.replaceChildren(...visible);
  const hasItems = visible.length > 0;
  byId("table").hidden = !hasItems;
  byId("empty").hidden = hasItems;
  const filtered = Boolean(terms) || activeFilter !== "all";
  byId("empty-title").textContent = filtered ? "No matching items" : "The board is clear";
  byId("empty-copy").textContent = filtered ? "Try a different search or status. Use All dates to look through earlier café days." :
    scope.value === "today" ? "Save a ticket to add its items to today’s waiting list." : "Save a ticket to add its items to the waiting list.";
  byId("clear-filters").hidden = !filtered;
  byId("result-count").textContent = visible.length + " of " + counts.all + (counts.all === 1 ? " item" : " items");
  if (focusedCode) {
    const matchingControl = Array.from(rows.querySelectorAll("select")).find(select => select.dataset.code === focusedCode);
    (matchingControl || (undoMove ? byId("undo") : search)).focus();
  }
}

async function saveTicket(event) {
  event.preventDefault();
  if (!database || saving) return;
  byId("form-error").hidden = true;
  const items = [];
  for (const group of fields.children) {
    const garment = group.querySelector('[data-field="garment"]');
    const repair = group.querySelector('[data-field="repair"]');
    const detail = group.querySelector('[data-field="detail"]');
    const invalid = !garment.value.trim() ? garment : repair.value === "Other" && !detail.value.trim() ? detail : null;
    if (invalid) {
      byId("form-error").textContent = invalid === garment ? "Enter a garment description for each item." : "Describe the repair when choosing Other.";
      byId("form-error").hidden = false;
      invalid.focus();
      return;
    }
    items.push({ garment: garment.value.trim(), repair: repair.value, detail: detail.value.trim(), status: "waiting", revision: 0 });
  }
  updateDay();
  const record = { day, items };
  saving = true;
  const saveButton = byId("save-ticket");
  saveButton.disabled = true;
  try {
    const id = await transact("readwrite", (store, done) => {
      const request = store.add(record);
      request.onsuccess = () => done(request.result);
    });
    latestTicket = { ...record, id };
  } catch {
    byId("form-error").textContent = "The ticket was not saved. Your entries are still here. Try saving again.";
    byId("form-error").hidden = false;
    return;
  } finally {
    saving = false;
    saveButton.disabled = !database;
  }
  tickets = [latestTicket, ...tickets.filter(ticket => ticket.id !== latestTicket.id)];
  fields.replaceChildren();
  addItem(true);
  const codes = items.map((_, index) => itemCode(latestTicket.id, index));
  byId("receipt-text").textContent = "Saved · " + codes.join(", ");
  byId("receipt").hidden = false;
  if (!undoMove) setFeedback("");
  renderBoard();
  changes?.postMessage("changed");
  void readBoard();
}

async function changeStatus(id, index, from, to, expectedRevision = null) {
  if (!database || updating || from === to) {
    renderBoard();
    return;
  }
  const code = itemCode(id, index);
  const isUndo = expectedRevision !== null;
  updating = true;
  try {
    const changed = await transact("readwrite", (store, done, abort) => {
      const request = store.get(id);
      request.onsuccess = () => {
        const ticket = request.result;
        const item = ticket?.items[index];
        if (!item || item.status !== from || (isUndo && item.revision !== expectedRevision)) {
          abort(new Error("This item changed in another tab."));
          return;
        }
        item.status = to;
        item.revision = (item.revision || 0) + 1;
        store.put(ticket);
        done(ticket);
      };
    });
    tickets = tickets.map(ticket => ticket.id === id ? changed : ticket);
    undoMove = isUndo ? null : { id, index, from: to, to: from, revision: changed.items[index].revision };
    setFeedback(code + (isUndo ? " restored to " : " moved to ") + statusNames[to] + ".");
    changes?.postMessage("changed");
  } catch (error) {
    if (isUndo) undoMove = null;
    setFeedback(code + " could not be updated. " + (error.message === "This item changed in another tab." ?
      error.message : "Try changing its status again."), true);
  } finally {
    const undoHadFocus = document.activeElement === byId("undo");
    await readBoard();
    if (undoHadFocus && !undoMove) search.focus();
    updating = false;
  }
}

function makeTag(code, title, lines) {
  const tag = element("section", "print-tag");
  tag.append(element("p", "eyebrow", title), element("p", "print-code", code));
  for (const line of lines) tag.append(element("p", "", line));
  return tag;
}

function openTags(ticket) {
  byId("tags-heading").textContent = "Ticket " + ticketCode(ticket.id);
  const pairs = ticket.items.map((item, index) => {
    const code = itemCode(ticket.id, index);
    const pair = element("div", "tag-pair");
    pair.append(makeTag(code, "Garment tag", [item.garment, repairSummary(item)]),
      makeTag(code, "Pickup slip", [item.garment, "Bring this slip to pickup."]));
    return pair;
  });
  byId("tag-pairs").replaceChildren(...pairs);
  dialog.showModal();
}

updateDay();
addItem();
byId("add-item").addEventListener("click", () => addItem(true));
intakeForm.addEventListener("submit", saveTicket);
byId("receipt-tags").addEventListener("click", () => openTags(latestTicket));
byId("print-tags").addEventListener("click", () => window.print());
window.addEventListener("beforeprint", () => document.body.classList.toggle("printing", dialog.open));
window.addEventListener("afterprint", () => document.body.classList.remove("printing"));
byId("undo").addEventListener("click", () => {
  if (undoMove) changeStatus(undoMove.id, undoMove.index, undoMove.from, undoMove.to, undoMove.revision);
});
search.addEventListener("input", renderBoard);
scope.addEventListener("change", renderBoard);
filters.addEventListener("click", event => {
  const button = event.target.closest("button[data-filter]");
  if (!button) return;
  activeFilter = button.dataset.filter;
  renderBoard();
});
byId("clear-filters").addEventListener("click", () => {
  search.value = "";
  activeFilter = "all";
  renderBoard();
  search.focus();
});
changes?.addEventListener("message", () => { void readBoard(); });
window.addEventListener("focus", () => {
  updateDay();
  void readBoard();
});
window.setInterval(updateDay, 60_000);

async function start() {
  try {
    database = await openDatabase();
    database.onversionchange = () => {
      database.close();
      database = null;
      storageFailure("Storage changed in another tab. Reload to reconnect.");
    };
    byId("storage-error").hidden = true;
    byId("storage").dataset.state = "ready";
    byId("storage-text").textContent = "Stored on this device";
    byId("save-ticket").disabled = false;
    await readBoard();
  } catch {
    storageFailure("Local storage could not be opened. Use a regular browser window and reopen this file.");
  }
}

void start();
