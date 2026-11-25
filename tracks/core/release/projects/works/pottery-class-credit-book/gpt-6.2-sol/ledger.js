"use strict";

const Ledger = (() => {
  const capacity = 8;
  const storageName = "kiln-ledger";
  const storageKey = location.pathname;

  function fail(message) {
    throw new Error(message);
  }

  function dayString(date) {
    const pad = value => String(value).padStart(2, "0");
    return [date.getFullYear(), pad(date.getMonth() + 1), pad(date.getDate())].join("-");
  }

  function initialEvents(now = new Date()) {
    const tuesday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12);
    const days = (2 - tuesday.getDay() + 7) % 7;
    tuesday.setDate(tuesday.getDate() + (days || (now.getHours() >= 18 ? 7 : 0)));
    const saturday = new Date(tuesday);
    saturday.setDate(saturday.getDate() + 4);
    const at = now.toISOString();
    return [
      { kind: "student", code: "P01", amount: 4, at },
      { kind: "student", code: "P02", amount: 2, at },
      { kind: "student", code: "P03", amount: 1, at },
      { kind: "workshop", id: "handbuilding", title: "Tuesday Handbuilding", date: dayString(tuesday), time: "18:00", at },
      { kind: "workshop", id: "glazing", title: "Saturday Glazing", date: dayString(saturday), time: "10:00", at }
    ];
  }

  function occupied(workshop) {
    return [...workshop.bookings.values()].filter(status => status !== "Cancelled").length;
  }

  function entry(student, event, change, label, workshop) {
    const balance = student.balance + change;
    if (!Number.isSafeInteger(balance) || balance < 0) fail("The credit balance would be out of range.");
    student.balance = balance;
    student.history.push({ at: event.at, label, change, balance, workshop,
      note: event.kind === "credits" || event.kind === "correct" ? event.note : undefined });
  }

  function validText(value, maximum) {
    return typeof value === "string" && value.trim().length > 0 && value.length <= maximum;
  }

  function validDate(value) {
    if (typeof value !== "string" || !/^\d{4}-\d\d-\d\d$/.test(value) || value.startsWith("0000")) return false;
    const parsed = new Date(value + "T00:00:00Z");
    return Number.isFinite(+parsed) && parsed.toISOString().slice(0, 10) === value;
  }

  function replay(events) {
    if (!Array.isArray(events) || !events.length) fail("The backup has no studio records.");
    const students = new Map();
    const workshops = new Map();
    for (const event of events) {
      if (!event || typeof event.at !== "string" || !Number.isFinite(Date.parse(event.at))) {
        fail("A studio record has an invalid timestamp.");
      }
      const student = students.get(event.code);
      const workshop = workshops.get(event.id);
      switch (event.kind) {
        case "student": {
          if (typeof event.code !== "string" || !/^[A-Z0-9][A-Z0-9-]{0,15}$/.test(event.code)) {
            fail("Use 1–16 letters, numbers or hyphens for a student code.");
          }
          if (student) fail("That student code already exists.");
          if (!Number.isSafeInteger(event.amount) || event.amount < 0) fail("Enter a valid opening balance.");
          const record = { code: event.code, balance: 0, history: [] };
          entry(record, event, event.amount, "Opening balance");
          students.set(event.code, record);
          break;
        }
        case "workshop":
          if (!validText(event.id, 100) || workshop || !validText(event.title, 70) || !validDate(event.date) ||
            typeof event.time !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(event.time)) {
            fail("Enter a workshop name, a valid date and a start time.");
          }
          workshops.set(event.id, { id: event.id, title: event.title, date: event.date, time: event.time, bookings: new Map() });
          break;
        case "credits":
          if (!student) fail("That student could not be found.");
          if (!Number.isSafeInteger(event.amount) || event.amount < 1) fail("Enter a whole number of credits greater than zero.");
          if (event.note !== undefined && !validText(event.note, 200)) fail("Enter a valid credit note.");
          entry(student, event, event.amount, "Credits added");
          break;
        case "reserve":
        case "cancel":
        case "attend":
        case "correct": {
          if (!student || !workshop) fail("The student or workshop could not be found.");
          const status = workshop.bookings.get(event.code);
          if (event.kind === "reserve") {
            if (status && status !== "Cancelled") fail("This student already has a seat in this workshop.");
            if (occupied(workshop) >= capacity) fail("This workshop is full.");
            workshop.bookings.set(event.code, "Reserved");
          } else if (event.kind === "cancel") {
            if (status !== "Reserved") fail("Only a reservation can be cancelled.");
            workshop.bookings.set(event.code, "Cancelled");
          } else if (event.kind === "attend") {
            if (status !== "Reserved") fail("A reservation is required to record attendance.");
            if (student.balance < 1) fail("This student has no credits left. Add a credit before recording attendance.");
            entry(student, event, -1, "Attendance", workshop);
            workshop.bookings.set(event.code, "Attended");
          } else {
            if (status !== "Attended") fail("Only recorded attendance can be corrected.");
            if (!["Reserved", "Cancelled"].includes(event.status)) fail("Choose a corrected status.");
            if (!validText(event.note, 200)) fail("Enter a reason for the correction.");
            entry(student, event, 1, "Attendance correction", workshop);
            workshop.bookings.set(event.code, event.status);
          }
          break;
        }
        default:
          fail("The ledger contains an unknown record type.");
      }
    }
    return { students, workshops };
  }

  function open() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(storageName, 1);
      request.onupgradeneeded = () => request.result.createObjectStore("studios");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(new Error("Local storage could not be opened."));
      request.onblocked = () => reject(new Error("Close other copies of the tracker and reopen this page."));
    });
  }

  // Recheck each change inside a read/write transaction so concurrent tabs share the same rules.
  function transact(db, update) {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction("studios", update ? "readwrite" : "readonly");
      const records = transaction.objectStore("studios");
      const request = records.get(storageKey);
      let result;
      let error;
      request.onsuccess = () => {
        try {
          result = update ? update(request.result) : request.result;
          if (update && result !== request.result) records.put(result, storageKey);
        } catch (problem) {
          error = problem;
          transaction.abort();
        }
      };
      transaction.oncomplete = () => resolve(result);
      transaction.onabort = () => reject(error || new Error("Local storage could not finish the change."));
    });
  }

  return { capacity, dayString, initialEvents, occupied, open, replay, transact };
})();
