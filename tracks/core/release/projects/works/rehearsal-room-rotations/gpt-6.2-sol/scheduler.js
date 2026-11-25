"use strict";

const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const rooms = {
  main: { name: "Main Room", short: "Main", seats: 24, piano: true },
  studio: { name: "Studio", short: "Studio", seats: 10, piano: false },
};
const groups = {
  chorus: { name: "Chorus", people: 18, duration: 90, piano: true, days: [0, 2] },
  duet: { name: "Duet", people: 2, duration: 60, piano: true, days: [2] },
  movement: { name: "Movement", people: 8, duration: 90, piano: false, days: [0, 1, 2, 3, 4] },
  readers: { name: "Readers", people: 12, duration: 60, piano: false, days: [0, 3] },
};
const groupIds = Object.keys(groups);
const openTime = 17 * 60;
const closeTime = 21 * 60;
const windowMinutes = closeTime - openTime;
const storageKey = "callboard.week.v1";
const byId = (id) => document.getElementById(id);
const time = (minutes) => [Math.floor(minutes / 60), minutes % 60].map((part) => String(part).padStart(2, "0")).join(":");
const endOf = (booking) => booking.start + groups[booking.group].duration;
const icon = (name) => '<svg aria-hidden="true"><use href="#' + name + '"/></svg>';

function readTime(value) {
  const parts = value.trim().match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
  return parts ? Number(parts[1]) * 60 + Number(parts[2]) : NaN;
}

function availableDays(group, short = false) {
  if (group.days.length === days.length) return "Any weekday";
  return group.days.map((day) => short ? days[day].slice(0, 3) : days[day]).join(" or ");
}

function reasonsFor(candidate, existing) {
  const group = groups[candidate.group];
  const room = rooms[candidate.room];
  const reasons = [];
  if (!group.days.includes(candidate.day)) {
    reasons.push(group.name + " rehearses on " + availableDays(group) + ".");
  }
  if (group.people > room.seats) {
    reasons.push(group.name + " has " + group.people + " people. " + room.name + " seats " + room.seats + ".");
  }
  if (group.piano && !room.piano) {
    reasons.push(group.name + " needs a piano. " + room.name + " has no piano.");
  }
  if (!Number.isInteger(candidate.start)) {
    reasons.push("Enter a start time in 24-hour format, such as 17:30.");
    return reasons;
  }
  const end = endOf(candidate);
  if (candidate.start < openTime || end > closeTime) {
    reasons.push("Rooms are open 17:00–21:00. " + group.name + " needs " + group.duration +
      " minutes and can start between 17:00 and " + time(closeTime - group.duration) + ".");
  }
  for (const other of existing) {
    if (other.group === candidate.group) {
      reasons.push(group.name + " already has a weekly booking.");
    } else if (other.day === candidate.day && other.room === candidate.room &&
               candidate.start < endOf(other) && end > other.start) {
      reasons.push(room.name + " is booked by " + groups[other.group].name + " on " + days[other.day] +
        " from " + time(other.start) + " to " + time(endOf(other)) + ".");
    }
  }
  return reasons;
}

function showStorageStatus(active) {
  const label = byId("storage-status");
  label.classList.toggle("warning", !active);
  label.innerHTML = "<span></span>" + (active ? "Saved on this device" : "Local saving unavailable");
}

function loadWeek() {
  const raw = localStorage.getItem(storageKey);
  if (raw === null) return [];
  const saved = JSON.parse(raw);
  if (!Array.isArray(saved)) throw new Error("Invalid saved schedule");
  const week = [];
  for (const entry of saved) {
    if (!entry || !Object.hasOwn(groups, entry.group) || !Object.hasOwn(rooms, entry.room) ||
        !Number.isInteger(entry.day) || !days[entry.day] || reasonsFor(entry, week).length) {
      throw new Error("Invalid saved booking");
    }
    week.push({ group: entry.group, day: entry.day, room: entry.room, start: entry.start });
  }
  return week;
}

let bookings = [];
try {
  bookings = loadWeek();
  // Check write access even when the schedule starts empty.
  localStorage.setItem(storageKey, JSON.stringify(bookings));
} catch {
  showStorageStatus(false);
}

function persist(week) {
  bookings = week;
  try {
    localStorage.setItem(storageKey, JSON.stringify(bookings));
    showStorageStatus(true);
    return true;
  } catch {
    showStorageStatus(false);
    return false;
  }
}

const calendar = byId("calendar");
const dialog = byId("editor");
const groupField = byId("group");
const dayField = byId("day");
const roomField = byId("room");
const startField = byId("start");
const dayView = byId("day-view");
let editing = null;
let opener = null;
let focusGroup = null;

function options(entries) {
  return entries.map(([value, label]) => '<option value="' + value + '">' + label + '</option>').join("");
}
const dayOptions = options(days.map((day, index) => [index, day]));
dayView.innerHTML = dayOptions;
dayField.innerHTML = dayOptions;
roomField.innerHTML = options(Object.entries(rooms).map(([id, room]) => [id, room.name]));

function renderCalendar() {
  let html = '<div class="time-axis" aria-hidden="true">';
  for (let start = openTime; start <= closeTime; start += 60) {
    html += '<div class="time-label">' + time(start) + '</div>';
  }
  html += '</div>';

  for (const [day, name] of days.entries()) {
    html += '<section class="day-column" data-day="' + day + '"><h3>' + name + '</h3><div class="day-lanes">';
    for (const [id, room] of Object.entries(rooms)) {
      html += '<div class="lane ' + id + '"><div class="lane-name" aria-hidden="true">' + room.short +
        '</div><div class="track"><button type="button" class="track-add" data-add="' + id +
        '" aria-label="Book ' + room.name + ' on ' + name + '"' +
        (bookings.length === groupIds.length ? ' disabled' : '') + '><span class="slot-hint">' +
        icon("plus") + '</span></button>';

      for (const booking of bookings.filter((item) => item.day === day && item.room === id).sort((a, b) => a.start - b.start)) {
        const group = groups[booking.group];
        const start = time(booking.start);
        const end = time(endOf(booking));
        const top = (booking.start - openTime) / windowMinutes * 100;
        const height = group.duration / windowMinutes * 100;
        html += '<button type="button" class="booking ' + booking.group + '" data-edit="' + booking.group +
          '" style="--top:' + top + '%;--height:' + height + '%" aria-label="Edit ' + group.name + ', ' +
          name + ', ' + room.name + ', ' + start + ' to ' + end + '"><strong>' + group.name +
          '</strong><span>' + start + '<wbr><span class="end-label">–' + end + '</span></span></button>';
      }
      html += '</div></div>';
    }
    html += '</div></section>';
  }

  calendar.innerHTML = html;
  showDay();
}

function showDay() {
  for (const column of calendar.querySelectorAll(".day-column")) {
    column.classList.toggle("current-day", column.dataset.day === dayView.value);
  }
}

function renderRoster() {
  byId("group-count").textContent = bookings.length + " of " + groupIds.length + " booked";
  const progress = byId("progress");
  progress.setAttribute("aria-valuenow", bookings.length);
  progress.style.setProperty("--progress", bookings.length / groupIds.length * 100 + "%");

  byId("group-list").innerHTML = groupIds.map((id) => {
    const group = groups[id];
    const booked = bookings.find((booking) => booking.group === id);
    const action = booked ? "Edit booking for " : "Book ";
    return '<button type="button" class="group-card ' + id + '" data-group="' + id +
      '" aria-label="' + action + group.name + '" aria-describedby="details-' + id + '"><span class="group-mark" aria-hidden="true">' +
      group.name[0] + '</span><span class="group-copy" id="details-' + id + '"><strong class="group-name">' +
      group.name + '</strong><span class="group-meta">' + group.people + ' people · ' + group.duration + ' min' +
      (group.piano ? ' · Piano' : '') + '</span><span class="group-days">' +
      (booked ? days[booked.day].slice(0, 3) + ' · ' + time(booked.start) + ' · ' + rooms[booked.room].name : availableDays(group, true)) +
      '</span></span><span class="group-action">' + icon(booked ? "check" : "arrow") + '</span></button>';
  }).join("");
}

function renderPrint() {
  const rows = days.map((day, index) => {
    const list = bookings.filter((item) => item.day === index)
      .sort((a, b) => a.start - b.start || a.room.localeCompare(b.room));
    if (!list.length) return '<tr><th scope="row">' + day + '</th><td colspan="3">No rehearsals</td></tr>';
    return list.map((booking) => '<tr><th scope="row">' + day + '</th><td>' + time(booking.start) +
      '–' + time(endOf(booking)) + '</td><td>' + rooms[booking.room].name + '</td><td>' +
      groups[booking.group].name + '</td></tr>').join("");
  }).join("");
  const unbooked = groupIds.filter((id) => !bookings.some((booking) => booking.group === id));
  byId("print-schedule").innerHTML = '<h1>Weekly rehearsal schedule</h1><p>Community theater · Monday–Friday · 17:00–21:00</p>' +
    '<table><thead><tr><th scope="col">Day</th><th scope="col">Time</th><th scope="col">Room</th><th scope="col">Group</th></tr></thead><tbody>' +
    rows + '</tbody></table>' + (unbooked.length ? '<p><strong>Still to book</strong> · ' +
      unbooked.map((id) => groups[id].name).join(", ") + '</p>' : '');
}

function render() {
  renderCalendar();
  renderRoster();
  renderPrint();
  byId("new-booking").disabled = bookings.length === groupIds.length;
}

function defaultSlot(groupId) {
  const group = groups[groupId];
  const preferredRooms = group.piano || group.people > rooms.studio.seats ? ["main"] : ["studio", "main"];
  for (const day of group.days) {
    for (const room of preferredRooms) {
      for (let start = openTime; start + group.duration <= closeTime; start += 30) {
        const candidate = { group: groupId, day, room, start };
        if (!reasonsFor(candidate, bookings).length) return candidate;
      }
    }
  }
  return { day: group.days[0], room: preferredRooms[0], start: openTime };
}

function openEditor(trigger, groupId, slot) {
  const booking = bookings.find((item) => item.group === groupId);
  const unbooked = groupIds.filter((id) => !bookings.some((item) => item.group === id));
  if (!booking && !unbooked.length) return;

  editing = booking?.group ?? null;
  opener = trigger;
  focusGroup = null;
  const choices = booking ? [editing] : unbooked;
  groupField.innerHTML = options(choices.map((id) => [id, groups[id].name]));
  groupField.disabled = Boolean(booking);
  const suggestedGroup = slot && choices.find((id) => !reasonsFor({ ...slot, group: id }, bookings).length);
  groupField.value = groupId || suggestedGroup || choices[0];
  const values = booking || slot || defaultSlot(groupField.value);
  dayField.value = values.day;
  roomField.value = values.room;
  startField.value = time(values.start);
  byId("editor-title").textContent = booking ? "Move " + groups[editing].name : "New booking";
  byId("remove").hidden = !booking;
  byId("save").textContent = booking ? "Save changes" : "Save booking";
  updateValidation();
  dialog.showModal();
  (booking ? dayField : groupField).focus();
}

function draft() {
  return { group: groupField.value, day: Number(dayField.value), room: roomField.value, start: readTime(startField.value) };
}

function updateValidation() {
  const candidate = draft();
  const group = groups[candidate.group];
  byId("group-detail").textContent = group.people + " people · " + group.duration + " min · " +
    (group.piano ? "Piano required · " : "") + availableDays(group);
  byId("end-time").textContent = Number.isNaN(candidate.start) || endOf(candidate) >= 24 * 60
    ? "" : "Ends at " + time(endOf(candidate));
  const reasons = reasonsFor(candidate, bookings.filter((booking) => booking.group !== editing));
  const validation = byId("validation");
  const next = reasons.length ? '<strong>Booking conflicts</strong><ul>' +
    reasons.map((reason) => '<li>' + reason + '</li>').join("") + '</ul>' : "";
  if (validation.innerHTML !== next) validation.innerHTML = next;
  return reasons;
}

function finish(nextWeek, message, group, day) {
  const saved = persist(nextWeek);
  if (day !== undefined) dayView.value = day;
  focusGroup = group;
  render();
  dialog.close();
  byId("feedback").textContent = message + (saved ? "" : " Changes are available until this page closes.");
}

function trackStart(button, clientY) {
  const bounds = button.getBoundingClientRect();
  const step = 30;
  const offset = Math.floor((clientY - bounds.top) / bounds.height * windowMinutes / step) * step;
  return openTime + Math.max(0, Math.min(windowMinutes - step, offset));
}

calendar.addEventListener("pointermove", (event) => {
  const trigger = event.target.closest("[data-add]");
  if (!trigger || trigger.disabled) return;
  const top = (trackStart(trigger, event.clientY) - openTime) / windowMinutes * 100;
  trigger.style.setProperty("--hint-top", top + "%");
});

calendar.addEventListener("click", (event) => {
  const trigger = event.target.closest("button");
  if (!trigger) return;
  if (trigger.dataset.edit) {
    openEditor(trigger, trigger.dataset.edit);
  } else {
    const start = event.detail ? trackStart(trigger, event.clientY) : openTime;
    openEditor(trigger, null, { day: Number(trigger.closest(".day-column").dataset.day), room: trigger.dataset.add, start });
  }
});

dayView.addEventListener("change", showDay);
byId("group-list").addEventListener("click", (event) => {
  const trigger = event.target.closest("[data-group]");
  if (trigger) openEditor(trigger, trigger.dataset.group);
});
byId("new-booking").addEventListener("click", (event) => openEditor(event.currentTarget));
byId("print-button").addEventListener("click", () => window.print());

for (const field of [groupField, dayField, roomField, startField]) {
  field.addEventListener("change", updateValidation);
}
startField.addEventListener("input", updateValidation);
for (const id of ["close-editor", "cancel"]) {
  byId(id).addEventListener("click", () => dialog.close());
}
dialog.addEventListener("close", () => {
  const target = focusGroup ? byId("group-list").querySelector('[data-group="' + focusGroup + '"]') : opener;
  (target?.isConnected ? target : dayView.offsetWidth ? dayView : byId("group-list").querySelector("button")).focus({ preventScroll: true });
});

byId("booking-form").addEventListener("submit", (event) => {
  event.preventDefault();
  if (updateValidation().length) return;
  const candidate = draft();
  const rest = bookings.filter((booking) => booking.group !== editing);
  const message = groups[candidate.group].name + (editing ? " moved to " : " booked for ") +
    days[candidate.day] + " at " + time(candidate.start) + " in " + rooms[candidate.room].name + ".";
  finish([...rest, candidate], message, candidate.group, candidate.day);
});

byId("remove").addEventListener("click", () => {
  if (!editing || !window.confirm("Remove the weekly booking for " + groups[editing].name + "?")) return;
  finish(bookings.filter((booking) => booking.group !== editing), groups[editing].name + " booking removed.", editing);
});

window.addEventListener("storage", (event) => {
  if (event.key !== storageKey && event.key !== null) return;
  try {
    bookings = loadWeek();
  } catch {
    return;
  }
  if (dialog.open) {
    dialog.close();
    byId("feedback").textContent = "The schedule changed in another tab. Reopen the booking to continue.";
  }
  render();
});

render();
