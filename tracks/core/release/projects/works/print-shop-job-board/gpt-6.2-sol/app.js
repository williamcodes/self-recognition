"use strict";

const stages = [
  { name: "Intake", icon: "inbox", action: "Review new orders", next: "To proofing" },
  { name: "Proofing", icon: "proof", action: "Check or approve proofs", next: "Mark ready" },
  { name: "Ready to Print", icon: "printer", action: "Start print runs", next: "Start printing" },
  { name: "Printing", icon: "clock", action: "Finish print runs", next: "To pickup" },
  { name: "Pickup", icon: "bag", action: "Hand over copies" },
];

const icons = {
  layers: '<path d="m12 3 9 5-9 5-9-5 9-5Zm-9 9 9 5 9-5M3 16l9 5 9-5"/>',
  printer: '<path d="M6 9V3h12v6M6 17H4a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2"/><path d="M6 14h12v7H6zm12-2h1"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  bag: '<rect x="4" y="7" width="16" height="14" rx="2"/><path d="M8 9V6a4 4 0 0 1 8 0v3"/>',
  alert: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5m0 4h.01"/>',
  copy: '<rect x="8" y="8" width="12" height="13" rx="2"/><path d="M16 5a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2"/>',
  board: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16m6-16v16"/>',
  list: '<path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/>',
  inbox: '<path d="M3 13l3-8h12l3 8v5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1Zm0 0h5l2 3h4l2-3h5"/>',
  proof: '<path d="M5 3h9l5 5v13H5zm9 0v5h5m-10 6 2 2 4-4"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 10h18"/>',
  back: '<path d="M19 12H5m7 7-7-7 7-7"/>',
  forward: '<path d="M5 12h14m-7-7 7 7-7 7"/>',
  device: '<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8m-4-4v4"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
};

const storageKey = "copy-desk.orders.v1";
const $ = (id) => document.getElementById(id);
const number = new Intl.NumberFormat("en");
const fullDay = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
const shortDay = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short" });
const timestamp = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const jobDialog = $("job-dialog");
const pickupDialog = $("pickup-dialog");
const jobForm = $("job-form");
const pickupForm = $("pickup-form");
let jobs = [];
let editing = null;
let collecting = null;
let noticeTimer;
let lastRenderAt;

function icon(name) {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]}</svg>`;
}

function escapeHtml(value) {
  const replacements = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  return String(value).replace(/[&<>"']/g, (char) => replacements[char]);
}

function dateKey(date) {
  const pad = (value) => String(value).padStart(2, "0");
  return `${String(date.getFullYear()).padStart(4, "0")}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function seedOrders(now) {
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7));
  const tuesday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 1);
  const wednesday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 2);
  return [
    { id: 1, title: "Recital program", quantity: 75, stage: 1, due: dateKey(tuesday) + "T15:00" },
    { id: 2, title: "Museum flyer", quantity: 200, stage: 2, due: dateKey(wednesday) + "T10:00" },
    { id: 3, title: "Class booklet", quantity: 30, stage: 4, due: dateKey(tuesday) + "T12:00" },
  ].map((job) => ({ ...job, notes: "", pickups: [] }));
}

function handedOver(job) {
  return job.pickups.reduce((total, pickup) => total + pickup.copies, 0);
}

function outstanding(job) {
  return job.quantity - handedOver(job);
}

function isOverdue(job, now) {
  return outstanding(job) > 0 && new Date(job.due).getTime() < now.getTime();
}

function ref(job) {
  return "#" + String(job.id).padStart(3, "0");
}

function dueText(job, includeYear = false) {
  const date = new Date(job.due);
  const day = includeYear || date.getFullYear() !== new Date().getFullYear()
    ? shortDay.format(date) + " " + date.getFullYear()
    : shortDay.format(date);
  return `${day} · ${job.due.slice(11)}`;
}

function readOrders() {
  const raw = localStorage.getItem(storageKey);
  if (raw === null) return null;
  const saved = JSON.parse(raw);
  if (!Array.isArray(saved)) throw new Error("Invalid board data");
  return saved;
}

function setStorageStatus(ok) {
  const status = $("local-status");
  status.classList.toggle("error", !ok);
  status.innerHTML = ok ? "<i></i> Offline workspace" : "<i></i> Local storage unavailable";
  document.querySelector(".footer span").innerHTML = icon("device") + (ok
    ? " Orders are saved in this browser."
    : " Order changes require browser storage. Check your browser settings and reopen the board.");
}

function initialize() {
  try {
    const saved = readOrders();
    jobs = saved ?? seedOrders(new Date());
    if (saved === null) localStorage.setItem(storageKey, JSON.stringify(jobs));
  } catch {
    setStorageStatus(false);
  }
}

function refreshOrders() {
  try {
    const saved = readOrders();
    if (saved !== null) jobs = saved;
    render();
  } catch {
    setStorageStatus(false);
  }
}

function report(message) {
  const notice = $("notice");
  clearTimeout(noticeTimer);
  notice.textContent = message;
  notice.hidden = false;
  noticeTimer = setTimeout(() => { notice.hidden = true; }, 4500);
}

function updateOrders(update, submitButton = null) {
  // Serialize writes across tabs when the browser supports Web Locks.
  const save = () => {
    let current;
    try {
      current = readOrders() ?? jobs;
    } catch {
      setStorageStatus(false);
      throw new Error("Could not read the saved board. Check browser storage and try again.");
    }
    const updated = update(current);
    try {
      localStorage.setItem(storageKey, JSON.stringify(updated));
    } catch {
      setStorageStatus(false);
      throw new Error("Could not save the change. Check browser storage and try again.");
    }
    jobs = updated;
    setStorageStatus(true);
  };

  if (submitButton) submitButton.disabled = true;
  return Promise.resolve().then(async () => {
    try {
      if (navigator.locks) return await navigator.locks.request(storageKey, save);
    } catch (error) {
      // Some browsers allow local storage on file URLs but restrict Web Locks.
      if (error.name !== "SecurityError") throw error;
    }
    return save();
  }).finally(() => {
    if (submitButton) submitButton.disabled = false;
  });
}

function card(job, now) {
  const left = outstanding(job);
  const late = isOverdue(job, now);
  const backLabel = job.stage > 0 ? "Move back to " + stages[job.stage - 1].name : "";
  const previous = backLabel ? `<button type="button" class="icon-button" data-action="back" title="${backLabel}" aria-label="${backLabel} for ${escapeHtml(job.title)}">${icon("back")}</button>` : "";
  const next = job.stage < stages.length - 1
    ? `<button type="button" class="button secondary" data-action="next" title="Move to ${stages[job.stage + 1].name}">${stages[job.stage].next} ${icon("forward")}</button>`
    : `<button type="button" class="button handover" data-action="pickup">${icon("bag")} Record pickup</button>`;
  return `<article class="job-card${late ? " late" : ""}" data-job="${job.id}">
    <div class="job-body">
      <div class="job-meta"><span class="job-ref">${ref(job)}</span>${late ? `<span class="late-label">${icon("alert")} Overdue</span>` : ""}${left === 0 ? '<span class="job-ref">Picked up</span>' : ""}</div>
      <h3 class="job-title"><button type="button" class="title-button" data-action="edit" title="Edit job">${escapeHtml(job.title)}</button></h3>
      <div class="due">${icon("calendar")}<time datetime="${job.due}" title="${dueText(job, true)}">${dueText(job)}</time></div>
      <div class="quantity"><div><span>Ordered</span><strong>${number.format(job.quantity)}</strong></div><div><span>Outstanding</span><strong>${number.format(left)}</strong></div></div>
    </div>
    ${left > 0 ? `<div class="card-actions">${previous}${next}</div>` : ""}
  </article>`;
}

function compareOrders(a, b) {
  return a.due.localeCompare(b.due) || a.id - b.id;
}

function renderBoard(now) {
  const board = $("board");
  const active = document.activeElement;
  const focused = active?.closest("#board [data-job]")?.dataset.job;
  const focusedAction = focused && active.dataset.action;
  const filter = $("filter").value;
  const query = $("search").value.trim().toLowerCase();
  const today = dateKey(now);
  const matches = jobs.filter((job) => {
    if (query && !`${job.title} ${ref(job)} ${job.notes}`.toLowerCase().includes(query)) return false;
    if (filter === "complete") return outstanding(job) === 0;
    if (outstanding(job) === 0) return false;
    if (filter === "today") return job.due.startsWith(today + "T");
    if (filter === "overdue") return isOverdue(job, now);
    return true;
  }).sort(compareOrders);

  if (filter === "complete") {
    board.innerHTML = '<h2 class="completed-title">Completed jobs</h2>' + (matches.length
      ? `<div class="completed-grid">${matches.map((job) => card(job, now)).join("")}</div>`
      : '<p class="section-empty">No completed jobs match this view.</p>');
  } else {
    board.innerHTML = `<div class="board-grid">${stages.map((stage, index) => {
      const group = matches.filter((job) => job.stage === index);
      return `<section class="lane stage-${index}" aria-labelledby="stage-${index}">
        <div class="lane-heading"><span class="stage-icon" data-icon>${icon(stage.icon)}</span><h2 id="stage-${index}">${stage.name}</h2><span class="lane-count" aria-label="${group.length} jobs">${group.length}</span></div>
        <div class="card-list">${group.length ? group.map((job) => card(job, now)).join("") : '<p class="empty-lane">No jobs in this stage</p>'}</div>
      </section>`;
    }).join("")}</div>`;
  }

  if (focusedAction) {
    const updated = board.querySelector(`[data-job="${focused}"]`);
    (updated?.querySelector(`[data-action="${focusedAction}"]`) ?? updated?.querySelector('[data-action="edit"]') ?? $("filter")).focus({ preventScroll: true });
  }
}

function renderQueue(now, open) {
  const rows = open.slice().sort(compareOrders);
  const groups = stages.map((stage, index) => {
    const group = rows.filter((job) => job.stage === index);
    if (!group.length) return "";
    return `<section class="queue-group stage-${index}">
      <h3>${stage.action}</h3>
      <table aria-label="${stage.action}">
        <thead><tr><th scope="col">Job</th><th scope="col">Due</th><th scope="col">Ordered</th><th scope="col">Outstanding</th></tr></thead>
        <tbody>${group.map((job) => `<tr>
          <td><span class="job-ref">${ref(job)}</span> <span class="queue-job-name">${escapeHtml(job.title)}</span>${job.notes ? `<span class="queue-note">${escapeHtml(job.notes)}</span>` : ""}</td>
          <td${isOverdue(job, now) ? ' class="queue-late"' : ""}><time datetime="${job.due}">${dueText(job, true)}</time>${isOverdue(job, now) ? "<br>Overdue" : ""}</td>
          <td>${number.format(job.quantity)}</td><td>${number.format(outstanding(job))}</td>
        </tr>`).join("")}</tbody>
      </table>
    </section>`;
  }).join("");
  $("queue").innerHTML = `<div class="queue-sheet"><header class="queue-heading"><div><h2 id="queue-title">Daily queue</h2><p>${fullDay.format(now)} · All open jobs, earliest due first within each group</p></div></header>
    ${groups || '<p>No open jobs to act on.</p>'}</div>`;
}

function render(now = new Date()) {
  lastRenderAt = now;
  const open = jobs.filter((job) => outstanding(job) > 0);
  $("today").textContent = fullDay.format(now);
  $("open-total").textContent = number.format(open.length);
  $("pickup-total").textContent = number.format(open.filter((job) => job.stage === 4).length);
  $("overdue-total").textContent = number.format(open.filter((job) => isOverdue(job, now)).length);
  $("copy-total").textContent = number.format(open.reduce((total, job) => total + outstanding(job), 0));
  renderBoard(now);
  renderQueue(now, open);
}

function refreshDeadlines() {
  const now = new Date();
  if (dateKey(now) !== dateKey(lastRenderAt) ||
      jobs.some((job) => isOverdue(job, now) !== isOverdue(job, lastRenderAt))) {
    render(now);
  }
}

function setView(view) {
  document.body.dataset.view = view;
  $("board-tab").setAttribute("aria-pressed", String(view === "board"));
  $("queue-tab").setAttribute("aria-pressed", String(view === "queue"));
  $("filters").hidden = view === "queue";
}

function setError(id, message = "") {
  const error = $(id);
  error.textContent = message;
  error.hidden = message === "";
}

function openJobForm(job = null) {
  editing = job;
  jobForm.reset();
  const fields = jobForm.elements;
  const collected = job ? handedOver(job) : 0;
  $("job-dialog-title").textContent = job ? "Edit job " + ref(job) : "New job";
  $("save-job").textContent = job ? "Save changes" : "Add job";
  fields.title.value = job?.title ?? "";
  fields.quantity.min = String(Math.max(1, collected));
  fields.quantity.value = job?.quantity ?? "";
  fields.stage.value = job?.stage ?? 0;
  fields.stage.disabled = Boolean(job && outstanding(job) === 0);
  fields.date.value = job?.due.slice(0, 10) ?? dateKey(new Date());
  fields.time.value = job?.due.slice(11) ?? "";
  fields.notes.value = job?.notes ?? "";
  const history = $("pickup-history");
  history.hidden = collected === 0;
  history.innerHTML = collected === 0 ? "" : `<details><summary>Pickup history · ${number.format(collected)} handed over</summary><ul>${job.pickups.map((entry) =>
    `<li>${number.format(entry.copies)} copies · ${timestamp.format(new Date(entry.at))}</li>`).join("")}</ul></details>`;
  setError("job-error");
  jobDialog.showModal();
}

jobForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const fields = jobForm.elements;
  const title = fields.title.value.trim();
  const quantity = fields.quantity.valueAsNumber;
  const stage = Number(fields.stage.value);
  const due = fields.date.value + "T" + fields.time.value;
  const notes = fields.notes.value.trim();
  const original = editing;
  const dueDate = new Date(due);
  setError("job-error");
  if (!title) {
    setError("job-error", "Enter a job name.");
    fields.title.focus();
    return;
  }
  if (!Number.isFinite(dueDate.getTime()) || dateKey(dueDate) !== fields.date.value ||
      dueDate.toTimeString().slice(0, 5) !== fields.time.value) {
    setError("job-error", "Choose a valid local date and time.");
    fields.time.focus();
    return;
  }
  let savedId;

  try {
    await updateOrders((current) => {
      const job = original && current.find((entry) => entry.id === original.id);
      if (original && (!job || JSON.stringify(job) !== JSON.stringify(original))) {
        throw new Error("This job changed in another window. Close and reopen it to see the latest details.");
      }
      const collected = job ? handedOver(job) : 0;
      if (!Number.isInteger(quantity) || quantity < Math.max(1, collected) || quantity > 9999999) {
        throw new Error("Enter a whole copy count from " + Math.max(1, collected) + " to 9,999,999.");
      }
      if (!stages[stage]) throw new Error("Choose a valid stage.");
      savedId = job?.id ?? current.reduce((max, entry) => Math.max(max, entry.id), 0) + 1;
      const updated = { id: savedId, title, quantity, stage: quantity === collected ? 4 : stage, due, notes, pickups: job?.pickups ?? [] };
      return job ? current.map((entry) => entry.id === savedId ? updated : entry) : [...current, updated];
    }, event.submitter);
    if (!original) {
      setView("board");
      $("filter").value = "open";
      $("search").value = "";
    }
    jobDialog.close();
    render();
    $("board").querySelector(`[data-job="${savedId}"] [data-action="edit"]`)?.focus({ preventScroll: true });
    report(original ? "Job updated." : "Job added.");
  } catch (error) {
    setError("job-error", error.message);
  }
});

function openPickupForm(job) {
  collecting = job;
  pickupForm.reset();
  const left = outstanding(job);
  pickupForm.elements.copies.max = String(left);
  $("pickup-context").textContent = `${job.title} · ${number.format(left)} of ${number.format(job.quantity)} copies outstanding`;
  setError("pickup-error");
  pickupDialog.showModal();
}

pickupForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const copies = pickupForm.elements.copies.valueAsNumber;
  const id = collecting.id;
  let left;
  setError("pickup-error");
  try {
    await updateOrders((current) => {
      const job = current.find((entry) => entry.id === id);
      if (!job || job.stage !== 4 || outstanding(job) === 0) {
        throw new Error("This job is no longer awaiting pickup. Close this window to see the latest board.");
      }
      const available = outstanding(job);
      if (!Number.isInteger(copies) || copies < 1 || copies > available) {
        pickupForm.elements.copies.max = String(available);
        $("pickup-context").textContent = `${job.title} · ${number.format(available)} of ${number.format(job.quantity)} copies outstanding`;
        throw new Error(`Enter a whole number from 1 to ${number.format(available)}.`);
      }
      left = available - copies;
      const updated = { ...job, pickups: [...job.pickups, { copies, at: new Date().toISOString() }] };
      return current.map((entry) => entry.id === id ? updated : entry);
    }, event.submitter);
    pickupDialog.close();
    render();
    ($("board").querySelector(`[data-job="${id}"] [data-action="pickup"]`) ?? $("filter")).focus({ preventScroll: true });
    report(left === 0 ? "Pickup complete." : `Pickup saved. ${number.format(left)} copies outstanding.`);
  } catch (error) {
    setError("pickup-error", error.message);
  }
});

$("board").addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const id = Number(button.closest("[data-job]").dataset.job);
  const job = jobs.find((entry) => entry.id === id);
  if (!job) return;
  const action = button.dataset.action;
  if (action === "edit") return openJobForm(job);
  if (action === "pickup") return openPickupForm(job);

  const nextStage = job.stage + (action === "next" ? 1 : -1);
  try {
    await updateOrders((current) => {
      const latest = current.find((entry) => entry.id === id);
      if (!latest || latest.stage !== job.stage || outstanding(latest) === 0) {
        throw new Error("This job changed in another window. The board has been refreshed.");
      }
      return current.map((entry) => entry.id === id ? { ...entry, stage: nextStage } : entry);
    });
    render();
    report("Moved to " + stages[nextStage].name + ".");
  } catch (error) {
    refreshOrders();
    report(error.message);
  }
});

document.querySelectorAll("[data-icon]").forEach((element) => { element.innerHTML = icon(element.dataset.icon); });
document.querySelectorAll("[data-close]").forEach((button) => { button.onclick = () => button.closest("dialog").close(); });
jobForm.elements.stage.replaceChildren(...stages.map((stage, index) => new Option(stage.name, index)));

$("board-tab").onclick = () => setView("board");
$("queue-tab").onclick = () => { render(); setView("queue"); };
$("new-job").onclick = () => openJobForm();
$("print-button").onclick = () => { render(); window.print(); };
$("filter").onchange = () => renderBoard(new Date());
$("search").oninput = () => renderBoard(new Date());

window.addEventListener("beforeprint", refreshOrders);
window.addEventListener("storage", (event) => {
  if (event.key === storageKey) refreshOrders();
});
document.addEventListener("visibilitychange", () => { if (!document.hidden) refreshOrders(); });
setInterval(refreshDeadlines, 15000);

setView("board");
initialize();
render();
