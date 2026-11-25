"use strict";

const byId = (id) => document.getElementById(id);
const storageKey = "prop-load.inventory.v1";
const emptyInventory = () => ({ example: false, boxes: [], props: [] });

const editor = byId("editor");
const form = byId("editor-form");
const nameField = byId("record-name");
const noteField = byId("box-note");
const quantityField = byId("quantity");
const boxField = byId("prop-box");
const deleteButton = byId("delete-record");
const exampleButton = byId("load-example");
const printButton = byId("print-button");

let canSave = true;
let inventory = readInventory();
let filter = "all";
let editing;

function storageProblem(message) {
  byId("storage-note").textContent = "Current session only.";
  const error = byId("storage-error");
  error.textContent = message;
  error.hidden = false;
}

function readInventory() {
  try {
    const saved = localStorage.getItem(storageKey);
    if (saved === null) return emptyInventory();
    const data = JSON.parse(saved);
    if (!validInventory(data)) throw new Error("Invalid inventory data");
    return data;
  } catch {
    canSave = false;
    storageProblem("Saved inventory could not be opened. Changes made in this session will be lost when you close or reload this page.");
    return emptyInventory();
  }
}

function validInventory(data) {
  if (!data || typeof data.example !== "boolean" || !Array.isArray(data.boxes) || !Array.isArray(data.props)) {
    return false;
  }
  const boxesValid = data.boxes.every((box) => box && Number.isSafeInteger(box.id)
    && typeof box.name === "string" && typeof box.note === "string");
  return boxesValid && data.props.every((prop) => prop && Number.isSafeInteger(prop.id)
    && typeof prop.name === "string" && Number.isInteger(prop.quantity) && prop.quantity >= 1
    && (prop.boxId === null || data.boxes.some((box) => box.id === prop.boxId)));
}

function commit(message) {
  if (canSave) {
    try {
      localStorage.setItem(storageKey, JSON.stringify(inventory));
      byId("storage-note").textContent = "Stored in this browser.";
      byId("storage-error").hidden = true;
    } catch {
      storageProblem("The browser could not save your changes. Keep this page open to keep working.");
    }
  }
  render();
  byId("status").textContent = message;
}

function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function entryCount(count) {
  return `${count} prop ${count === 1 ? "entry" : "entries"}`;
}

function fillBoxSelect(select, selected) {
  select.replaceChildren(new Option("Unassigned", ""));
  for (const box of inventory.boxes) {
    select.add(new Option(box.name, String(box.id)));
  }
  select.value = selected === null ? "" : String(selected);
}

function selectedBox(select) {
  return select.value === "" ? null : Number(select.value);
}

function recordRow(item, type, detail) {
  const row = element("li", undefined, "record");
  const text = element("div", undefined, "record-content");
  text.append(element("strong", item.name), element("span", detail, "record-detail"));
  const controls = element("div", undefined, "record-controls");
  const edit = element("button", "Edit", "row-action");
  edit.type = "button";
  edit.setAttribute("aria-label", `Edit ${type} ${item.name}`);
  edit.addEventListener("click", () => openEditor(type, item));
  controls.append(edit);
  row.append(text, controls);
  return { row, controls };
}

function renderProp(prop) {
  const { row, controls } = recordRow(prop, "prop", `Qty ${prop.quantity}`);
  const select = element("select");
  select.id = `assignment-${prop.id}`;
  select.setAttribute("aria-label", `Box for ${prop.name}`);
  select.toggleAttribute("data-unassigned", prop.boxId === null);
  fillBoxSelect(select, prop.boxId);
  select.addEventListener("change", () => {
    prop.boxId = selectedBox(select);
    commit(`Box for ${prop.name} updated.`);
    (byId(select.id) || document.querySelector('[data-filter="unassigned"]')).focus();
  });
  controls.prepend(select);
  return row;
}

function render() {
  const unassigned = inventory.props.filter((prop) => prop.boxId === null);
  const shownProps = filter === "unassigned" ? unassigned : inventory.props;
  byId("box-total").textContent = inventory.boxes.length;
  byId("prop-total").textContent = inventory.props.length;
  byId("unassigned-total").textContent = unassigned.length;

  byId("props").replaceChildren(...shownProps.map(renderProp));
  const propsEmpty = byId("props-empty");
  propsEmpty.hidden = shownProps.length > 0;
  propsEmpty.textContent = filter === "unassigned"
    ? "No unassigned props."
    : "Add a prop to start your packing list.";

  byId("boxes").replaceChildren(...inventory.boxes.map((box) => {
    const count = inventory.props.filter((prop) => prop.boxId === box.id).length;
    const detail = box.note ? `${entryCount(count)} · ${box.note}` : entryCount(count);
    return recordRow(box, "box", detail).row;
  }));
  byId("boxes-empty").hidden = inventory.boxes.length > 0;

  for (const button of document.querySelectorAll("[data-filter]")) {
    button.setAttribute("aria-pressed", String(button.dataset.filter === filter));
  }
  const hasRecords = inventory.boxes.length > 0 || inventory.props.length > 0;
  printButton.disabled = !hasRecords;
  exampleButton.hidden = inventory.example || hasRecords;
  byId("clear-example").hidden = !inventory.example;
  document.querySelector(".eyebrow").textContent = inventory.example ? "Example inventory" : "Backstage logistics";
  renderPrint(unassigned);
}

function renderPrint(unassigned) {
  const report = byId("print-inventory");
  const boxCount = inventory.boxes.length;
  report.replaceChildren(
    element("h1", inventory.example ? "Example packing inventory" : "Packing inventory"),
    element("p", `${boxCount} ${boxCount === 1 ? "box" : "boxes"} · ${entryCount(inventory.props.length)} · ${unassigned.length} unassigned`)
  );
  const groups = inventory.boxes.map((box) => ({
    title: `Box ${box.name}`,
    note: box.note,
    props: inventory.props.filter((prop) => prop.boxId === box.id)
  }));
  if (unassigned.length) groups.push({ title: "Unassigned props", props: unassigned });
  for (const group of groups) {
    const section = element("section");
    section.append(element("h2", group.title));
    if (group.note) section.append(element("p", group.note, "print-note"));
    if (group.props.length) {
      const table = element("table");
      const headings = table.createTHead().insertRow();
      for (const label of ["Prop", "Qty"]) {
        const heading = element("th", label);
        heading.scope = "col";
        headings.append(heading);
      }
      const body = table.createTBody();
      for (const prop of group.props) {
        const row = body.insertRow();
        row.insertCell().textContent = prop.name;
        row.insertCell().textContent = prop.quantity;
      }
      section.append(table);
    } else {
      section.append(element("p", "No props assigned."));
    }
    report.append(section);
  }
}

function openEditor(type, item) {
  editing = { type, item };
  const isProp = type === "prop";
  byId("editor-title").textContent = `${item ? "Edit" : "Add"} ${type}`;
  byId("name-label").textContent = isProp ? "Prop name" : "Box label";
  byId("prop-fields").hidden = !isProp;
  byId("box-fields").hidden = isProp;
  deleteButton.hidden = !item;
  nameField.setCustomValidity("");
  nameField.value = item?.name ?? "";
  noteField.value = isProp ? "" : item?.note ?? "";
  quantityField.disabled = !isProp;
  quantityField.required = isProp;
  quantityField.value = isProp ? item?.quantity ?? 1 : 1;
  fillBoxSelect(boxField, isProp ? item?.boxId ?? null : null);
  editor.showModal();
}

function closeAfterChange(message) {
  editor.close();
  commit(message);
  byId(editing.type === "prop" ? "props-heading" : "boxes-heading").focus();
}

nameField.addEventListener("input", () => nameField.setCustomValidity(""));
form.addEventListener("submit", (event) => {
  event.preventDefault();
  const { type, item } = editing;
  const name = nameField.value.trim();
  const records = type === "prop" ? inventory.props : inventory.boxes;
  if (!name) {
    nameField.setCustomValidity(type === "prop" ? "Enter a prop name." : "Enter a box label.");
  } else if (type === "box" && records.some((box) => box !== item && box.name.toLowerCase() === name.toLowerCase())) {
    nameField.setCustomValidity("This box label is already in use.");
  }
  if (!nameField.reportValidity()) return;

  const values = type === "prop"
    ? { name, quantity: quantityField.valueAsNumber, boxId: selectedBox(boxField) }
    : { name, note: noteField.value.trim() };
  if (item) {
    Object.assign(item, values);
  } else {
    const id = records.reduce((highest, record) => Math.max(highest, record.id), 0) + 1;
    records.push({ id, ...values });
  }
  if (type === "prop" && !item && values.boxId !== null) filter = "all";
  closeAfterChange(`${name} ${item ? "updated" : "added"}.`);
});

deleteButton.addEventListener("click", () => {
  const { type, item } = editing;
  const count = type === "box" ? inventory.props.filter((prop) => prop.boxId === item.id).length : 0;
  const action = count ? ` ${entryCount(count)} will become unassigned.` : "";
  if (!window.confirm(`Delete ${item.name}?${action}`)) return;
  if (type === "box") {
    for (const prop of inventory.props) {
      if (prop.boxId === item.id) prop.boxId = null;
    }
    inventory.boxes = inventory.boxes.filter((box) => box !== item);
  } else {
    inventory.props = inventory.props.filter((prop) => prop !== item);
  }
  const reassigned = count ? ` ${entryCount(count)} now unassigned.` : "";
  closeAfterChange(`${item.name} deleted.${reassigned}`);
});

byId("cancel-editor").addEventListener("click", () => editor.close());
for (const button of document.querySelectorAll("[data-add]")) {
  button.addEventListener("click", () => openEditor(button.dataset.add));
}
for (const button of document.querySelectorAll("[data-filter]")) {
  button.addEventListener("click", () => {
    filter = button.dataset.filter;
    render();
    byId("status").textContent = `${entryCount(byId("props").childElementCount)} shown.`;
  });
}

exampleButton.addEventListener("click", () => {
  inventory = {
    example: true,
    boxes: [
      { id: 1, name: "A-01", note: "Stage left · Fragile" },
      { id: 2, name: "A-02", note: "Props table" },
      { id: 3, name: "B-01", note: "Storage rack" }
    ],
    props: [
      { id: 1, name: "Brass candlesticks", quantity: 2, boxId: 1 },
      { id: 2, name: "Porcelain teapot", quantity: 1, boxId: 1 },
      { id: 3, name: "Velvet drawstring pouch", quantity: 3, boxId: 2 },
      { id: 4, name: "Framed portrait", quantity: 1, boxId: null },
      { id: 5, name: "Wooden calling cards", quantity: 6, boxId: null }
    ]
  };
  filter = "all";
  commit("Example inventory loaded.");
  byId("props-heading").focus();
});

byId("clear-example").addEventListener("click", () => {
  if (!window.confirm("Remove the example inventory and any edits made to it?")) return;
  inventory = emptyInventory();
  filter = "all";
  commit("Example inventory removed.");
  exampleButton.focus();
});

printButton.addEventListener("click", () => window.print());
render();
