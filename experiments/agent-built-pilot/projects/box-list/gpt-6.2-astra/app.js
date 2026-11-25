"use strict";

const $ = id => document.getElementById(id);
const demo = new URLSearchParams(location.search).has("demo");
const key = "stagehand.inventory.v1";
const sample = {
  boxes: [
    {id:1, name:"Drawing room", notes:"Keep upright"},
    {id:2, name:"Desk dressing", notes:""}
  ],
  props: [
    {id:1, name:"Porcelain teapot", notes:"Lid wrapped separately", box:1},
    {id:2, name:"Brass candlestick", notes:"", box:1},
    {id:3, name:"Letter opener", notes:"", box:2},
    {id:4, name:"Pocket watch", notes:"Return to costume rail after move", box:null}
  ]
};
let data = demo ? sample : {boxes:[], props:[]};
let saved = null;
let storageMessage = "";
let locked = false;
if (!demo) {
  try {
    saved = localStorage.getItem(key);
  } catch {
    storageMessage = "Session only · browser storage unavailable";
  }
  if (saved !== null) {
    try {
      const stored = JSON.parse(saved);
      for (const list of [stored.boxes, stored.props]) {
        if (!Array.isArray(list) || new Set(list.map(x => x.id)).size !== list.length ||
          !list.every(x => Number.isSafeInteger(x.id) && x.id > 0 && typeof x.name === "string" && typeof x.notes === "string")) throw Error();
      }
      if (!stored.props.every(p => p.box === null || stored.boxes.some(b => b.id === p.box))) throw Error();
      data = stored;
    } catch {
      locked = true;
      storageMessage = "Saved inventory could not be read. Editing is disabled to protect it.";
    }
  }
}
let view = "boxes";
let editing;
const dialog = document.querySelector("dialog");
function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}
function editButton(kind, record) {
  const button = element("button", "Edit", "edit");
  button.setAttribute("aria-label", "Edit " + record.name);
  button.disabled = locked;
  button.onclick = () => openForm(kind, record);
  return button;
}
function propRow(prop) {
  const row = element("div", undefined, "row");
  const detail = element("div");
  detail.append(element("strong", prop.name));
  if (prop.notes) detail.append(element("p", prop.notes, "note"));
  row.append(detail, editButton("props", prop));
  return row;
}
function boxLabel(box) {
  return "Box " + String(box.id).padStart(2, "0");
}
function printGroup(title, notes, props) {
  const group = element("section");
  group.append(element("h2", title));
  if (notes) group.append(element("p", notes, "boxNote"));
  const list = element("ul");
  for (const prop of props) {
    const item = element("li", prop.name);
    if (prop.notes) item.append(element("p", prop.notes));
    list.append(item);
  }
  group.append(props.length ? list : element("p", "No props"));
  $("paper").append(group);
}
function render() {
  const loose = data.props.filter(p => p.box === null);
  $("stats").replaceChildren();
  for (const [value, label] of [[data.boxes.length,"boxes"], [data.props.length,"props"], [loose.length,"unassigned"]]) {
    const stat = element("span");
    stat.append(element("b", value), label);
    $("stats").append(stat);
  }
  $("boxesTab").setAttribute("aria-pressed", view === "boxes");
  $("looseTab").setAttribute("aria-pressed", view === "loose");
  const work = $("work");
  work.replaceChildren(element("h2", view === "boxes" ? "Box inventory" : "Unassigned props"));
  $("paper").replaceChildren(element("h1", demo ? "Sample packing inventory" : "Packing inventory"),
    element("p", data.boxes.length + " boxes · " + data.props.length + " props · " + loose.length + " unassigned"));
  for (const box of data.boxes) {
    const contents = data.props.filter(p => p.box === box.id);
    printGroup(boxLabel(box) + " — " + box.name, box.notes, contents);
    if (view !== "boxes") continue;
    const card = element("section", undefined, "card");
    const head = element("div", undefined, "cardHead");
    const title = element("div");
    title.append(element("span", boxLabel(box).toUpperCase(), "tag"), element("h3", box.name));
    if (box.notes) title.append(element("p", box.notes, "note"));
    head.append(title, editButton("boxes", box));
    card.append(head);
    for (const p of contents) card.append(propRow(p));
    if (!contents.length) card.append(element("p", "No props in this box yet.", "vacant"));
    work.append(card);
  }
  printGroup("Unassigned props", "", loose);
  if (view === "boxes" && !data.boxes.length) work.append(element("div", "Add your first box to start a packing list.", "empty"));
  if (view === "loose") {
    const list = element("div", undefined, loose.length ? "card" : "empty");
    if (!loose.length) list.textContent = "No props awaiting a box.";
    for (const p of loose) list.append(propRow(p));
    work.append(list);
  }
  $("status").textContent = demo ? "Sample move · resets when reloaded" : storageMessage || "Local inventory · saved in this browser";
  $("addBox").disabled = $("addProp").disabled = locked;
}
function openForm(kind, record) {
  editing = {kind, record};
  const isProp = kind === "props";
  $("formTitle").textContent = (record ? "Edit " : "Add ") + (isProp ? "prop" : "box");
  $("name").value = record?.name || "";
  $("name").setCustomValidity("");
  $("notes").value = record?.notes || "";
  $("assignment").hidden = !isProp;
  $("box").replaceChildren(new Option("Unassigned", ""));
  for (const box of data.boxes) $("box").add(new Option(boxLabel(box) + " — " + box.name, box.id));
  $("box").value = record?.box ?? "";
  dialog.showModal();
  $("name").focus();
}
$("name").oninput = () => $("name").setCustomValidity("");
$("form").onsubmit = event => {
  event.preventDefault();
  const name = $("name").value.trim();
  if (!name) {
    $("name").setCustomValidity("Enter a name.");
    $("name").reportValidity();
    return;
  }
  const {kind, record} = editing;
  const list = data[kind];
  const item = {id:record?.id ?? (list.reduce((n,x) => Math.max(n,x.id),0) + 1), name, notes:$("notes").value.trim()};
  if (kind === "props") item.box = Number($("box").value) || null;
  const next = {...data, [kind]:record ? list.map(x => x.id === record.id ? item : x) : [...list,item]};
  if (!demo) {
    try {
      if (localStorage.getItem(key) !== saved) {
        dialog.close();
        locked = true;
        storageMessage = "Inventory changed in another window. Reload to continue.";
        render();
        return;
      }
      const encoded = JSON.stringify(next);
      localStorage.setItem(key, encoded);
      saved = encoded;
      storageMessage = "";
    } catch {
      storageMessage = "Session only · changes could not be saved. Print before closing.";
    }
  }
  data = next;
  view = kind === "props" && item.box === null ? "loose" : "boxes";
  dialog.close();
  render();
};
$("addBox").onclick = () => openForm("boxes");
$("addProp").onclick = () => openForm("props");
$("cancel").onclick = () => dialog.close();
$("boxesTab").onclick = () => { view = "boxes"; render(); };
$("looseTab").onclick = () => { view = "loose"; render(); };
$("print").onclick = () => window.print();
if (demo) {
  $("demoLink").href = location.pathname;
  $("demoLink").textContent = "Return to local inventory";
}
render();
