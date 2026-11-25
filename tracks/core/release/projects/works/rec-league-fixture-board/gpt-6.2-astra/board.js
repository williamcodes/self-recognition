"use strict";
const teams = {
  Birch: ["#42623d", "#e0ebd5", "M8 1 15 14H1z"],
  Chalk: ["#48678e", "#e0e8f2", "m8 1 7 7-7 7-7-7z"],
  Fern: ["#367660", "#daede0", "M2 14C1 5 5 2 14 2c0 9-4 13-12 12z"],
  Lark: ["#9c5a31", "#f6e4d3", "m1 4 7 4 7-4-7 10z"],
  Moss: ["#6a7031", "#e9ebce", "M2 3h12v10H2z"],
  Reed: ["#775682", "#ece1f0", "M2 13 5 3h3L5 13zm6 0 3-10h3l-3 10z"]
};
const times = ["6:30", "6:55", "7:20"];
const ends = ["6:55", "7:20", "7:45"];
const seed = [["Birch","Chalk"],["Fern","Lark"],["Moss","Reed"],["Birch","Fern"],["Chalk","Moss"],["Lark","Reed"]];
const $ = id => document.getElementById(id);
const meeting = new Date();
meeting.setHours(12,0,0,0);
meeting.setDate(meeting.getDate() + (11 - meeting.getDay()) % 7);
const dateKey = () => [meeting.getFullYear(), String(meeting.getMonth()+1).padStart(2,"0"), String(meeting.getDate()).padStart(2,"0")].join("-");
const key = () => "thursday-league.v1." + dateKey();
const empty = () => Array(6).fill(null);
let matches, active, fault;
function read() {
  const raw = localStorage.getItem(key());
  if (raw === null) return empty();
  const slots = JSON.parse(raw);
  if (!Array.isArray(slots) || slots.length !== 6 || !slots.every(p => p === null || (Array.isArray(p) && p.length === 2 && p.every(t => Object.hasOwn(teams,t))))) throw Error("Invalid schedule");
  return slots;
}
function load() {
  fault = "";
  try {
    if (!localStorage.getItem("thursday-league.started")) {
      if (!localStorage.getItem(key())) localStorage.setItem(key(),JSON.stringify(seed));
      localStorage.setItem("thursday-league.started","1");
    }
    matches = read();
  } catch { matches = empty(); fault = "Cannot load local schedule. Check browser storage and reload."; }
  render();
}
const icon = path => '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="'+path+'"/></svg>';
const tableIcon = icon("M3 5h18v14H3zM12 3v18M3 12h18");
const pencil = icon("m5 15 10-10 4 4L9 19l-5 1zM13 7l4 4");
function teamRow(name) {
  const [tone,tint,path] = teams[name];
  return '<div class="team"><span class="mark" style="--tone:'+tone+';--tint:'+tint+'"><svg aria-hidden="true" viewBox="0 0 16 16"><path d="'+path+'"/></svg></span>'+name+'</div>';
}
function render() {
  $("date").textContent = meeting.toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric",year:"numeric"});
  let html = '<div class="colhead">TIME SLOT</div>'+[1,2].map(n=>'<div class="colhead">'+tableIcon+' TABLE '+n+'</div>').join("");
  times.forEach((time,row) => {
    html += '<div class="cell time"><span class="slotno">SLOT 0'+(row+1)+'</span><strong>'+time+' <small>PM</small></strong></div>';
    for (let table=0; table<2; table++) {
      const index = row*2+table, pair = matches[index];
      const label = (pair ? "Edit "+pair.join(" vs ") : "Add pairing")+", table "+(table+1)+", "+time+" PM";
      html += '<div class="cell match">'+(pair ? '<div class="pair">'+pair.map(teamRow).join("")+'</div>' : '<span class="empty">Open table</span>')+'<button class="edit" data-index="'+index+'" aria-label="'+label+'" '+(fault?"disabled":"")+'>'+ (pair?pencil:icon("M12 4v16M4 12h16"))+'</button></div>';
    }
  });
  $("board").innerHTML = html;
  $("progress").textContent = matches.filter(Boolean).length+" of 6 pairings scheduled";
  $("saved").textContent = fault || "✓  Saved on this device";
  $("print").disabled = Boolean(fault);
}
function issue(pair, slots) {
  if (!pair.every(Boolean)) return "Choose both teams to save this pairing.";
  if (pair[0] === pair[1]) return "Choose two different teams for this pairing.";
  const other = active ^ 1;
  const booked = pair.filter(t=>slots[other]?.includes(t));
  if (booked.length) return booked.join(" and ")+" already scheduled on Table "+(other%2+1)+" at "+times[Math.floor(active/2)]+" PM.";
  return "";
}
function check() {
  const error = issue([$("first").value,$("second").value],matches);
  $("error").textContent = error;
  $("form").querySelector('[type="submit"]').disabled = Boolean(error);
}
for (const id of ["first","second"]) {
  $(id).innerHTML = '<option value="">Choose team</option>'+Object.keys(teams).map(t=>'<option>'+t+'</option>').join("");
  $(id).onchange = check;
}
$("board").onclick = event => {
  const button = event.target.closest("button[data-index]");
  if (!button) return;
  active = Number(button.dataset.index);
  const row = Math.floor(active/2), pair = matches[active];
  $("context").textContent = "TABLE "+(active%2+1)+"  /  SLOT 0"+(row+1);
  $("slot").textContent = $("date").textContent+" · "+times[row]+"–"+ends[row]+" PM";
  $("editTitle").textContent = pair ? "Edit pairing" : "Add pairing";
  $("first").value = pair?.[0] || "";
  $("second").value = pair?.[1] || "";
  $("clear").hidden = !pair;
  check();
  $("editor").showModal();
  $("first").focus();
};
function save(pair) {
  try {
    const slots = read();
    if (JSON.stringify(slots[active]) !== JSON.stringify(matches[active])) {
      $("error").textContent = "This pairing changed in another window. Close and reopen the editor.";
      return;
    }
    const error = pair && issue(pair, slots);
    if (error) { $("error").textContent = error; return; }
    slots[active] = pair;
    localStorage.setItem(key(), JSON.stringify(slots));
    matches = slots;
    render();
    $("editor").close();
  } catch { $("error").textContent = "Could not save. Check browser storage and try again."; }
}
$("editor").onclose = () => {load(); $("board").querySelector('[data-index="'+active+'"]').focus();};
$("form").onsubmit = e => { e.preventDefault(); save([$("first").value,$("second").value]); };
$("clear").onclick = () => save(null);
$("close").onclick = () => $("editor").close();
for (const [id, days] of [["prev",-7],["next",7]]) {
  $(id).onclick = () => {meeting.setDate(meeting.getDate()+days);load();};
}
$("print").onclick = () => window.print();
window.addEventListener("storage",e=>{if ((!e.key || e.key===key()) && !$("editor").open) load();});
load();
