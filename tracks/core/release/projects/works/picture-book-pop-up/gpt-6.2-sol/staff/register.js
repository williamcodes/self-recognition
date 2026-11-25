"use strict";
(() => {
  const {tables, starter, tableFor, approved, layout, clean, language, statusIcon, readBackup, backup, sheets} = FoldFind;
  const element = id => document.getElementById(id);
  const storageKey = "fold-and-find-register-v1";
  const title = element("book-title");
  const prompt = element("book-prompt");
  const handling = element("book-handling");
  const feedback = element("feedback");
  const editNote = element("edit-note");
  const all = element("download-all");
  const one = element("download-one");
  const preview = element("preview-card");
  const fileInput = element("backup-file");
  const defaultBooks = () => starter.map(book => ({...book}));
  let books = defaultBooks();
  let selected = starter[0].id;
  let lastStored = null;
  const slots = new Map();
  const counts = new Map();

  try {
    lastStored = localStorage.getItem(storageKey);
    if (lastStored) books = readBackup(JSON.parse(lastStored));
    feedback.textContent = lastStored ? "Register restored from this browser." : "Ready to edit the 18 shelf labels.";
  } catch {
    feedback.textContent = "Browser storage was unavailable or unreadable. Save a register backup to keep your edits.";
  }

  function persist() {
    try {
      if (localStorage.getItem(storageKey) !== lastStored) {
        feedback.textContent = "This register was changed in another tab. Save a backup here before reloading or continuing there.";
        return;
      }
      const next = backup(books);
      localStorage.setItem(storageKey, next);
      lastStored = next;
      feedback.textContent = "Edits saved in this browser.";
    } catch {
      feedback.textContent = "Browser storage is unavailable. Save a register backup to keep your edits.";
    }
  }

  const current = () => books.find(book => book.id === selected);
  const allError = () => {
    const short = tables.find(table => approved(books, table).length !== 2);
    if (short) return short.name + " needs exactly two books marked TRY IT.";
    const invalid = books.find(book => Object.keys(layout(book).errors).length);
    return invalid ? "Review the fields for " + invalid.id + " before downloading the full set." : "";
  };

  function renderSlots() {
    for (const book of books) {
      const button = slots.get(book.id);
      button.setAttribute("aria-pressed", String(selected === book.id));
      button.querySelector("small").textContent = language(book.handling)[0];
    }
    for (const table of tables) counts.get(table.letter).textContent = approved(books, table).length + " of 2 TRY IT";
    all.setAttribute("aria-disabled", String(Boolean(allError())));
  }

  function svg(tag, attributes, content) {
    const node = document.createElementNS("http://www.w3.org/2000/svg", tag);
    for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
    if (content) node.textContent = content;
    preview.append(node);
  }
  function renderPreview(book, table, {errors, heading, promptLines}) {
    const invalid = Object.keys(errors).length > 0;
    preview.toggleAttribute("hidden", invalid);
    element("preview-error").hidden = !invalid;
    if (invalid) return;
    const [status, guidance] = language(book.handling);
    preview.textContent = "";
    preview.setAttribute("aria-label", [table.name, book.id, clean(book.title), clean(book.prompt), status, guidance].filter(Boolean).join(". "));
    const text = (label, x, y, size, weight = "normal", family = "Arial, sans-serif", anchor = "start") =>
      svg("text", {x, y, "font-size": size, "font-weight": weight, "font-family": family, "text-anchor": anchor}, label);
    for (const points of table.icon) {
      const coords = points.map(([x, y]) => [18 + x * .69, 16 + y * .69].join(",")).join(" ");
      svg("polyline", {points: coords, fill: "none", stroke: "#161514", "stroke-width": 1.35, "stroke-linecap": "round", "stroke-linejoin": "round"});
    }
    text(table.number + "  " + table.name, 49, 29, 11, "bold");
    text(book.id, 252, 29, 14, "bold", "Arial, sans-serif", "end");
    svg("path", {d: "M18 45H252", stroke: "#cc321d", "stroke-width": 2.2});
    heading.lines.forEach((line, i) =>
      text(line, 18, 64 + heading.size + i * (heading.size + 2), heading.size, "bold", "Times New Roman, serif"));
    const afterTitle = 64 + heading.size + (heading.lines.length - 1) * (heading.size + 2);
    promptLines.forEach((line, i) => text(line, 18, afterTitle + 22 + i * 16, 14));
    svg("path", {d: "M18 178H252", stroke: "#161514", "stroke-width": .7});
    text(status, 18, 201, 15, "bold");
    text(guidance, 18, 220, 12);
    for (const points of statusIcon(book.handling)) {
      const coords = points.map(([x, y]) => [223 + x, 191 + y].join(",")).join(" ");
      svg("polyline", {points: coords, fill: "none", stroke: "#161514", "stroke-width": 1.8, "stroke-linecap": "round", "stroke-linejoin": "round"});
    }
  }

  function render(loadInputs = false) {
    const book = current();
    const table = tableFor(selected);
    if (loadInputs) {
      title.value = book.title;
      prompt.value = book.prompt;
      handling.checked = book.handling;
    }
    element("edit").textContent = "Edit " + selected;
    element("table-name").textContent = "Table " + table.number + " · " + table.name;
    one.textContent = "Download " + selected + " label";
    const label = layout(book);
    for (const [field, input] of Object.entries({title, prompt})) {
      const error = label.errors[field] || "";
      element(field + "-error").textContent = error;
      input.setAttribute("aria-invalid", String(Boolean(error)));
    }
    one.setAttribute("aria-disabled", String(Object.keys(label.errors).length > 0 || approved(books, table).length !== 2));
    renderSlots();
    renderPreview(book, table, label);
  }

  for (const table of tables) {
    const group = document.createElement("section");
    group.className = "group";
    const heading = document.createElement("h3");
    heading.textContent = table.number + " · " + table.name;
    const count = document.createElement("p");
    count.className = "count";
    counts.set(table.letter, count);
    const grid = document.createElement("div");
    grid.className = "slots";
    for (const book of starter.filter(book => book.id[0] === table.letter)) {
      const button = document.createElement("button");
      button.className = "slot";
      button.type = "button";
      button.append(book.id, document.createElement("small"));
      button.addEventListener("click", () => {
        selected = book.id;
        editNote.textContent = "";
        render(true);
      });
      slots.set(book.id, button);
      grid.append(button);
    }
    group.append(heading, count, grid);
    element("shelves").append(group);
  }

  function changeText(event) {
    const book = current();
    const field = event.target === title ? "title" : "prompt";
    book[field] = event.target.value;
    editNote.textContent = "";
    persist();
    render();
  }
  title.addEventListener("input", changeText);
  prompt.addEventListener("input", changeText);
  handling.addEventListener("change", () => {
    const book = current();
    const table = tableFor(book.id);
    if (handling.checked && !book.handling && approved(books, table).length >= 2) {
      handling.checked = false;
      editNote.textContent = "This table already has two TRY IT books. Uncheck one of them first.";
      return;
    }
    book.handling = handling.checked;
    editNote.textContent = approved(books, table).length === 2
      ? "Two TRY IT books selected. Reprint both labels when you swap a handling book."
      : "Choose a replacement TRY IT book before printing labels for this table.";
    persist();
    render();
  });

  function download(data, type, filename) {
    const url = URL.createObjectURL(new Blob([data], {type}));
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }
  all.addEventListener("click", () => {
    const error = allError();
    if (error) {
      feedback.textContent = error;
      return;
    }
    download(sheets(books), "application/pdf", "fold-and-find-book-labels.pdf");
    feedback.textContent = "Full label set downloaded.";
  });
  one.addEventListener("click", () => {
    if (approved(books, tableFor(selected)).length !== 2) {
      editNote.textContent = "Choose two TRY IT books for this table before downloading.";
      return;
    }
    if (Object.keys(layout(current()).errors).length) {
      editNote.textContent = "Review the fields above before downloading this label.";
      return;
    }
    download(sheets(books, selected), "application/pdf", "fold-and-find-" + selected + ".pdf");
    editNote.textContent = "Label for " + selected + " downloaded.";
  });
  element("save-backup").addEventListener("click", () => {
    download(backup(books), "application/json", "fold-and-find-register.json");
    feedback.textContent = "Register backup downloaded.";
  });
  element("open-backup").addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", async () => {
    const file = fileInput.files[0];
    fileInput.value = "";
    if (!file) return;
    try {
      if (file.size > 1000000) throw new Error("Choose a Fold and Find register backup.");
      const incoming = readBackup(JSON.parse(await file.text()));
      if (JSON.stringify(books) !== JSON.stringify(starter) &&
          !window.confirm("Replace this register with the selected backup?")) return;
      books = incoming;
      persist();
      render(true);
      editNote.textContent = "";
    } catch (error) {
      feedback.textContent = error instanceof SyntaxError ? "This file could not be read as a register backup." : error.message;
    }
  });
  render(true);
})();
