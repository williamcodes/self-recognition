"use strict";

const icons = {
  vase: '<path d="M9 3h6m-5 0v4c0 2-5 4-5 8a7 7 0 0 0 14 0c0-4-5-6-5-8V3M6 13h12M6 17h12"/>',
  calendar: '<rect x="3.5" y="5.5" width="17" height="15" rx="2"/><path d="M7.5 3.5v4m9-4v4m-13 3h17m-12 5h2m3 0h2"/>',
  people: '<circle cx="9" cy="8" r="3"/><path d="M3 20v-2a5 5 0 0 1 5-5h2a5 5 0 0 1 5 5v2m1-15a3 3 0 0 1 0 6m4 9v-2a5 5 0 0 0-3-4.6"/>',
  archive: '<rect x="3" y="4" width="18" height="5" rx="1"/><path d="M5 9v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9m-9 4h4"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  arrow: '<path d="M5 12h13m-5-5 5 5-5 5"/>',
  chevron: '<path d="m9 6 6 6-6 6"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  check: '<path d="m5 12 4 4 10-10"/>',
  download: '<path d="M12 3v12m-4-4 4 4 4-4M4 16v4h16v-4"/>'
};

function icon(name) {
  return '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + icons[name] + '</svg>';
}

const content = document.querySelector("#content");
const dialog = document.querySelector("#dialog");
const notice = document.querySelector("#notice");
const storageLabel = document.querySelector("#storage-label");
const escape = value => String(value).replace(/[&<>"']/g, character => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
})[character]);
const workshopDate = workshop => new Date(workshop.date + "T12:00:00");
const weekday = date => date.toLocaleDateString("en-US", { weekday: "long" });
const shortDate = date => date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
const fullDate = date => date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
const entryTime = date => date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
const studentCredits = amount => amount + (amount === 1 ? " credit" : " credits");

let db;
let events;
let state;
let view = "workshops";
let selectedId;
let noticeTimer;
let returnFocus;
let saving = false;
const changes = typeof BroadcastChannel === "function" ? new BroadcastChannel("kiln-ledger:" + location.pathname) : null;

document.querySelectorAll("[data-icon]").forEach(element => {
  element.innerHTML = icon(element.dataset.icon);
});

function orderedWorkshops() {
  return [...state.workshops.values()].sort((a, b) =>
    (a.date + a.time).localeCompare(b.date + b.time) || a.title.localeCompare(b.title));
}

function orderedStudents() {
  return [...state.students.values()].sort((a, b) => a.code.localeCompare(b.code, "en", { numeric: true }));
}

function button(label, action, { style = "secondary", glyph, key = "", disabled = false } = {}) {
  return `<button type="button" class="button ${style}" data-action="${action}" data-key="${escape(key)}" ${disabled ? "disabled" : ""}>${glyph ? icon(glyph) : ""}${escape(label)}</button>`;
}

function workshopCard(workshop) {
  const date = workshopDate(workshop);
  const count = Ledger.occupied(workshop);
  const selected = workshop.id === selectedId;
  return `<button type="button" class="workshop-card${selected ? " selected" : ""}" data-action="select-workshop" data-key="${escape(workshop.id)}" aria-pressed="${selected}">
    <span class="workshop-top">
      <span class="date-tile"><span>${date.toLocaleDateString("en-US", { month: "short" })}</span><strong>${date.getDate()}</strong></span>
      <span class="workshop-summary"><strong>${escape(workshop.title)}</strong><span>${weekday(date)} · ${workshop.time}</span></span>
      <span class="workshop-arrow">${icon("chevron")}</span>
    </span>
    <span class="workshop-bottom">
      <span class="seats" aria-hidden="true">${Array.from({ length: Ledger.capacity }, (_, index) => `<span class="${index < count ? "taken" : ""}"></span>`).join("")}</span>
      <span>${count} / ${Ledger.capacity} seats filled</span>
    </span>
  </button>`;
}

function roster(workshop) {
  const active = [...workshop.bookings].filter(([, status]) => status !== "Cancelled");
  const cancelled = [...workshop.bookings].filter(([, status]) => status === "Cancelled");
  const attendees = active.filter(([, status]) => status === "Attended").length;
  const seatsLeft = Ledger.capacity - active.length;
  const canReserve = seatsLeft > 0 && [...state.students.keys()].some(code =>
    !workshop.bookings.has(code) || workshop.bookings.get(code) === "Cancelled");
  const rows = [...active, ...cancelled].map(([code, status]) => `<tr>
    <th scope="row"><button type="button" class="text-button student-link" data-action="history" data-key="${escape(code)}">${escape(code)}</button></th>
    <td><span class="status ${status.toLowerCase()}">${status}</span></td>
    <td class="row-actions">${status === "Reserved"
      ? button("Mark attended", "attend", { style: "quiet", key: code }) + button("Cancel", "cancel", { style: "quiet muted", key: code })
      : status === "Attended" ? button("Correct", "correct", { style: "quiet", key: code }) : ""}</td>
  </tr>`).join("");
  return `<section class="panel roster" aria-labelledby="roster-title">
    <div class="panel-head">
      <div><h2 id="roster-title">Workshop roster</h2><p>${escape(workshop.title)} · ${shortDate(workshopDate(workshop))}</p></div>
      ${button("Reserve seat", "reserve", { style: "primary", glyph: "plus", disabled: !canReserve })}
    </div>
    <div class="roster-stats">
      <span><i class="dot open"></i>${seatsLeft} open</span>
      <span><i class="dot reserved"></i>${active.length - attendees} reserved</span>
      <span><i class="dot attended"></i>${attendees} attended</span>
    </div>
    ${rows ? `<table class="roster-table"><thead><tr><th scope="col">Student</th><th scope="col">Status</th><th scope="col">Actions</th></tr></thead><tbody>${rows}</tbody></table>`
      : `<div class="empty"><span class="empty-icon">${icon("people")}</span><h3>No reservations yet</h3><p>Reserve a seat to add a student to the roster.</p></div>`}
    ${!canReserve && seatsLeft > 0 ? `<p class="panel-note">${state.students.size ? "All current students already have seats." : "Add a student before reserving a seat."}</p>` : ""}
  </section>`;
}

function balancePanel() {
  const students = orderedStudents();
  return `<section class="panel balances" aria-labelledby="balance-title">
    <div class="panel-head"><div><h2 id="balance-title">Credit balances</h2><p>Open a student’s balance history.</p></div></div>
    <ul class="balance-list">${students.slice(0, 5).map(student => `<li><button type="button" class="balance-button" data-action="history" data-key="${escape(student.code)}">
      <span class="student-avatar">${icon("people")}</span><strong>${escape(student.code)}</strong>
      <span class="balance-number">${studentCredits(student.balance)}</span>${icon("chevron")}
    </button></li>`).join("")}</ul>
    <div class="panel-foot">${button("All students", "students", { style: "text", glyph: "arrow" })}</div>
  </section>`;
}

function workshopsView() {
  const workshops = orderedWorkshops();
  const selected = state.workshops.get(selectedId) || workshops[0];
  if (selected) selectedId = selected.id;
  const held = workshops.reduce((total, workshop) => total + Ledger.occupied(workshop), 0);
  return `<header class="page-header">
    <div><h1>Workshops</h1><p>Manage reservations and record attendance.</p></div>
    ${button("Add workshop", "add-workshop", { style: "primary", glyph: "plus" })}
  </header>
  <section class="overview" aria-labelledby="overview-title">
    <div class="overview-art" aria-hidden="true"></div>
    <div class="overview-content">
      <h2 id="overview-title">Studio overview</h2>
      <dl><div><dt>Workshops</dt><dd>${workshops.length}</dd></div>
      <div><dt>Seats filled</dt><dd>${held}<small> / ${workshops.length * Ledger.capacity}</small></dd></div>
      <div><dt>Students</dt><dd>${state.students.size}</dd></div></dl>
    </div>
  </section>
  <section class="schedule" aria-labelledby="schedule-title">
    <div class="section-head"><h2 id="schedule-title">Workshop schedule</h2><span>8 seats per workshop</span></div>
    ${workshops.length ? `<div class="workshop-grid">${workshops.map(workshopCard).join("")}</div>` : '<p>No workshops yet.</p>'}
  </section>
  <div class="detail-grid">${selected ? roster(selected) : ""}${balancePanel()}</div>`;
}

function studentsView() {
  return `<header class="page-header">
    <div><h1>Students</h1><p>Manage prepaid visit credits and review balance history.</p></div>
    ${button("Add student", "add-student", { style: "primary", glyph: "plus" })}
  </header>
  <section class="panel directory" aria-labelledby="directory-title">
    <div class="panel-head"><div><h2 id="directory-title">Student balances</h2><p>${state.students.size} ${state.students.size === 1 ? "student" : "students"}</p></div></div>
    <table><thead><tr><th scope="col">Student</th><th scope="col">Balance</th><th scope="col">Actions</th></tr></thead><tbody>
      ${orderedStudents().map(student => `<tr><th scope="row">${escape(student.code)}</th>
        <td>${studentCredits(student.balance)}</td><td class="row-actions">
        ${button("View history", "history", { style: "quiet", key: student.code })}
        ${button("Add credits", "add-credits", { style: "quiet", key: student.code })}
        </td></tr>`).join("")}
    </tbody></table>
    ${state.students.size ? "" : '<p class="panel-note">Add a student to start tracking credits.</p>'}
  </section>`;
}

function render() {
  const focused = document.activeElement;
  const focusAction = content.contains(focused) ? focused.dataset.action : null;
  const focusKey = focusAction ? focused.dataset.key : null;
  content.innerHTML = view === "students" ? studentsView() : workshopsView();
  content.querySelector("h1").tabIndex = -1;
  document.querySelectorAll(".navigation button").forEach(item => {
    if (item.dataset.action === view) item.setAttribute("aria-current", "page");
    else item.removeAttribute("aria-current");
  });
  if (focusAction) {
    const replacement = [...content.querySelectorAll("[data-action]")].find(item =>
      item.dataset.action === focusAction && item.dataset.key === focusKey && !item.disabled);
    (replacement || content.querySelector("h1")).focus({ preventScroll: true });
  }
}

function announce(message) {
  clearTimeout(noticeTimer);
  notice.textContent = message;
  noticeTimer = setTimeout(() => { notice.textContent = ""; }, 5000);
}

function dialogFrame(title, description, body, wide = false) {
  if (!dialog.open) returnFocus = document.activeElement;
  dialog.classList.toggle("wide", wide);
  dialog.innerHTML = `<header class="dialog-head"><div><h2 id="dialog-title">${escape(title)}</h2>
    ${description ? `<p>${escape(description)}</p>` : ""}</div>
    <button class="icon-button" type="button" data-action="close" aria-label="Close">${icon("close")}</button></header>${body}`;
  if (!dialog.open) dialog.showModal();
  const focus = dialog.querySelector("[autofocus]") || dialog.querySelector("[data-action=close]");
  focus.focus();
}

function formDialog(title, description, label, fields, submit, wide = false) {
  dialogFrame(title, description, `<form class="dialog-form">${fields}<p class="form-error" role="alert" hidden></p>
    <div class="dialog-actions">${button("Cancel", "close")}<button type="submit" class="button primary">${escape(label)}</button></div></form>`, wide);
  const form = dialog.querySelector("form");
  form.addEventListener("submit", async event => {
    event.preventDefault();
    if (saving) return;
    const error = form.querySelector(".form-error");
    error.hidden = true;
    saving = true;
    form.querySelector("button[type=submit]").disabled = true;
    try {
      await submit(new FormData(form));
      dialog.close();
    } catch (problem) {
      error.textContent = problem.message;
      error.hidden = false;
    } finally {
      saving = false;
      form.querySelector("button[type=submit]").disabled = false;
    }
  });
}

async function apply(event, message, newSelection) {
  const record = { ...event, at: new Date().toISOString() };
  const updated = await Ledger.transact(db, current => {
    if (!current) throw new Error("The studio ledger could not be found. Reopen the tracker.");
    const next = [...current, record];
    Ledger.replay(next);
    return next;
  });
  if (newSelection) selectedId = newSelection;
  setEvents(updated);
  changes?.postMessage("updated");
  announce(message);
}

function setEvents(current) {
  state = Ledger.replay(current);
  events = current;
  render();
}

function showHistory(code) {
  const student = state.students.get(code);
  if (!student) return;
  const rows = student.history.slice().reverse().map(item => `<tr>
    <th scope="row"><strong>${item.label}</strong>
      ${item.workshop ? `<span class="table-detail">${escape(item.workshop.title)} · ${fullDate(workshopDate(item.workshop))}</span>` : ""}
      ${item.note ? `<span class="table-detail">${escape(item.note)}</span>` : ""}</th>
    <td><time datetime="${escape(item.at)}">${fullDate(new Date(item.at))}<span class="table-detail">${entryTime(new Date(item.at))}</span></time></td>
    <td class="number change ${item.change < 0 ? "debit" : "credit"}">${item.change > 0 ? "+" : ""}${item.change}</td>
    <td class="number">${item.balance}</td></tr>`).join("");
  dialogFrame(code + " · Balance history", studentCredits(student.balance) + " available",
    `<div class="history-table"><table><thead><tr><th scope="col">Entry</th><th scope="col">Recorded</th><th scope="col" class="number">Change</th><th scope="col" class="number">Balance</th></tr></thead><tbody>${rows}</tbody></table></div>
    <div class="dialog-actions history-actions">${button("Close", "close")}${button("Add credits", "add-credits", { style: "primary", key: code, glyph: "plus" })}</div>`, true);
}

function addWorkshop() {
  formDialog("Add workshop", "Each workshop has eight seats.", "Add workshop",
    `<label>Workshop name<input name="title" required maxlength="70" autofocus placeholder="e.g. Wheel Throwing"></label>
    <div class="form-grid"><label>Date<input name="date" type="date" required value="${Ledger.dayString(new Date())}"></label>
    <label>Start time<input name="time" type="time" required></label></div>`,
    data => {
      const id = crypto.randomUUID();
      return apply({ kind: "workshop", id, title: data.get("title").trim(), date: data.get("date"), time: data.get("time") }, "Workshop added.", id);
    });
}

function addStudent() {
  formDialog("Add student", "Use a unique code for the student.", "Add student",
    '<label>Student code<input name="code" required maxlength="16" autofocus placeholder="e.g. P04" spellcheck="false"></label><label>Opening credits<input name="amount" type="number" min="0" step="1" required value="0"></label>',
    data => {
      const code = data.get("code").trim().toUpperCase();
      return apply({ kind: "student", code, amount: Number(data.get("amount")) }, code + " added.");
    });
}

function addCredits(code) {
  const student = state.students.get(code);
  if (!student) return;
  formDialog("Add credits for " + code, studentCredits(student.balance) + " currently available", "Add credits",
    '<label>Credits to add<input name="amount" type="number" min="1" step="1" required autofocus></label><label>Note (optional)<input name="note" maxlength="200" placeholder="e.g. Prepaid visit pack"></label>',
    data => apply({ kind: "credits", code, amount: Number(data.get("amount")), note: data.get("note").trim() || undefined }, "Credits added for " + code + "."));
}

function reserve(workshop) {
  const available = orderedStudents().filter(student =>
    !workshop.bookings.has(student.code) || workshop.bookings.get(student.code) === "Cancelled");
  formDialog("Reserve a seat", workshop.title + " · " + fullDate(workshopDate(workshop)) + " · " + workshop.time, "Reserve seat",
    `<label>Student<select name="code" required autofocus><option value="">Choose a student</option>
    ${available.map(student => `<option value="${escape(student.code)}">${escape(student.code)} · ${studentCredits(student.balance)}</option>`).join("")}</select></label>
    <p class="form-hint">The student’s balance changes when you record attendance.</p>`,
    data => apply({ kind: "reserve", id: workshop.id, code: data.get("code") }, "Seat reserved for " + data.get("code") + "."));
}

function changeAttendance(action, code, workshop) {
  const student = state.students.get(code);
  if (!student) return;
  switch (action) {
    case "attend":
      formDialog("Mark " + code + " attended", workshop.title, "Mark attended",
        `<p class="form-hint">${student.balance ? "Recording attendance uses 1 visit credit." : "This student has no credits left. Add a credit before recording attendance."}</p>
        ${student.balance ? "" : button("Add credits", "add-credits", { key: code, glyph: "plus" })}`,
        () => apply({ kind: "attend", id: workshop.id, code }, "Attendance recorded for " + code + "."));
      if (student.balance === 0) dialog.querySelector("button[type=submit]").disabled = true;
      break;
    case "cancel":
      formDialog("Cancel reservation for " + code, workshop.title, "Cancel reservation",
        '<p class="form-hint">The seat will open up and the credit balance will stay the same.</p>',
        () => apply({ kind: "cancel", id: workshop.id, code }, "Reservation cancelled for " + code + "."));
      break;
    case "correct":
      formDialog("Correct attendance for " + code, workshop.title, "Save correction",
        '<p class="form-hint">This returns 1 credit and records an adjustment in the student’s history.</p><label>Corrected status<select name="status" required><option value="Reserved">Reserved · keep the seat</option><option value="Cancelled">Cancelled · release the seat</option></select></label><label>Reason<textarea name="note" rows="2" required maxlength="200" autofocus></textarea></label>',
        data => apply({ kind: "correct", id: workshop.id, code, status: data.get("status"), note: data.get("note").trim() }, "Attendance corrected for " + code + "."));
      break;
  }
}

function showBackups() {
  dialogFrame("Backups", "The ledger is stored in this browser on this device.",
    `<div class="backup-body"><p>Save a copy of your workshops, reservations and credit history. Restoring a backup replaces the current ledger.</p>
    <div class="dialog-actions">${button("Restore backup", "restore")}${button("Download backup", "download", { style: "primary", glyph: "download" })}</div></div>`);
}

async function downloadBackup() {
  const current = await Ledger.transact(db);
  const blob = new Blob([JSON.stringify({ format: "kiln-ledger", version: 1, events: current }, null, 2) + "\n"], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "kiln-ledger-" + Ledger.dayString(new Date()) + ".json";
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  dialog.close();
  announce("Backup downloaded.");
}

function restoreBackup() {
  formDialog("Restore a backup", "This replaces all workshops, students and history in the current ledger.", "Replace ledger",
    '<label>Backup file<input name="file" type="file" accept=".json,application/json" required autofocus></label><label class="checkbox"><input name="confirm" type="checkbox" required> Replace the current ledger with this backup.</label>',
    async data => {
      let backup;
      try {
        backup = JSON.parse(await data.get("file").text());
      } catch {
        throw new Error("Choose a readable Kiln Ledger backup file.");
      }
      if (!backup || backup.format !== "kiln-ledger" || backup.version !== 1) throw new Error("Choose a Kiln Ledger backup file.");
      Ledger.replay(backup.events);
      const updated = await Ledger.transact(db, () => backup.events);
      selectedId = undefined;
      setEvents(updated);
      changes?.postMessage("updated");
      announce("Backup restored.");
    });
}

document.addEventListener("click", event => {
  const target = event.target.closest("button[data-action]");
  if (!target || !state || saving) return;
  const action = target.dataset.action;
  const key = target.dataset.key;
  const workshop = state.workshops.get(selectedId);
  switch (action) {
    case "workshops":
    case "students":
      view = action;
      render();
      content.querySelector("h1").focus();
      break;
    case "select-workshop":
      selectedId = key;
      render();
      break;
    case "add-workshop": addWorkshop(); break;
    case "add-student": addStudent(); break;
    case "history": showHistory(key); break;
    case "add-credits": addCredits(key); break;
    case "reserve": if (workshop) reserve(workshop); break;
    case "cancel":
    case "attend":
    case "correct":
      if (workshop) changeAttendance(action, key, workshop);
      break;
    case "data": showBackups(); break;
    case "download": downloadBackup().catch(problem => {
      dialogFrame("Backup unavailable", problem.message, "");
    }); break;
    case "restore": restoreBackup(); break;
    case "close": dialog.close(); break;
  }
});

dialog.addEventListener("cancel", event => { if (saving) event.preventDefault(); });
dialog.addEventListener("close", () => {
  if (returnFocus?.isConnected && !returnFocus.disabled) returnFocus.focus();
  else if (returnFocus) {
    const { action, key } = returnFocus.dataset;
    const replacement = [...content.querySelectorAll("button[data-action]")].find(item =>
      item.dataset.action === action && item.dataset.key === key && !item.disabled);
    const fallback = document.querySelector("#roster-title") || content.querySelector("h1");
    if (fallback) fallback.tabIndex = -1;
    (replacement || fallback)?.focus({ preventScroll: true });
  }
});

async function sync() {
  if (!db || !state) return;
  try {
    const latest = await Ledger.transact(db);
    if (latest && JSON.stringify(latest) !== JSON.stringify(events)) setEvents(latest);
  } catch (problem) {
    announce(problem.message);
  }
}

if (changes) changes.onmessage = sync;
window.addEventListener("focus", sync);

(async () => {
  try {
    db = await Ledger.open();
    const initial = await Ledger.transact(db, current => current ?? Ledger.initialEvents());
    selectedId = "handbuilding";
    setEvents(initial);
    storageLabel.innerHTML = "<span></span>Stored on this device";
    storageLabel.classList.add("ready");
  } catch (problem) {
    content.innerHTML = `<h1>Ledger unavailable</h1><p>${escape(problem.message)}</p><p>Open this file in a regular browser window with local storage enabled.</p>`;
    storageLabel.innerHTML = "<span></span>Storage unavailable";
    document.querySelectorAll(".sidebar button").forEach(item => { item.disabled = true; });
  } finally {
    content.setAttribute("aria-busy", "false");
  }
})();
