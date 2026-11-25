'use strict';

const $ = (selector, root = document) => root.querySelector(selector);
const all = (selector, root = document) => Array.from(root.querySelectorAll(selector));
const paths = {
  sprout: '<path d="M12 21v-8m0 2C5 15 3 11 3 6c5 0 9 3 9 8m0 0c0-5 4-9 9-9 0 6-3 9-9 9M8 21h8"/>',
  catalog: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M4 8h16m-8 3v7m-3-4h6"/>',
  history: '<path d="M3 12a9 9 0 1 1 2.64 6.36M3 12V6m0 6h6m3-5v5l3 2"/>',
  printer: '<path d="M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 14h12v7H6zm12-2h1"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  packet: '<path d="M5 3h14v18H5zM5 7h14m-7 11v-4m0 1c-3 0-4-2-4-4 3 0 4 2 4 4m0 0c0-3 2-4 4-4 0 2-1 4-4 4"/>',
  layers: '<path d="m12 3 9 5-9 5-9-5zm-9 9 9 5 9-5M3 16l9 5 9-5"/>',
  alert: '<path d="m10.28 4.2-8.03 14A1.8 1.8 0 0 0 3.8 21h16.4a1.8 1.8 0 0 0 1.55-2.8l-8.03-14a2 2 0 0 0-3.44 0ZM12 9v4m0 4h.01"/>',
  search: '<circle cx="10.8" cy="10.8" r="6.4"/><path d="m16 16 4 4"/>',
  filter: '<path d="M4 6h16M7 12h10m-7 6h4"/>',
  arrow: '<path d="M5 12h14m-5-5 5 5-5 5"/>',
  chevron: '<path d="m10 6 6 6-6 6"/>',
  flower: '<path d="M12 9c-5-6 2-9 2-3v3c5-4 9 2 4 4l-3 1c6 3 2 9-2 4l-1-2c-1 6-8 4-5 0l2-2c-6 1-7-6-2-5l3 1c-3-4 0-6 2-1Z"/><circle cx="12" cy="12" r="2"/>',
  bean: '<path d="M13 3c5-1 9 2 8 7-1 6-6 11-12 11-5 0-8-5-5-9 2-3 6-1 7-4 1-2 0-4 2-5Z"/><path d="M7 15c4 1 7-1 8-5"/>',
  count: '<rect x="5" y="5" width="14" height="16" rx="2"/><rect x="9" y="3" width="6" height="4" rx="1"/><path d="M9 12h6m-6 4h6"/>',
  checkout: '<path d="M11 5H5v14h6m2-11 4 4-4 4m4-4H8"/>',
  undo: '<path d="M9 6 4 11l5 5m-5-5h10a5 5 0 0 1 5 5v2"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>'
};

function icon(name) {
  return `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${paths[name]}</svg>`;
}
for (const item of all('[data-icon]')) item.innerHTML = icon(item.dataset.icon);

const entities = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const escape = value => String(value).replace(/[&<>"']/g, character => entities[character]);
const normalize = value => value.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase();
const numeric = new Intl.NumberFormat();
const format = value => numeric.format(value);
const deltaFormat = new Intl.NumberFormat(undefined, { signDisplay: 'exceptZero' });
const dateTime = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });
const dateOnly = new Intl.DateTimeFormat(undefined, { dateStyle: 'long' });
const pack = value => `${format(value)} ${value === 1 ? 'packet' : 'packets'}`;
const pages = { catalog: 'Catalog', activity: 'Activity', shelf: 'Shelf list' };
const types = {
  opening: ['Opening balance', 'layers'],
  checkout: ['Checkout', 'checkout'],
  donation: ['Donation', 'plus'],
  correction: ['Count correction', 'count'],
  undo: ['Undo', 'undo']
};

let data;
let counts;
let byEntry;
let undone;
let selectedId = 1;
let page = 'catalog';
let lowOnly = false;
let activityLot = '';
let editing;
let busy = false;
let toastTimer;

function refreshStorage() {
  const warning = $('#storage-error');
  try {
    data = Inventory.load();
    warning.hidden = true;
    $('#storage-caption').textContent = 'Saved on this device';
  } catch {
    data ??= Inventory.openingState();
    warning.textContent = 'Saved stock could not be loaded. Stock changes require access to this browser’s local storage.';
    warning.hidden = false;
    $('#storage-caption').textContent = 'Storage unavailable';
  }
}

const findLot = id => data.lots.find(lot => lot.id === id);
const isLow = count => count <= Inventory.lowLimit;

function badge(count) {
  const status = count === 0 ? 'Out of stock' : isLow(count) ? 'Low stock' : 'In stock';
  return `<span class="stock${isLow(count) ? ' low' : ''}"><i></i>${status}</span>`;
}

function lotIcon(variety) {
  const value = variety.toLowerCase();
  const name = value.includes('calendula') ? 'flower' : value.includes('bean') ? 'bean' : 'sprout';
  return `<span class="seed-icon ${name}" data-icon>${icon(name)}</span>`;
}

function render() {
  counts = Inventory.balances(data);
  byEntry = new Map(data.entries.map(entry => [entry.id, entry]));
  undone = new Set(data.entries.map(entry => entry.reverses).filter(Boolean));

  const quantities = Array.from(counts.values());
  const total = quantities.reduce((sum, value) => sum + BigInt(value), 0n);
  $('#packet-total').textContent = format(total);
  $('#lot-total').textContent = format(data.lots.length);
  $('#low-total').textContent = format(quantities.filter(isLow).length);

  if (page === 'catalog') renderCatalog();
  if (page === 'activity') renderActivity();
  if (page === 'shelf') renderShelf();
}

function renderCatalog() {
  const tokens = normalize($('#search').value).trim().split(/\s+/).filter(Boolean);
  const matches = data.lots.filter(lot => {
    const haystack = normalize(`${lot.variety} ${lot.code}`);
    return (!lowOnly || isLow(counts.get(lot.id))) && tokens.every(token => haystack.includes(token));
  });
  $('#inventory-rows').innerHTML = matches.map(lot => {
    const count = counts.get(lot.id);
    const active = lot.id === selectedId;
    const name = escape(`${lot.variety}, lot ${lot.code}`);
    return `<tr data-lot="${lot.id}" class="${active ? 'selected' : ''}">
      <td><span class="variety-cell">${lotIcon(lot.variety)}<strong>${escape(lot.variety)}</strong></span></td>
      <td class="lot-code">${escape(lot.code)}</td>
      <td class="number">${format(count)}</td><td>${badge(count)}</td>
      <td><button type="button" class="icon-button" data-select="${lot.id}" aria-label="View ${name}" aria-controls="lot-panel"${active ? ' aria-current="true"' : ''}>${icon('chevron')}</button></td>
    </tr>`;
  }).join('') || '<tr><td colspan="5" class="empty">No matching lots. Try another search or clear the low-stock filter.</td></tr>';
  $('#results-count').textContent = `Showing ${format(matches.length)} of ${format(data.lots.length)} lots`;
  renderLot();
}

function renderLot() {
  const lot = findLot(selectedId);
  if (!lot) return;
  const count = counts.get(lot.id);
  const events = data.entries.filter(entry => entry.lotId === lot.id).slice(-4).reverse();
  $('#lot-panel').innerHTML = `<div class="lot-head">
      <div class="lot-kicker">Selected lot ${badge(count)}</div>
      <h2 id="lot-heading" tabindex="-1">${escape(lot.variety)}</h2><span class="lot-code">${escape(lot.code)}</span>
      <div class="lot-balance"><strong>${format(count)}</strong> ${count === 1 ? 'packet available' : 'packets available'}</div>
      <div class="lot-actions">
        <button type="button" class="button primary" data-entry="checkout"${count === 0 ? ' disabled' : ''}>${icon('checkout')} Checkout</button>
        <button type="button" class="button secondary" data-entry="correction">${icon('count')} Correct count</button>
      </div>
    </div>
    <div class="lot-activity">
      <div class="activity-heading"><h3>Recent activity</h3><button type="button" class="text-button" id="view-lot-activity">View all <span aria-hidden="true">↗</span></button></div>
      ${eventList(events)}
    </div>`;
}

function eventList(entries, includeLot = false) {
  if (!entries.length) return '<p class="empty">No activity for this selection.</p>';
  return `<ol class="events">${entries.map(entry => {
    const [label, symbol] = types[entry.type];
    const lot = findLot(entry.lotId);
    const time = entry.at ? dateTime.format(new Date(entry.at)) : 'Initial inventory';
    const original = byEntry.get(entry.reverses);
    const lotLabel = `${lot.variety} · ${lot.code}`;
    let note = '';
    if (entry.type === 'correction') note = `Counted ${pack(entry.counted)}. ${entry.reason}`;
    if (original) note = `Reversed ${types[original.type][0].toLowerCase()} (${deltaFormat.format(original.delta)}) recorded ${dateTime.format(new Date(original.at))}.`;
    const reversed = undone.has(entry.id);
    const undoButton = !reversed && entry.type !== 'opening' && entry.type !== 'undo';
    return `<li class="event">
      <span data-icon class="event-icon${entry.type === 'undo' ? ' amber' : ''}">${icon(symbol)}</span>
      <div class="event-main">
        <strong>${label}${reversed ? '<span class="event-undone">Undone</span>' : ''}</strong>
        <div class="event-meta">${includeLot ? `${escape(lotLabel)} · ` : ''}${escape(time)}</div>
        ${note ? `<p class="event-note">${escape(note)}</p>` : ''}
      </div>
      <div class="event-value">${deltaFormat.format(entry.delta)}<small>${format(entry.balance)} after</small>
        ${undoButton ? `<button type="button" class="text-button" data-undo="${entry.id}" aria-label="Undo ${label.toLowerCase()} for ${escape(lotLabel)}">Undo</button>` : ''}
      </div>
    </li>`;
  }).join('')}</ol>`;
}

function sortedLots() {
  return [...data.lots].sort((a, b) => a.variety.localeCompare(b.variety) || a.code.localeCompare(b.code, undefined, { numeric: true }));
}

function renderActivity() {
  const select = $('#activity-lot');
  select.innerHTML = '<option value="">All lots</option>' + sortedLots().map(lot =>
    `<option value="${lot.id}">${escape(lot.variety)} · ${escape(lot.code)}</option>`
  ).join('');
  select.value = activityLot;
  const events = data.entries.filter(entry => !activityLot || entry.lotId === Number(activityLot)).reverse();
  $('#activity-list').innerHTML = eventList(events, true);
}

function shelfTable() {
  return `<table class="shelf-table">
    <thead><tr><th scope="col">Variety</th><th scope="col">Lot</th><th scope="col" class="number">Packets</th><th scope="col">Status</th><th scope="col">Counted</th></tr></thead>
    <tbody>${sortedLots().map(lot => {
      const count = counts.get(lot.id);
      const status = count === 0 ? 'Out of stock' : isLow(count) ? 'Low stock' : 'In stock';
      return `<tr><td>${escape(lot.variety)}</td><td>${escape(lot.code)}</td><td class="number">${format(count)}</td><td>${status}</td><td></td></tr>`;
    }).join('')}</tbody></table>`;
}

function renderShelf() {
  $('.shelf-panel').innerHTML = shelfTable();
}

function preparePrint() {
  const stamp = dateOnly.format(new Date());
  $('#print-sheet').innerHTML = `<h1>Seed Library Shelf List</h1><p>${escape(stamp)} · Low stock at 3 packets or fewer</p>${shelfTable()}`;
}

function navigate(next, filter = '') {
  activityLot = filter;
  page = next;
  for (const name of Object.keys(pages)) {
    const current = name === page;
    const control = $(`[data-page="${name}"]`);
    if (current) control.setAttribute('aria-current', 'page');
    else control.removeAttribute('aria-current');
    $(`#${name}-page`).hidden = !current;
  }
  $('#crumb').textContent = pages[page];
  render();
  $('#main').focus();
  window.scrollTo(0, 0);
}

const dialog = $('#entry-dialog');
const fields = $('#entry-fields');
const form = $('#entry-form');
const entryError = $('#entry-error');
const submit = $('#entry-submit');

const quantityField = (label, hint, value = '') => `<div class="field"><label for="field-quantity">${label}</label>
  <input id="field-quantity" name="quantity" type="text" inputmode="numeric" pattern="[0-9]+" required autocomplete="off" maxlength="16" value="${value}" aria-describedby="quantity-hint">
  <small id="quantity-hint">${hint}</small></div>`;

function openEntry(type, lotId, entryId) {
  const lot = findLot(lotId);
  const count = counts.get(lotId);
  editing = { type, lotId, entryId, trigger: document.activeElement };
  let title;
  let context;
  let submitText;
  let content = '';

  if (type === 'donation') {
    title = 'Record donation';
    context = 'Use the packet label to enter the variety and lot code.';
    submitText = 'Save donation';
    const varieties = new Set(sortedLots().map(item => item.variety));
    content = `<div class="field"><label for="field-variety">Variety</label><input id="field-variety" name="variety" maxlength="70" required list="varieties" autocomplete="off">
      <datalist id="varieties">${Array.from(varieties, name => `<option value="${escape(name)}"></option>`).join('')}</datalist></div>
      <div class="field"><label for="field-code">Lot code</label><input id="field-code" name="code" maxlength="35" required list="donation-lots" autocomplete="off"><datalist id="donation-lots"></datalist></div>
      ${quantityField('Packets donated', 'Use a whole number greater than zero.')}`;
  } else {
    context = `${lot.variety} · ${lot.code} · ${pack(count)} available`;
    if (type === 'checkout') {
      title = 'Record checkout';
      submitText = 'Save checkout';
      content = quantityField('Packets taken', `Enter 1 to ${format(count)} packets.`, '1');
    } else if (type === 'correction') {
      title = 'Correct stock count';
      submitText = 'Save correction';
      content = `${quantityField('Packets counted', 'Enter the total you counted on the shelf.')}
        <div class="field"><label for="field-reason">Reason</label><input id="field-reason" name="reason" required maxlength="120" autocomplete="off" placeholder="e.g. Two damaged packets removed"></div>`;
    } else {
      const original = byEntry.get(entryId);
      title = 'Undo entry';
      submitText = 'Undo entry';
      content = `<p>Reverse this ${types[original.type][0].toLowerCase()} (${deltaFormat.format(original.delta)}). The original and the reversal will both appear in the activity history.</p>`;
    }
  }
  $('#entry-title').textContent = title;
  $('#entry-context').textContent = context;
  submit.textContent = submitText;
  fields.innerHTML = content;
  entryError.hidden = true;
  dialog.showModal();
  const initial = $('input', fields) ?? $('[data-close]', form);
  initial.focus();
  if (type === 'checkout') initial.select();
}

function suggestLots(event) {
  if (event.target.name !== 'variety') return;
  const value = event.target.value.trim().toLowerCase();
  $('#donation-lots').innerHTML = sortedLots().filter(lot => lot.variety.toLowerCase() === value)
    .map(lot => `<option value="${escape(lot.code)}"></option>`).join('');
}

function toast(message) {
  const target = $('#toast');
  clearTimeout(toastTimer);
  target.hidden = false;
  target.textContent = message;
  toastTimer = setTimeout(() => { target.hidden = true; }, 5000);
}

form.addEventListener('input', event => {
  event.target.removeAttribute('aria-invalid');
  entryError.hidden = true;
  suggestLots(event);
});
form.addEventListener('submit', async event => {
  event.preventDefault();
  if (busy || !editing) return;
  busy = true;
  submit.disabled = true;
  entryError.hidden = true;
  const operation = editing;
  let saved;
  try {
    saved = await Inventory.save({ ...Object.fromEntries(new FormData(form)), ...operation });
  } catch (error) {
    entryError.textContent = error instanceof Inventory.EntryError
      ? error.message : 'This change could not be saved. Check that browser storage is available and try again.';
    entryError.hidden = false;
    const field = error.field ? $(`#field-${error.field}`) : null;
    if (field) {
      field.setAttribute('aria-invalid', 'true');
      field.focus();
    }
  } finally {
    busy = false;
    submit.disabled = false;
  }
  if (!saved) return;

  data = saved.data;
  selectedId = saved.entry.lotId;
  $('#storage-error').hidden = true;
  $('#storage-caption').textContent = 'Saved on this device';
  if (page === 'catalog' && operation.type === 'donation') {
    $('#search').value = '';
    lowOnly = false;
    $('#low-filter').setAttribute('aria-pressed', 'false');
  }
  dialog.close();
  render();
  const lot = findLot(selectedId);
  toast(`${types[saved.entry.type][0]} saved. ${lot.variety} (${lot.code}) has ${pack(saved.entry.balance)} available.`);
  if (operation.trigger?.isConnected) operation.trigger.focus();
  else if (page === 'catalog') $('#lot-heading').focus();
  else $('#main').focus();
});
dialog.addEventListener('cancel', event => { if (busy) event.preventDefault(); });
dialog.addEventListener('close', () => { editing = null; });

document.addEventListener('click', event => {
  const control = event.target.closest('button');
  const row = event.target.closest('[data-lot]');
  if (row) {
    selectedId = Number(row.dataset.lot);
    renderCatalog();
    if (window.matchMedia('(max-width: 1000px)').matches) {
      $('#lot-heading').focus();
    } else {
      $(`[data-select="${selectedId}"]`).focus({ preventScroll: true });
    }
  }
  if (!control) return;
  if (control.dataset.page) navigate(control.dataset.page);
  if (control.dataset.entry) openEntry(control.dataset.entry, selectedId);
  if (control.dataset.undo) {
    const entry = byEntry.get(Number(control.dataset.undo));
    openEntry('undo', entry.lotId, entry.id);
  }
  if (control.hasAttribute('data-close') && !busy) dialog.close();
  if (control.id === 'donate') openEntry('donation');
  if (control.id === 'view-lot-activity') navigate('activity', String(selectedId));
  if (control.id === 'low-filter') {
    lowOnly = !lowOnly;
    control.setAttribute('aria-pressed', String(lowOnly));
    renderCatalog();
  }
  if (control.id === 'print') {
    preparePrint();
    window.print();
  }
});

$('#search').addEventListener('input', renderCatalog);
$('#activity-lot').addEventListener('change', event => {
  activityLot = event.target.value;
  renderActivity();
});
document.addEventListener('keydown', event => {
  if (event.key === '/' && page === 'catalog' && !dialog.open && !event.altKey && !event.ctrlKey && !event.metaKey &&
      !event.target.closest('input, textarea, select, [contenteditable]')) {
    event.preventDefault();
    $('#search').focus();
  }
});
window.addEventListener('beforeprint', preparePrint);
window.addEventListener('storage', event => {
  if (event.key === Inventory.key || event.key === null) {
    refreshStorage();
    render();
  }
});

refreshStorage();
render();
