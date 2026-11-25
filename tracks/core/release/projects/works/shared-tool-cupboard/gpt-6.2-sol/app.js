'use strict';

const { items, localDay, addDays, remaining, availability } = Ledger;
const key = 'shared-cupboard-ledger-v1';
const names = { overview: 'Overview', loans: 'Current loans', reservations: 'Reservations', availability: 'Availability' };
const fullDate = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
const todayDate = new Intl.DateTimeFormat(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
const view = document.querySelector('#view');
const dialog = document.querySelector('#dialog');
const form = document.querySelector('#record-form');
const storageAlert = document.querySelector('#storage-alert');
let state;
let page;
let today = localDay();
let range = { start: today, end: addDays(today, 7) };
let editing;
let toastTimer;

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}

function date(day) {
  return fullDate.format(new Date(day + 'T12:00:00'));
}

function icon(name) {
  return `<canvas class="icon" data-icon="${name}" width="20" height="20" aria-hidden="true"></canvas>`;
}

function itemLabel(id) {
  const item = items.find(entry => entry.id === id);
  return item.capacity === 1 ? `${item.name} · ${item.id}` : item.name;
}

function load() {
  const raw = localStorage.getItem(key);
  if (raw === null) return { loans: [], reservations: [] };
  const stored = JSON.parse(raw);
  if (!Array.isArray(stored.loans) || !Array.isArray(stored.reservations)) {
    throw new Error('The saved ledger could not be read.');
  }
  return stored;
}

function refreshState() {
  try {
    state = load();
    storageAlert.hidden = true;
  } catch {
    state = null;
    storageAlert.textContent = 'The saved ledger could not be opened. Use the browser profile and file location normally used for the cupboard.';
    storageAlert.hidden = false;
  }
}

function currentLoans() {
  return state.loans.filter(loan => remaining(loan) > 0)
    .sort((a, b) => a.end.localeCompare(b.end) || a.start.localeCompare(b.start));
}

function activeReservations() {
  return state.reservations.filter(booking => booking.end >= today)
    .sort((a, b) => a.start.localeCompare(b.start));
}

function badge(text, tone) {
  return `<span class="badge ${tone}"><span></span>${text}</span>`;
}

function loanStatus(loan) {
  if (loan.end < today) return badge('Overdue', 'alarm');
  if (loan.end === today) return badge('Due today', 'warm');
  return badge('On loan', 'neutral');
}

function button(label, action, style = '', symbol = '') {
  return `<button type="button" class="button ${style}" data-action="${action}">${symbol ? icon(symbol) : ''}${label}</button>`;
}

function empty(symbol, title, message) {
  return `<div class="empty"><span class="empty-icon">${icon(symbol)}</span><div><strong>${title}</strong><p>${message}</p></div></div>`;
}

function heading(title, subtitle, actions = '') {
  return `<header class="page-heading"><div><h1>${title}</h1><p>${subtitle}</p></div>
    ${actions ? `<div class="actions">${actions}</div>` : ''}</header>`;
}

function inventoryCard(item) {
  const { free, peak } = availability(state, item.id, today, today, today);
  const tagged = item.capacity === 1;
  const status = tagged
    ? (free ? 'Available' : peak.blockers.some(span => span.kind === 'loan') ? 'On loan' : 'Reserved')
    : `${free} of ${item.capacity} available`;
  return `<article class="inventory-card">
    <div class="inventory-art ${item.art}"><canvas data-art="${item.art}" width="64" height="60" aria-hidden="true"></canvas></div>
    <div class="inventory-label"><span class="item-tag">${tagged ? item.id : 'By quantity'}</span><h3>${item.name}</h3></div>
    ${badge(status, free ? 'good' : 'warm')}
  </article>`;
}

function loanRows(loans, print = false) {
  return loans.map(loan => `<tr>
    <td data-label="Item"><strong>${itemLabel(loan.item)}</strong></td>
    <td data-label="Household">${escapeHtml(loan.household)}</td>
    <td data-label="Out">${remaining(loan)}${!print && loan.returned ? ` <small>of ${loan.quantity}</small>` : ''}</td>
    <td data-label="Checked out">${date(loan.start)}</td>
    <td data-label="Expected back">${date(loan.end)}</td>
    <td data-label="Status">${print ? (loan.end < today ? 'OVERDUE' : loan.end === today ? 'Due today' : 'On loan') : loanStatus(loan)}</td>
    ${print ? '' : `<td data-label="Action"><button type="button" class="button compact" data-action="return" data-id="${loan.id}" aria-label="Record return for ${escapeHtml(loan.household)} · ${itemLabel(loan.item)}">Return</button></td>`}
  </tr>`).join('');
}

function loanTable(loans, print = false) {
  return `<table aria-label="Current loans"><thead><tr><th scope="col">Item</th><th scope="col">Household</th><th scope="col">Out</th><th scope="col">Checked out</th><th scope="col">Expected back</th><th scope="col">Status</th>${print ? '' : '<th scope="col">Action</th>'}</tr></thead>
    <tbody>${loanRows(loans, print)}</tbody></table>`;
}

function overview() {
  const loans = currentLoans();
  const bookings = activeReservations();
  return `<section class="hero">
    <div class="hero-copy"><h1>Shared Cupboard</h1>
      <p>Check items out, record returns, and set things aside for your neighbors.</p>
      <div class="actions">${button('New checkout', 'checkout', 'primary', 'plus')}${button('New reservation', 'reserve', 'on-dark', 'calendar')}</div>
    </div>
    <div class="hero-art" aria-hidden="true"><canvas data-art="shelf" width="364" height="220"></canvas></div>
  </section>
  <section class="inventory"><div class="section-head"><div><h2>Today’s inventory</h2><p>Availability for pickup today</p></div>
    <a class="text-link" href="#availability">Check a date range ${icon('arrow')}</a></div>
    <div class="inventory-grid">${items.map(inventoryCard).join('')}</div>
  </section>
  <div class="dashboard-grid">
    <section class="panel"><div class="panel-head"><h2>Current loans <span class="count">${loans.length}</span></h2>${button('Print sheet', 'print', 'compact', 'print')}</div>
      ${loans.length ? `<ul class="mini-list">${loans.slice(0, 4).map(loan =>
        `<li><div><strong>${itemLabel(loan.item)}${loan.item === 'cords' ? ` × ${remaining(loan)}` : ''}</strong><small>${escapeHtml(loan.household)} · Due ${date(loan.end)}</small></div>${loanStatus(loan)}</li>`).join('')}</ul>
        <a class="text-link panel-link" href="#loans">Manage current loans ${icon('arrow')}</a>`
      : empty('loan', 'Nothing on loan', 'Checkouts will appear here until they are returned.')}</section>
    <section class="panel"><div class="panel-head"><h2>Reservations <span class="count">${bookings.length}</span></h2>
      <a class="text-link" href="#reservations">View all ${icon('arrow')}</a></div>
      ${bookings.length ? `<ul class="mini-list">${bookings.slice(0, 3).map(booking =>
        `<li><div><strong>${itemLabel(booking.item)}${booking.item === 'cords' ? ` × ${booking.quantity}` : ''}</strong><small>${escapeHtml(booking.household)} · ${date(booking.start)} – ${date(booking.end)}</small></div></li>`).join('')}</ul>`
      : empty('calendar', 'No reservations yet', 'Upcoming reservations will appear here.')}</section>
  </div>`;
}

function loansPage() {
  const loans = currentLoans();
  return heading('Current loans', 'Record returns and follow up on overdue items.',
    button('Print sheet', 'print', '', 'print') + button('New checkout', 'checkout', 'primary', 'plus')) +
    `<section class="panel table-panel">${loans.length ? loanTable(loans) :
      empty('loan', 'Nothing on loan', 'Use New checkout to record a household borrowing an item.')}</section>`;
}

function reservationsPage() {
  const bookings = activeReservations();
  return heading('Reservations', 'Manage upcoming bookings and check items out at pickup.',
    button('New reservation', 'reserve', 'primary', 'plus')) +
    `<section class="panel table-panel">${bookings.length ? `<table aria-label="Reservations"><thead><tr><th scope="col">Item</th><th scope="col">Household</th>
      <th scope="col">Quantity</th><th scope="col">From</th><th scope="col">Through</th><th scope="col">Action</th></tr></thead><tbody>
      ${bookings.map(booking => `<tr><td data-label="Item"><strong>${itemLabel(booking.item)}</strong></td><td data-label="Household">${escapeHtml(booking.household)}</td>
      <td data-label="Quantity">${booking.quantity}</td><td data-label="From">${date(booking.start)}</td><td data-label="Through">${date(booking.end)}</td>
      <td data-label="Action"><div class="row-actions">${booking.start <= today ? `<button type="button" class="button compact" data-action="pickup" data-id="${booking.id}">Check out</button>` : ''}
      <button type="button" class="button compact" data-action="cancel-booking" data-id="${booking.id}" aria-label="Cancel reservation for ${escapeHtml(booking.household)} · ${itemLabel(booking.item)}">Cancel</button></div></td></tr>`).join('')}
      </tbody></table>` : empty('calendar', 'No reservations yet', 'Use New reservation to hold an item for a date range.')}</section>`;
}

function spanText(span) {
  const household = escapeHtml(span.household);
  if (span.kind === 'reservation') {
    return `${household} · ${span.quantity} reserved · ${date(span.start)} – ${date(span.end)}`;
  }
  return `${household} · ${span.quantity} on loan · ${span.end === null
    ? `overdue · due ${date(span.due)} · held until returned`
    : `due ${date(span.due)}`}`;
}

function availabilityResults() {
  return `<div class="section-head"><div><h2>Available for the full range</h2><p>${date(range.start)} – ${date(range.end)}</p></div></div>
    <div class="availability-list">${items.map(item => {
      const result = availability(state, item.id, range.start, range.end, today);
      return `<article class="panel availability-item">
        <div class="availability-title"><div class="inventory-art ${item.art}"><canvas data-art="${item.art}" width="64" height="60" aria-hidden="true"></canvas></div>
        <div><span class="item-tag">${item.capacity === 1 ? item.id : 'By quantity'}</span><h3>${item.name}</h3></div></div>
        ${badge(item.capacity === 1 ? (result.free ? 'Available' : 'Unavailable') :
          `${result.free} of ${item.capacity} available`, result.free ? 'good' : 'warm')}
        ${result.free && range.start > today ? `<button type="button" class="button compact" data-action="reserve-range" data-item="${item.id}">Reserve</button>` : ''}
        ${result.spans.length ? `<details><summary>View overlapping commitments</summary><ul>${result.spans.map(span => `<li>${spanText(span)}</li>`).join('')}</ul></details>` : ''}
      </article>`;
    }).join('')}</div>`;
}

function availabilityPage() {
  return heading('Availability', 'Find out what a household can borrow across a date range.',
    button('New reservation', 'reserve', 'primary', 'plus')) +
    `<form id="range-form" class="panel range-form">
      <label>From<input type="date" name="start" value="${range.start}" min="${today}" max="9999-12-31" required></label>
      <label>Through<input type="date" name="end" value="${range.end}" min="${range.start}" max="9999-12-31" required></label>
      <button type="submit" class="button dark">${icon('search')}Check availability</button>
      <p>Both dates count. Overdue items are held until returned.</p>
    </form>
    <section id="range-results" class="range-results" aria-live="polite">${availabilityResults()}</section>`;
}

function renderPrint() {
  const loans = state ? currentLoans() : [];
  document.querySelector('#print-sheet').innerHTML = `<h1>Shared Cupboard · Current loans</h1>
    <p>As of ${date(today)}</p>${state ? (loans.length ? loanTable(loans, true) : '<p>No items are currently on loan.</p>') : '<p>The saved ledger could not be opened.</p>'}`;
}

function render() {
  today = localDay();
  if (range.start < today) {
    range = { start: today, end: range.end < today ? addDays(today, 7) : range.end };
  }
  const target = location.hash.slice(1);
  const requested = Object.hasOwn(names, target) ? target : (target === 'main' && page ? page : 'overview');
  const changed = page && page !== requested;
  page = requested;
  document.querySelector('#section-name').textContent = names[page];
  document.querySelector('#today').innerHTML = icon('calendar') + todayDate.format(new Date());
  for (const link of document.querySelectorAll('nav a')) {
    if (link.hash === '#' + page) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }
  view.innerHTML = state ? { overview, loans: loansPage, reservations: reservationsPage, availability: availabilityPage }[page]() : '';
  renderPrint();
  paintArt(document);
  if (changed) {
    document.querySelector('#main').focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }
}

function showToast(message) {
  const toast = document.querySelector('#toast');
  toast.textContent = message;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.textContent = ''; }, 4200);
}

function dateField(label, name, value, limits = '') {
  return `<label>${label}<input type="date" name="${name}" value="${value}" ${limits} required></label>`;
}

function openEditor(mode, record, item) {
  today = localDay();
  editing = { mode, id: record?.id };
  const tomorrow = addDays(today, 1);
  let title;
  let message;
  let fields = '';
  let submit;
  if (mode === 'checkout' || mode === 'reserve') {
    const booking = mode === 'reserve';
    const start = booking ? (item ? range.start : tomorrow) : today;
    const end = booking && item ? range.end : start;
    title = booking ? 'New reservation' : 'New checkout';
    message = booking ? 'Both dates are included in the reservation.' : 'Use a short household label, such as 4B.';
    submit = booking ? 'Save reservation' : 'Save checkout';
    fields = `<label>Household label<input name="household" maxlength="24" placeholder="e.g. 4B" required autofocus></label>
      <div class="field-row"><label>Item<select name="item">${items.map(entry =>
        `<option value="${entry.id}" ${item === entry.id ? 'selected' : ''}>${itemLabel(entry.id)}</option>`).join('')}</select></label>
      <label id="quantity-field" hidden>Quantity<input type="number" name="quantity" value="1" min="1" max="3" step="1" required></label></div>
      <div class="field-row">${dateField(booking ? 'From' : 'Checkout date', 'start', start, booking ? `min="${tomorrow}" max="9999-12-31"` : `max="${today}"`)}
      ${dateField(booking ? 'Through' : 'Expected return date', 'end', end, `min="${start}" max="9999-12-31"`)}</div>`;
  } else {
    const summary = `${itemLabel(record.item)} · ${escapeHtml(record.household)}`;
    if (mode === 'return') {
      const out = remaining(record);
      title = 'Record return';
      message = `${summary} · ${out} currently out`;
      submit = 'Save return';
      if (record.item === 'cords') {
        fields = `<label>Quantity returned<input type="number" name="quantity" min="1" max="${out}" value="${out}" step="1" required autofocus></label>`;
      }
    } else if (mode === 'pickup') {
      title = 'Check out reservation';
      message = `${summary} · Quantity ${record.quantity} · Expected back ${date(record.end)}`;
      submit = 'Confirm checkout';
    } else {
      title = 'Cancel reservation';
      message = `${summary} · ${date(record.start)} – ${date(record.end)}`;
      submit = 'Cancel reservation';
    }
  }

  document.querySelector('#dialog-content').innerHTML = `
    <header class="dialog-head"><h2 id="dialog-title">${title}</h2>
      <button type="button" class="icon-button" data-action="close-dialog" aria-label="Close">${icon('close')}</button></header>
    <p class="dialog-message">${message}</p>
    <div class="fields">${fields}</div>
    <div id="form-error" class="error" role="alert" tabindex="-1" hidden></div>
    <footer class="dialog-actions">${button(mode === 'cancel-booking' ? 'Keep reservation' : 'Cancel', 'close-dialog')}
      <button type="submit" class="button primary">${submit}</button></footer>`;
  syncQuantity();
  dialog.showModal();
  paintArt(dialog);
}

function syncQuantity() {
  const field = form.querySelector('#quantity-field');
  if (!field) return;
  const pooled = form.elements.namedItem('item').value === 'cords';
  field.hidden = !pooled;
  field.querySelector('input').disabled = !pooled;
}

function conflictError(result, item, quantity) {
  const { free, peak } = result;
  return {
    html: `<strong>${itemLabel(item)} · ${quantity} requested, ${free} available on ${date(peak.day)}.</strong>
      <ul>${peak.blockers.map(span => `<li>${spanText(span)}</li>`).join('')}</ul>`,
  };
}

function recordChange(fresh, data, action) {
  const day = localDay();
  const { mode, id } = action;
  if (mode === 'return') {
    const loan = fresh.loans.find(entry => entry.id === id && remaining(entry) > 0);
    if (!loan) throw new Error('This loan has already been returned.');
    const quantity = Number(data.get('quantity') || 1);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > remaining(loan)) {
      throw new Error(`Enter a quantity from 1 to ${remaining(loan)}.`);
    }
    loan.returned += quantity;
    return remaining(loan) ? `Return saved. ${remaining(loan)} still out.` : 'Return saved. Loan closed.';
  }

  const booking = fresh.reservations.find(entry => entry.id === id);
  if (mode === 'cancel-booking') {
    if (!booking) throw new Error('This reservation is no longer on the schedule.');
    fresh.reservations = fresh.reservations.filter(entry => entry.id !== id);
    return 'Reservation canceled.';
  }
  const pickup = mode === 'pickup';
  const reserve = mode === 'reserve';
  if (pickup && (!booking || day < booking.start || day > booking.end)) {
    throw new Error('Pickup is available during the reservation dates.');
  }

  const item = pickup ? booking.item : data.get('item');
  const household = pickup ? booking.household : data.get('household').trim();
  const start = pickup ? day : data.get('start');
  const end = pickup ? booking.end : data.get('end');
  const quantity = pickup ? booking.quantity : item === 'cords' ? Number(data.get('quantity')) : 1;
  const capacity = items.find(entry => entry.id === item)?.capacity;
  if (!household || household.length > 24) throw new Error('Enter a household label of 1 to 24 characters.');
  if (!capacity || !Number.isInteger(quantity) || quantity < 1 || quantity > capacity) {
    throw new Error('Choose an item and a valid quantity.');
  }
  if (!start || !end || end < start) throw new Error('Choose an end date on or after the start date.');
  if (reserve && start <= day) throw new Error('Choose a reservation start date after today.');
  if (!reserve && start > day) throw new Error('Choose a checkout date of today or earlier.');

  const result = availability(fresh, item, reserve ? start : day, end < day ? null : end, day, pickup ? id : undefined);
  if (quantity > result.free) throw conflictError(result, item, quantity);

  const entry = { id: crypto.randomUUID(), item, household, quantity, start, end };
  if (reserve) {
    fresh.reservations.push(entry);
    return 'Reservation saved.';
  }
  fresh.loans.push({ ...entry, returned: 0 });
  if (pickup) fresh.reservations = fresh.reservations.filter(entry => entry.id !== id);
  return 'Checkout saved.';
}

form.addEventListener('submit', async event => {
  event.preventDefault();
  const submit = form.querySelector('[type="submit"]');
  const errorBox = form.querySelector('#form-error');
  const data = new FormData(form);
  const action = editing;
  submit.disabled = true;
  try {
    const save = () => {
      const fresh = load();
      const result = recordChange(fresh, data, action);
      localStorage.setItem(key, JSON.stringify(fresh));
      state = fresh;
      return result;
    };
    const result = navigator.locks ? await navigator.locks.request(key, save) : save();
    dialog.close();
    render();
    if (document.activeElement === document.body) document.querySelector('#main').focus({ preventScroll: true });
    showToast(result);
  } catch (error) {
    if (error.html) errorBox.innerHTML = error.html;
    else errorBox.textContent = ['QuotaExceededError', 'SecurityError'].includes(error.name)
      ? 'Could not save in this browser. Check that local storage is allowed and try again.'
      : error.message || 'Could not save the change.';
    errorBox.hidden = false;
    errorBox.focus();
  } finally {
    submit.disabled = false;
  }
});

document.addEventListener('change', event => {
  const target = event.target;
  if (target.form === form && target.name === 'item') syncQuantity();
  if ((target.form === form || target.form?.id === 'range-form') && target.name === 'start') {
    const end = target.form.elements.end;
    end.min = target.value;
    if (end.value < target.value) end.value = target.value;
  }
});

view.addEventListener('submit', event => {
  if (event.target.id !== 'range-form') return;
  event.preventDefault();
  const data = new FormData(event.target);
  range = { start: data.get('start'), end: data.get('end') };
  const results = document.querySelector('#range-results');
  results.innerHTML = availabilityResults();
  paintArt(results);
});

document.addEventListener('click', event => {
  const target = event.target.closest('[data-action]');
  if (!target) return;
  const { action, id, item } = target.dataset;
  if (action === 'close-dialog') { dialog.close(); return; }
  if (action === 'print') { window.print(); return; }
  refreshState();
  if (!state) { render(); return; }
  if (action === 'checkout' || action === 'reserve') openEditor(action);
  if (action === 'reserve-range') {
    if (range.start > localDay()) openEditor('reserve', null, item);
    else { render(); showToast('Choose a start date after today.'); }
  }
  if (action === 'return' || action === 'pickup' || action === 'cancel-booking') {
    const record = action === 'return'
      ? state.loans.find(entry => entry.id === id && remaining(entry) > 0)
      : state.reservations.find(entry => entry.id === id);
    if (record) openEditor(action, record);
    else { render(); showToast('The ledger has changed.'); }
  }
});

window.addEventListener('hashchange', render);
window.addEventListener('storage', event => {
  if (event.key === key || event.key === null) { refreshState(); render(); }
});
window.addEventListener('focus', () => {
  if (!dialog.open && localDay() !== today) { refreshState(); render(); }
});
window.addEventListener('beforeprint', () => {
  today = localDay();
  refreshState();
  renderPrint();
});
setInterval(() => {
  if (!dialog.open && localDay() !== today) { refreshState(); render(); }
}, 30000);

refreshState();
render();
