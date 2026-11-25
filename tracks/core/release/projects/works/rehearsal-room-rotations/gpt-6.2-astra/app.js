'use strict';
const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const rooms = {'Main Room': {capacity: 24, piano: true}, Studio: {capacity: 10, piano: false}};
const groups = {
  Chorus: {size: 18, piano: true, duration: 90, days: [0, 2]},
  Duet: {size: 2, piano: true, duration: 60, days: [2]},
  Movement: {size: 8, piano: false, duration: 90, days: [0, 1, 2, 3, 4]},
  Readers: {size: 12, piano: false, duration: 60, days: [0, 3]}
};
const initial = {
  Chorus: {day: 0, room: 'Main Room', start: 1020},
  Duet: {day: 2, room: 'Main Room', start: 1110},
  Movement: {day: 1, room: 'Studio', start: 1080},
  Readers: {day: 3, room: 'Main Room', start: 1170}
};
const key = 'stagebook.weekly.v1';
const $ = id => document.getElementById(id);
const time = n => String(Math.floor(n / 60)).padStart(2,'0') + ':' + String(n % 60).padStart(2,'0');
const allowed = g => g.days.length === 5 ? 'Any weekday' : g.days.map(d => days[d]).join(' or ');
const details = g => g.size + ' people · ' + g.duration + ' min' + (g.piano ? ' · Piano' : '');
const overlaps = (a, ad, b, bd) => a < b + bd && b < a + ad;
function conflicts(name, slot, plan) {
  const g = groups[name], r = rooms[slot.room], reasons = [];
  if (!g.days.includes(slot.day)) reasons.push(name + ' rehearses on ' + allowed(g) + '.');
  if (g.size > r.capacity) reasons.push(name + ' has ' + g.size + ' people. ' + slot.room + ' holds ' + r.capacity + '.');
  if (g.piano && !r.piano) reasons.push(name + ' needs a piano. ' + slot.room + ' has none.');
  if (!Number.isInteger(slot.start)) reasons.push('Enter a start time.');
  else if (slot.start < 1020 || slot.start + g.duration > 1260)
    reasons.push('The ' + g.duration + '-minute rehearsal must fit between 17:00 and 21:00.');
  for (const [other, b] of Object.entries(plan)) {
    if (other !== name && slot.day === b.day && slot.room === b.room && overlaps(slot.start,g.duration,b.start,groups[other].duration))
      reasons.push(slot.room + ' is booked by ' + other + ' from ' + time(b.start) + ' to ' + time(b.start + groups[other].duration) + '.');
  }
  return reasons;
}
let plan = structuredClone(initial);
let status = 'Starter schedule';
try {
  const stored = localStorage.getItem(key);
  if (stored !== null) {
    const parsed = JSON.parse(stored);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) || !Object.entries(parsed).every(([name,b]) =>
      Object.hasOwn(groups,name) && b && Object.hasOwn(rooms,b.room) && !conflicts(name,b,parsed).length)) throw Error();
    plan = parsed;
    status = 'Saved on this device';
  }
} catch {status = 'Saved schedule unavailable · showing starter schedule';}
function persist() {
  try {localStorage.setItem(key, JSON.stringify(plan)); status = 'Saved on this device';}
  catch {status = 'Browser storage unavailable · changes last for this session';}
  render();
}
function render() {
  const entries = Object.entries(plan).sort((a,b) => a[1].start - b[1].start);
  $('count').textContent = entries.length + ' of 4 placed';
  $('saveStatus').textContent = status;
  let html = '<div class="head">TIME</div>' + days.map((d,i) => '<div class="head" style="order:var(--day' + i + ',0)">' + d + '</div>').join('');
  html += '<div class="axis">' + [0,1,2,3,4].map(i => '<span style="top:clamp(9px,' + i*25 + '%,calc(100% - 9px))">' + time(1020+i*60) + '</span>').join('') + '</div>';
  for (let d=0;d<5;d++) {
    const slots = entries.filter(([,b]) => b.day === d);
    html += '<div class="lane" style="order:var(--lane' + d + ',0)">';
    for (const [name,b] of slots) {
      const duration = groups[name].duration;
      const split = slots.some(([n,s]) => name !== n && overlaps(b.start,duration,s.start,groups[n].duration));
      const width = split ? 50 : 100, left = split && b.room === 'Studio' ? 50 : 0;
      html += '<button data-name="' + name + '" class="booking ' + name + '" aria-label="Edit ' + name + ', ' + days[d] + ', ' + time(b.start) + ', ' + b.room + '" style="top:calc(' + (b.start-1020)/2.4 + '% + 2px);height:calc(' + duration/2.4 + '% - 4px);left:calc(' + left + '% + 3px);width:calc(' + width + '% - 6px)"><small>' + time(b.start) + '–' + time(b.start+duration) + '</small><strong>' + name + '</strong><em>' + b.room + '</em></button>';
    }
    html += '</div>';
  }
  $('board').innerHTML = html;
  $('groups').innerHTML = Object.entries(groups).map(([n,g]) => '<button class="group ' + n + '" data-name="' + n + '"><strong><i class="dot"></i>' + n + '</strong><small>' + details(g) + '</small><small>' + allowed(g) + '</small></button>').join('');
  const pending = Object.keys(groups).filter(n => !plan[n]);
  $('paper').innerHTML = '<h1>Weekly rehearsals</h1><p>Community theater · Recurring weekly plan · 17:00–21:00</p><table><thead><tr><th>Weekday</th><th>Main Room · 24 seats · Piano</th><th>Studio · 10 seats · No piano</th></tr></thead><tbody>' + days.map((day,i) => '<tr><th>' + day + '</th>' + Object.keys(rooms).map(r => '<td>' + (entries.filter(([,b]) => b.day===i && b.room===r).map(([n,b]) => time(b.start)+'–'+time(b.start+groups[n].duration)+' &nbsp; <b>'+n+'</b>').join('<br>') || '—') + '</td>').join('') + '</tr>').join('') + '</tbody></table>' + (pending.length ? '<p>Unplaced groups · '+pending.join(', ')+'</p>' : '');
}
function candidate() {
  const parts = $('start').value.split(':').map(Number);
  return {day:Number($('day').value),room:$('room').value,start:parts[0]*60+parts[1]};
}
function preview() {
  const name = $('group').value, g = groups[name], slot = candidate();
  const reasons = conflicts(name,slot,plan);
  $('feedback').classList.toggle('bad',!!reasons.length);
  $('feedback').innerHTML = reasons.length ? '<b>Booking conflicts</b><ul>'+reasons.map(r=>'<li>'+r+'</li>').join('')+'</ul>' : days[slot.day]+' · '+time(slot.start)+'–'+time(slot.start+g.duration)+' · '+slot.room;
  $('commit').disabled = !!reasons.length;
}
function choose() {
  const n = $('group').value, g = groups[n];
  const b = plan[n] || {day:g.days[0],room:g.size<=10 && !g.piano ? 'Studio' : 'Main Room',start:1020};
  $('editTitle').textContent = plan[n] ? 'Move booking' : 'Place booking';
  $('needs').textContent = details(g)+' · '+allowed(g);
  $('day').value=b.day; $('room').value=b.room; $('start').value=time(b.start);
  $('remove').hidden=!plan[n];
  preview();
}
function openEditor(n) {
  $('group').value=n; choose(); $('editor').showModal();
}
$('group').innerHTML=Object.keys(groups).map(n=>'<option>'+n+'</option>').join('');
$('day').innerHTML=days.map((d,i)=>'<option value="'+i+'">'+d+'</option>').join('');
$('room').innerHTML=Object.entries(rooms).map(([n,r])=>'<option value="'+n+'">'+n+' · '+r.capacity+' seats · '+(r.piano?'Piano':'No piano')+'</option>').join('');
$('group').onchange=choose;
for (const field of ['start','day','room']) $(field).oninput=preview;
document.addEventListener('click',event=>{
  const button=event.target.closest('button[data-name]');
  if(button) openEditor(button.dataset.name);
});
$('add').onclick=()=>openEditor(Object.keys(groups).find(n=>!plan[n]) || 'Chorus');
$('cancel').onclick=$('close').onclick=()=>$('editor').close();
$('remove').onclick=()=>{delete plan[$('group').value]; persist(); $('editor').close(); $('add').focus();};
$('form').onsubmit=event=>{
  event.preventDefault();
  const n=$('group').value,b=candidate();
  if(conflicts(n,b,plan).length){preview();return;}
  plan[n]=b; persist(); $('editor').close();
  document.querySelector('.booking[data-name="'+n+'"]').focus();
};
$('print').onclick=()=>window.print();
render();
