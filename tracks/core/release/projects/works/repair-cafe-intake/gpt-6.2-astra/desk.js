'use strict';
const $ = selector => document.querySelector(selector);
const states = ['Waiting', 'In progress', 'Ready'];
const ticket = id => '#' + String(id).padStart(3, '0');
let db, rows = [], filter = 'All', saving = false;

function element(name, className, value) {
  const node = document.createElement(name);
  if (className) node.className = className;
  if (value !== undefined) node.textContent = value;
  return node;
}
function report(message) {
  $('#error').hidden = !message;
  $('#error').textContent = message;
}
function message(value) { $('#notice').textContent = value; }

$('#date').textContent = new Intl.DateTimeFormat(undefined, {weekday:'long', month:'long', day:'numeric', year:'numeric'}).format(new Date());
function renumber() {
  const fields = [...$('#fields').children];
  fields.forEach((field, i) => {
    field.querySelector('legend').textContent = 'Item ' + (i + 1);
    field.querySelector('.remove').hidden = fields.length === 1;
  });
  $('#more').disabled = fields.length >= 3;
}
function addItem(focus = true) {
  if ($('#fields').children.length >= 3) return;
  const field = $('#item').content.firstElementChild.cloneNode(true);
  const detail = field.querySelector('.detail');
  field.querySelector('.request').onchange = event => {
    detail.hidden = event.target.value !== 'Other repair';
    detail.firstElementChild.required = !detail.hidden;
    if (!detail.hidden) detail.firstElementChild.focus();
  };
  field.querySelector('.remove').onclick = () => {
    field.remove();
    renumber();
    $('#more').focus();
  };
  $('#fields').append(field);
  renumber();
  if (focus) field.querySelector('input').focus();
}
$('#more').onclick = () => addItem();
addItem(false);

function render() {
  $('#total').textContent = rows.length + (rows.length === 1 ? ' item' : ' items');
  const search = $('#search').value.trim().toLowerCase();
  const visible = rows.filter(row => {
    const data = [ticket(row.id), row.garment, row.request].join(' ').toLowerCase();
    return (filter === 'All' || row.state === filter) && data.includes(search);
  });
  const records = $('#records');
  records.replaceChildren();
  if (!visible.length) {
    const empty = element('div','empty');
    empty.innerHTML = '<svg aria-hidden="true" viewBox="0 0 48 48"><path d="m7 19 18-12 15 3 1 14-19 13z" fill="#e9eddf"/><path d="m10 26 15-13 14-1 4 12-18 17z" fill="#f2dfbf"/><circle cx="34" cy="18" r="2"/><path d="M35 16q2-15 9-10t-8 12M18 27l9-7m-6 11 8-6"/></svg>';
    empty.append(element('h3','',rows.length ? 'No matching items' : 'Your queue is empty'),
      element('p','',rows.length ? 'Try another search or status filter.' : 'Save an intake to see its tickets here.'));
    records.append(empty);
  }
  for (const row of visible) {
    const card = element('article','row');
    const description = element('div','description');
    description.append(element('strong','',row.garment),element('small','',row.request));
    const status = element('select');
    status.id = 'status-' + row.id;
    status.setAttribute('aria-label','Status for ' + ticket(row.id) + ' ' + row.garment);
    states.forEach(s => status.add(new Option(s, s)));
    status.value = status.dataset.state = row.state;
    status.onchange = () => changeStatus(row.id,status);
    card.append(element('span','tag',ticket(row.id)),description,status);
    records.append(card);
  }
}
for (const state of ['All', ...states]) {
  const button = element('button','',state);
  button.setAttribute('aria-pressed',state === filter);
  button.onclick = () => {
    filter = state;
    for (const b of $('#filters').children) b.setAttribute('aria-pressed', b === button);
    render();
  };
  $('#filters').append(button);
}
$('#search').oninput = render;
function transaction(mode, run) {
  return new Promise((resolve,reject) => {
    const tx = db.transaction('items',mode);
    tx.oncomplete = resolve;
    tx.onabort = () => reject(tx.error || new Error('Transaction aborted'));
    run(tx.objectStore('items'));
  });
}
async function refresh() {
  let items;
  await transaction('readonly',store => {
    const read = store.getAll();
    read.onsuccess = () => { items = read.result; };
  });
  rows = items.reverse();
  render();
}
async function changeStatus(id,select) {
  const state = select.value;
  select.disabled = true;
  try {
    await transaction('readwrite',store => {
      const read = store.get(id);
      read.onsuccess = () => store.put({...read.result, state});
    });
    report('');
    message(ticket(id) + ' marked ' + state.toLowerCase() + '.');
  } catch {
    report('Status change could not be saved. Check available browser storage and try again.');
  }
  await refresh();
  (document.getElementById('status-' + id) || $('#filters [aria-pressed=true]')).focus();
}
$('#intake').onsubmit = async event => {
  event.preventDefault();
  if (!db || saving) return;
  const items = [];
  for (const field of $('#fields').children) {
    const garment = field.querySelector('.garment');
    const request = field.querySelector('.request');
    const source = request.value === 'Other repair' ? field.querySelector('.detail input') : request;
    for (const input of [garment,source]) {
      if (!input.value.trim()) {
        input.setCustomValidity('Enter a short description.');
        input.reportValidity();
        input.oninput = () => input.setCustomValidity('');
        return;
      }
    }
    items.push({garment:garment.value.trim(),request:source.value.trim(),state:'Waiting'});
  }
  const ids = [];
  saving = true;
  $('#save').disabled = true;
  try {
    await transaction('readwrite',store => {
      items.forEach(item => {
        const write = store.add(item);
        write.onsuccess = () => ids.push(write.result);
      });
    });
  } catch {
    report('Intake could not be saved. Your entries are still in the form. Check browser storage and try again.');
    return;
  } finally {
    saving = false;
    $('#save').disabled = false;
  }
  report('');
  message('Intake saved. Tag each garment: ' + items.map((item,i) => ticket(ids[i]) + ' · ' + item.garment).join(' / '));
  $('#fields').replaceChildren();
  addItem();
  $('#search').value = '';
  $('#filters button').click();
  await refresh();
};
async function start() {
  try {
    db = await new Promise((resolve,reject) => {
      const open = indexedDB.open('mending-table-repair-desk',1);
      open.onupgradeneeded = () => open.result.createObjectStore('items',{keyPath:'id',autoIncrement:true});
      open.onsuccess = () => resolve(open.result);
      open.onerror = () => reject(open.error);
    });
    await refresh();
    $('#save').disabled = false;
    window.addEventListener('focus',refresh);
  } catch {
    report('Local records could not be opened. Open this file in a regular browser window with local storage enabled, then reload.');
  }
}
start();
