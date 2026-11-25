"use strict";

const teams = ["Birch", "Chalk", "Fern", "Lark", "Moss", "Reed"];
const slots = [
  { start: "6:30", end: "6:55" },
  { start: "6:55", end: "7:20" },
  { start: "7:20", end: "7:45" }
];
const storageKey = "thursday-table-tennis-v1";
const dateFormat = new Intl.DateTimeFormat("en-US", {
  weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "UTC"
});
const $ = id => document.getElementById(id);
const dateInput = $("date");
const editor = $("editor");
const form = $("pairing-form");
const firstTeam = $("team-a");
const secondTeam = $("team-b");

function dateKey(date) {
  return date.toISOString().slice(0, 10);
}

function isThursday(key) {
  if (typeof key !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(key) ||
      key < dateInput.min || key > dateInput.max) return false;
  const date = new Date(key);
  return date.getUTCDay() === 4 && dateKey(date) === key;
}

function shiftDate(key, days) {
  const date = new Date(key);
  date.setUTCDate(date.getUTCDate() + days);
  return dateKey(date);
}

function upcomingThursday() {
  const now = new Date();
  const localDay = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  return shiftDate(dateKey(localDay), (4 - localDay.getUTCDay() + 7) % 7);
}

function validPair(pair) {
  return Array.isArray(pair) && pair.length === 2 &&
    teams.includes(pair[0]) && teams.includes(pair[1]) && pair[0] !== pair[1];
}

function load() {
  const fallback = { date: upcomingThursday(), evenings: {}, problem: "" };
  let raw;
  try {
    raw = localStorage.getItem(storageKey);
  } catch {
    return { ...fallback, problem: "Browser storage is unavailable. Changes may be lost when you close this page." };
  }
  if (raw === null) return fallback;
  try {
    const stored = JSON.parse(raw);
    if (!isThursday(stored.date) || !stored.evenings ||
        typeof stored.evenings !== "object" || Array.isArray(stored.evenings)) throw new Error();
    for (const [key, matches] of Object.entries(stored.evenings)) {
      if (!isThursday(key) || !Array.isArray(matches) || matches.length !== 6 ||
          !matches.every(pair => pair === null || validPair(pair))) throw new Error();
    }
    return { ...stored, problem: "" };
  } catch {
    return { ...fallback, problem: "Saved schedules could not be read. Saving is paused to preserve the existing data." };
  }
}

let { date, evenings, problem } = load();
const savingPaused = problem.startsWith("Saved schedules");
let editedIndex = null;

function save() {
  if (savingPaused) return;
  try {
    localStorage.setItem(storageKey, JSON.stringify({ date, evenings }));
    problem = "";
  } catch {
    problem = "Changes could not be saved. Keep this page open to retain your edits.";
  }
}

function matchesForDay() {
  return evenings[date] ?? Array(6).fill(null);
}

function conflictIn(matches, slot) {
  const [left, right] = matches.slice(slot * 2, slot * 2 + 2);
  return left && right ? left.filter(team => right.includes(team)) : [];
}

function teamMarkup(team) {
  return '<span class="team-dot ' + team.toLowerCase() + '" aria-hidden="true"></span>' + team;
}

function matchButton(pair, index, conflicts) {
  const slot = slots[Math.floor(index / 2)];
  const table = index % 2 + 1;
  const description = pair ? pair.join(" vs ") : "Add pairing";
  const warning = conflicts.length ? " · Double booking" : "";
  const body = pair
    ? '<span class="matchup"><span>' + teamMarkup(pair[0]) + '</span><small>vs</small><span>' +
      teamMarkup(pair[1]) + '</span></span><span class="match-action">' + (warning ? "Double booking" : "Edit pairing") + '</span>'
    : '<span class="add-mark" aria-hidden="true">+</span><span>Add pairing</span>';
  return '<button type="button" class="match ' + (pair ? "booked" : "open") + (warning ? " conflict" : "") +
    '" data-index="' + index + '" aria-label="' + slot.start + ' p.m., Table ' + table +
    ', ' + description + warning + '">' + body + '</button>';
}

function renderPrint(matches, conflicts, dateLabel) {
  const rows = slots.map((slot, index) => {
    const cells = matches.slice(index * 2, index * 2 + 2).map(pair => pair
      ? '<td><strong>' + pair[0] + '</strong><span>vs</span><strong>' + pair[1] + '</strong></td>'
      : '<td class="print-open">Open table</td>').join("");
    return '<tr><th scope="row">' + slot.start + '–' + slot.end + '<span>p.m.</span></th>' + cells + '</tr>';
  }).join("");
  const warnings = conflicts.filter(Boolean);
  $("print-sheet").innerHTML = '<header><p>Thursday Table Tennis</p><h1>Evening fixtures</h1><p>' +
    dateLabel + '</p></header>' + (warnings.length ? '<div class="print-warning"><strong>Double bookings</strong><p>' +
    warnings.join(" · ") + '</p></div>' : "") +
    '<table aria-label="Evening fixtures"><thead><tr><th scope="col">Time</th><th scope="col">Table 1</th>' +
    '<th scope="col">Table 2</th></tr></thead><tbody>' + rows + '</tbody></table>';
}

function render() {
  const matches = matchesForDay();
  const conflicts = slots.map((_, index) => conflictIn(matches, index));
  const dateLabel = dateFormat.format(new Date(date));
  dateInput.value = date;
  dateInput.removeAttribute("aria-invalid");
  $("date-error").hidden = true;
  $("evening").textContent = dateLabel;
  $("previous").disabled = !isThursday(shiftDate(date, -7));
  $("next").disabled = !isThursday(shiftDate(date, 7));

  $("board").innerHTML =
    '<div class="matrix-head"><span>Time</span><span>Table 1</span><span>Table 2</span></div>' +
    slots.map((slot, index) => '<section class="slot" aria-label="' + slot.start + ' to ' + slot.end +
      ' p.m."><div class="slot-time"><strong>' + slot.start + '</strong><span>to ' + slot.end +
      ' p.m.</span></div><div class="table-label">Table 1</div>' + matchButton(matches[index * 2], index * 2, conflicts[index]) +
      '<div class="table-label">Table 2</div>' + matchButton(matches[index * 2 + 1], index * 2 + 1, conflicts[index]) +
      '</section>').join("");

  const count = matches.filter(Boolean).length;
  $("count").textContent = count + " / 6 filled";
  $("meter-fill").style.width = (count / 6 * 100) + "%";
  const warnings = conflicts.map((overlap, index) => overlap.length
    ? slots[index].start + ' p.m. · ' + overlap.join(" and ") : "");
  const hasConflict = warnings.some(Boolean);
  $("checks").innerHTML = hasConflict
    ? '<p class="check-label problem"><span aria-hidden="true">!</span> Double bookings</p><ul>' +
      warnings.filter(Boolean).map(warning => '<li>' + warning + '</li>').join("") + '</ul>'
    : '<p class="check-label"><span aria-hidden="true">✓</span> No double bookings</p>';

  $("save-status").textContent = problem || "Changes save in this browser";
  $("save-status").classList.toggle("error", Boolean(problem));
  renderPrint(matches, warnings, dateLabel);
}

function setDate(newDate) {
  if (!isThursday(newDate)) {
    $("date-error").textContent = "Choose a Thursday. The board is still showing " +
      dateFormat.format(new Date(date)) + ".";
    $("date-error").hidden = false;
    dateInput.setAttribute("aria-invalid", "true");
    return;
  }
  date = newDate;
  save();
  render();
}

function previewPairing() {
  const first = firstTeam.value;
  const second = secondTeam.value;
  const sameTeam = first && first === second;
  secondTeam.setCustomValidity(sameTeam ? "Choose a different team." : "");
  if (sameTeam) secondTeam.setAttribute("aria-invalid", "true");
  else secondTeam.removeAttribute("aria-invalid");
  const otherTableIndex = editedIndex % 2 === 0 ? editedIndex + 1 : editedIndex - 1;
  const otherTable = matchesForDay()[otherTableIndex];
  const overlap = otherTable ? [...new Set([first, second].filter(team => otherTable.includes(team)))] : [];
  const message = $("pairing-message");
  message.textContent = sameTeam ? "Choose two different teams." :
    overlap.length ? "Double booking · " + overlap.join(" and ") + " already on the other table." : "";
  message.hidden = !message.textContent;
}

function openEditor(index) {
  editedIndex = index;
  const pair = matchesForDay()[index];
  const slot = slots[Math.floor(index / 2)];
  $("editor-context").textContent = slot.start + "–" + slot.end + " p.m. · Table " + (index % 2 + 1);
  $("editor-title").textContent = pair ? "Edit pairing" : "Add pairing";
  firstTeam.value = pair ? pair[0] : "";
  secondTeam.value = pair ? pair[1] : "";
  $("clear").hidden = !pair;
  previewPairing();
  editor.showModal();
}

function updatePairing(pair) {
  const index = editedIndex;
  const matches = [...matchesForDay()];
  matches[index] = pair;
  if (matches.some(Boolean)) evenings[date] = matches;
  else delete evenings[date];
  save();
  editor.close();
  render();
  $("board").querySelector('[data-index="' + index + '"]').focus();
}

$("roster").innerHTML = teams.map(team => "<li>" + teamMarkup(team) + "</li>").join("");
for (const field of [firstTeam, secondTeam]) {
  field.add(new Option("Choose a team", ""));
  for (const team of teams) field.add(new Option(team, team));
  field.addEventListener("change", previewPairing);
}

$("previous").addEventListener("click", () => setDate(shiftDate(date, -7)));
$("next").addEventListener("click", () => setDate(shiftDate(date, 7)));
dateInput.addEventListener("change", () => setDate(dateInput.value));
$("board").addEventListener("click", event => {
  const button = event.target.closest("[data-index]");
  if (button) openEditor(Number(button.dataset.index));
});
$("cancel").addEventListener("click", () => editor.close());
$("clear").addEventListener("click", () => updatePairing(null));
form.addEventListener("submit", event => {
  event.preventDefault();
  const pair = [firstTeam.value, secondTeam.value];
  if (validPair(pair)) updatePairing(pair);
});
$("print").addEventListener("click", () => window.print());
render();
