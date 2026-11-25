'use strict'

const rooms = [
  { id: 'workshop', name: 'Workshop room', capacity: 18, icon: 'workshop' },
  { id: 'gallery', name: 'Gallery', capacity: 24, icon: 'gallery' },
  { id: 'courtyard', name: 'Courtyard', capacity: 30, icon: 'courtyard' },
]
const duration = 30
const lastStart = 1440 - duration
const storageKey = 'museum-education-arrivals.v1'
const sample = [
  { id: 'school', name: 'School group', arrival: '10:00', size: 28, parts: [
    { id: 'school-a', name: 'School A', size: 14, slot: { start: '10:00', room: 'workshop' } },
    { id: 'school-b', name: 'School B', size: 14, slot: { start: '10:00', room: 'gallery' } },
  ] },
  { id: 'club', name: 'Club', arrival: '10:30', size: 14, parts: [
    { id: 'club-a', name: 'Club', size: 14, slot: { start: '10:30', room: 'courtyard' } },
  ] },
  { id: 'family', name: 'Family group', arrival: '11:00', size: 9, parts: [
    { id: 'family-a', name: 'Family group', size: 9, slot: { start: '11:00', room: 'workshop' } },
  ] },
]

const icons = {
  museum: '<path d="M3 9h18L12 4 3 9Zm2 11h14M7 10v7m5-7v7m5-7v7M4 17h16"/>',
  printer: '<path d="M6 9V3h12v6M6 18H4a1 1 0 0 1-1-1v-6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6a1 1 0 0 1-1 1h-2M6 14h12v7H6zm11-2h1"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  edit: '<path d="m14 6 4 4M4 20l4-.8L20 7.1 16.9 4 4.8 16z"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  people: '<circle cx="9" cy="8" r="3"/><path d="M3 20v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2m1-15a3 3 0 0 1 0 6m5 9v-2a4 4 0 0 0-4-4"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  check: '<circle cx="12" cy="12" r="9"/><path d="m8 12 2.5 2.5L16 9"/>',
  warning: '<path d="M10.6 4.5 3 18a1.2 1.2 0 0 0 1.1 1.8h15.8A1.2 1.2 0 0 0 21 18L13.4 4.5a1.6 1.6 0 0 0-2.8 0ZM12 9v4m0 3v.1"/>',
  workshop: '<path d="M4 9h16v5H4zm2 5v6m12-6v6M8 6h8"/>',
  gallery: '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="m5 16 5-5 4 4 2-2 4 4m-5-9h.1"/>',
  courtyard: '<path d="M4 20h16M12 20V9m0 5c-4 0-7-3-7-7 4 0 7 2 7 7Zm0 2c4 0 7-3 7-7-4 0-7 2-7 7Z"/>',
}
const byId = id => document.getElementById(id)
const escapeText = value => String(value).replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[char])
const svg = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]}</svg>`
const icon = name => `<span data-icon="${name}">${svg(name)}</span>`
const minutes = time => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5))
const clock = value => `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`
const endTime = start => clock(minutes(start) + duration)
const count = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`
const roomFor = id => rooms.find(room => room.id === id)
const newId = () => Array.from(crypto.getRandomValues(new Uint32Array(2)), n => n.toString(36)).join('-')
const sortGroups = (a, b) => a.arrival.localeCompare(b.arrival) || a.name.localeCompare(b.name)
const sortSlots = (a, b) => a.part.slot.start.localeCompare(b.part.slot.start)
  || a.room.name.localeCompare(b.room.name) || a.part.name.localeCompare(b.part.name)

let initialStatus = 'Offline planner'
let groups
try {
  const saved = localStorage.getItem(storageKey)
  groups = saved ? JSON.parse(saved) : structuredClone(sample)
  if (saved) initialStatus = 'Saved on this device'
} catch {
  groups = structuredClone(sample)
  initialStatus = 'Local save unavailable'
}

function saveStatus(message, warn = false) {
  byId('save-status').innerHTML = `${icon(warn ? 'warning' : 'check')}${escapeText(message)}`
}

function save() {
  try {
    localStorage.setItem(storageKey, JSON.stringify(groups))
    saveStatus('Saved on this device')
  } catch {
    saveStatus('Changes saved for this session only', true)
  }
}

function inspectPlan(bookings) {
  const entries = bookings.flatMap(group => group.parts.map(part => ({
    group, part, room: part.slot ? roomFor(part.slot.room) : null, flags: new Set(),
  })))
  const assigned = entries.filter(entry => entry.room).sort(sortSlots)
  const unassigned = entries.filter(entry => !entry.room)
  const issues = []
  for (const entry of assigned) {
    const { group, part, room, flags } = entry
    if (part.size > room.capacity) {
      flags.add('Over capacity')
      issues.push(`${part.name} has ${part.size} visitors. ${room.name} holds ${room.capacity}.`)
    }
    if (part.slot.start < group.arrival) {
      flags.add('Before arrival')
      issues.push(`${part.name} starts at ${part.slot.start}, before ${group.name} arrives at ${group.arrival}.`)
    }
  }
  for (const [index, first] of assigned.entries()) {
    const firstStart = minutes(first.part.slot.start)
    for (let next = index + 1; next < assigned.length; next++) {
      const second = assigned[next]
      const secondStart = minutes(second.part.slot.start)
      if (secondStart >= firstStart + duration) break
      if (first.room !== second.room) continue
      first.flags.add('Overlap')
      second.flags.add('Overlap')
      issues.push(`${first.part.name} and ${second.part.name} overlap in ${first.room.name} from ${clock(secondStart)} to ${clock(firstStart + duration)}.`)
    }
  }
  return { entries, assigned, unassigned, issues }
}

function renderOverview(plan) {
  const people = groups.reduce((total, group) => total + group.size, 0)
  const metrics = [
    ['people', count(people, 'visitor'), `Across ${count(groups.length, 'booking')}`],
    ['clock', `${plan.assigned.length} / ${plan.entries.length} assigned`, plan.unassigned.length ? `${count(plan.unassigned.length, 'subgroup')} to place` : 'Subgroups placed'],
    [plan.issues.length ? 'warning' : 'check', count(plan.issues.length, 'conflict'), plan.issues.length ? 'Review the schedule' : 'Capacity, timing & overlaps'],
  ]
  byId('overview').innerHTML = metrics.map(([symbol, title, detail]) => `
    <div class="metric ${symbol === 'warning' ? 'has-warnings' : ''}">
      <span class="metric-icon" data-icon="${symbol}">${svg(symbol)}</span>
      <div><strong>${title}</strong><small>${detail}</small></div>
    </div>`).join('')
}

function renderArrivals(plan) {
  const entries = new Map(plan.entries.map(entry => [entry.part.id, entry]))
  byId('arrivals-list').innerHTML = [...groups].sort(sortGroups).map(group => `
    <article class="booking">
      <div class="booking-head">
        <time class="arrival-time">${group.arrival}</time>
        <div><h3>${escapeText(group.name)}</h3><p>${count(group.size, 'visitor')} · ${count(group.parts.length, 'subgroup')}</p></div>
        <button type="button" class="icon-button" data-booking="${group.id}" aria-label="Edit ${escapeText(group.name)}" title="Edit booking">${icon('edit')}</button>
      </div>
      <ul class="subgroups">${group.parts.map(part => {
        const entry = entries.get(part.id)
        const detail = part.slot ? `${part.slot.start} · ${count(part.size, 'visitor')}` : `${count(part.size, 'visitor')} · To assign`
        return `<li><span>${escapeText(part.name)}</span><span class="${entry.flags.size ? 'problem' : ''}">${detail}</span></li>`
      }).join('')}</ul>
    </article>`).join('') || '<p class="empty">Add a group to start a schedule.</p>'
}

function boardTimes(plan) {
  const first = [...groups].sort(sortGroups)[0]
  const anchor = first ? Math.min(lastStart, Math.floor(minutes(first.arrival) / duration) * duration) : 600
  return [...new Set([
    ...[0, 1, 2, 3].map(index => anchor + index * duration).filter(value => value <= lastStart).map(clock),
    ...groups.map(group => group.arrival).filter(time => minutes(time) <= lastStart),
    ...plan.assigned.map(({ part }) => part.slot.start),
  ])].sort()
}

function renderBoard(plan) {
  const cells = new Map()
  for (const entry of plan.assigned) {
    const key = `${entry.part.slot.start}/${entry.room.id}`
    if (!cells.has(key)) cells.set(key, [])
    cells.get(key).push(entry)
  }
  byId('board').innerHTML = `
    <table class="board" aria-label="Activity assignments by start time and room">
      <thead><tr><th scope="col">Time slot</th>${rooms.map(room => `
        <th scope="col"><span class="room-title">${icon(room.icon)}${room.name}</span><span class="room-limit">Up to ${room.capacity}</span></th>`).join('')}</tr></thead>
      <tbody>${boardTimes(plan).map(time => `
        <tr><th scope="row"><span class="slot-time">${time}</span><span class="time-range">to ${endTime(time)}</span></th>
        ${rooms.map(room => {
          const entries = cells.get(`${time}/${room.id}`)
          return `<td><div class="cell">${entries
            ? entries.map(({ part, flags }) => `
              <button type="button" class="assignment ${room.id} ${flags.size ? 'issue' : ''}" data-part="${part.id}" aria-label="Edit slot for ${escapeText(part.name)}, ${room.name} at ${time}${flags.size ? `, ${[...flags].join(', ')}` : ''}">
                <strong>${escapeText(part.name)}</strong><small>${count(part.size, 'visitor')}</small>
                ${flags.size ? `<small class="issue-label">${[...flags].join(' · ')}</small>` : ''}
              </button>`).join('')
            : `<button type="button" class="open-slot" data-time="${time}" data-room="${room.id}" aria-label="Assign ${room.name} at ${time}" title="Assign ${room.name} at ${time}">${icon('plus')}</button>`
          }</div></td>`
        }).join('')}</tr>`).join('')}</tbody>
    </table>`
}

function issueItems(issues) {
  return `<ul>${issues.map(issue => `<li>${escapeText(issue)}</li>`).join('')}</ul>`
}

function renderChecks(plan) {
  const { issues, unassigned } = plan
  let title = 'All assigned subgroups fit their spaces and start on time.'
  if (issues.length) title = `${count(issues.length, 'conflict')} to review`
  else if (unassigned.length) title = `${count(unassigned.length, 'subgroup')} still to assign.`
  else if (!plan.assigned.length) title = 'Capacity and timing checks appear with your assignments.'
  byId('checks').innerHTML = `
    <div class="checks ${issues.length ? 'problem' : ''}">
      ${icon(issues.length ? 'warning' : unassigned.length ? 'clock' : 'check')}
      <div><strong>${title}</strong>${issues.length ? issueItems(issues) : ''}</div>
    </div>`
}

function renderPrint(plan) {
  const routeRows = plan.assigned.map(({ group, part, room, flags }) => `
    <tr>
      <td class="time-range">${part.slot.start}–${endTime(part.slot.start)}</td>
      <td><strong>${escapeText(part.name)}</strong>${part.name === group.name ? '' : `<br>${escapeText(group.name)}`}</td>
      <td>${group.arrival}</td><td>${room.name}${flags.size ? `<br><strong>${[...flags].join(', ')}</strong>` : ''}</td><td>${part.size}</td>
    </tr>`).join('')
  const needsReview = plan.issues.length || plan.unassigned.length || !plan.assigned.length
  byId('print-sheet').innerHTML = `
    <header class="print-head"><h1>Front-desk schedule</h1><p>Museum Education · ${count(groups.length, 'booking')} · ${count(groups.reduce((sum, group) => sum + group.size, 0), 'visitor')} · ${duration}-minute activities</p></header>
    ${needsReview ? `<p class="print-notice"><strong>Draft</strong> · ${count(plan.issues.length, 'conflict')} · ${plan.unassigned.length} unassigned</p>` : ''}
    <h2>Activity assignments</h2>
    ${routeRows ? `<table><thead><tr><th scope="col">Activity time</th><th scope="col">Subgroup</th><th scope="col">Arrival</th><th scope="col">Go to</th><th scope="col">Visitors</th></tr></thead><tbody>${routeRows}</tbody></table>` : '<p>No activity assignments yet.</p>'}
    ${plan.unassigned.length ? `<h2>Still to assign</h2><ul>${[...plan.unassigned].sort((a, b) => sortGroups(a.group, b.group)).map(({ group, part }) =>
      `<li>${group.arrival} · ${escapeText(group.name)}${group.name === part.name ? '' : ` / ${escapeText(part.name)}`} · ${count(part.size, 'visitor')}</li>`).join('')}</ul>` : ''}
    ${plan.issues.length ? `<h2>Conflicts to review</h2>${issueItems(plan.issues)}` : ''}`
}

function render() {
  const plan = inspectPlan(groups)
  renderOverview(plan)
  renderArrivals(plan)
  renderBoard(plan)
  renderChecks(plan)
  renderPrint(plan)
}

const editor = byId('editor')
const form = byId('editor-form')
const fields = byId('editor-fields')
let onSubmit

function showEditor(title, content, action, extra, submit) {
  byId('editor-title').textContent = title
  fields.innerHTML = content
  byId('editor-extra').innerHTML = extra
  byId('editor-submit').textContent = action
  byId('editor-submit').disabled = false
  onSubmit = submit
  editor.showModal()
  fields.querySelector('input, select, button')?.focus()
}

function finishEdit(focusTarget) {
  save()
  editor.close()
  render()
  const replacement = document.querySelector(focusTarget) || byId('add-slot')
  replacement.focus()
}

function addSplitRow(part, removed, focus = false) {
  const row = document.createElement('div')
  row.className = 'split-row'
  row.dataset.id = part.id
  row.innerHTML = `
    <label>Subgroup name<input name="partName" required maxlength="60" value="${escapeText(part.name)}"></label>
    <label>Visitors<input name="partSize" type="number" min="1" max="999" required value="${part.size}"></label>
    <button type="button" class="icon-button" aria-label="Remove subgroup" title="Remove subgroup">${icon('close')}</button>`
  const rows = byId('split-rows')
  rows.append(row)
  row.querySelector('button').addEventListener('click', () => {
    if (part.slot && !confirm(`Remove ${part.name} and its activity assignment?`)) return
    removed.add(part.id)
    row.remove()
    updateSplitCount()
    byId('add-split').focus()
  })
  row.addEventListener('input', updateSplitCount)
  updateSplitCount()
  if (focus) row.querySelector('input').focus()
}

function updateSplitCount() {
  const rows = [...fields.querySelectorAll('.split-row')]
  const total = Number(form.elements.size.value)
  const splitTotal = rows.reduce((sum, row) => sum + Number(row.querySelector('[name="partSize"]').value), 0)
  const note = byId('split-count')
  note.textContent = rows.length
    ? `${splitTotal} of ${total} visitors allocated to subgroups.`
    : 'The booking will be scheduled as one subgroup.'
  note.classList.toggle('problem', Boolean(rows.length && splitTotal !== total))
  byId('booking-error').textContent = ''
}

function editBooking(group) {
  const split = group && (group.parts.length > 1 || group.parts[0].name !== group.name)
  const removed = new Set()
  const content = `
    <label>Group name<input name="groupName" required maxlength="60" value="${escapeText(group?.name ?? '')}"></label>
    <div class="field-row">
      <label>Arrival time<input name="arrival" type="time" required value="${group?.arrival ?? '10:00'}"></label>
      <label>Visitors<input name="size" type="number" min="1" max="999" required value="${group?.size ?? ''}"></label>
    </div>
    ${group?.parts.some(part => part.slot) ? '<p class="helper">Changing the arrival time keeps activity slots in place. The schedule flags any activity that starts too early.</p>' : ''}
    <fieldset><legend>Subgroups</legend>
      <p id="split-count" class="form-note" aria-live="polite"></p>
      <div id="split-rows" class="split-rows"></div>
      <button id="add-split" type="button" class="button secondary">${icon('plus')}Add subgroup</button>
    </fieldset>
    <p id="booking-error" class="form-note problem" role="alert"></p>`
  const extra = group ? '<button id="delete-group" type="button" class="button danger">Delete group</button>' : ''
  showEditor(group ? 'Edit booking' : 'Add group', content, 'Save booking', extra, () => {
    const name = form.elements.groupName.value.trim()
    const size = Number(form.elements.size.value)
    const rows = [...fields.querySelectorAll('.split-row')]
    const parts = rows.map(row => ({
      id: row.dataset.id,
      name: row.querySelector('[name="partName"]').value.trim(),
      size: Number(row.querySelector('[name="partSize"]').value),
      slot: group?.parts.find(part => part.id === row.dataset.id)?.slot ?? null,
    }))
    const error = byId('booking-error')
    if (!name || parts.some(part => !part.name)) {
      error.textContent = 'Enter a name for the booking and each subgroup.'
      return
    }
    if (parts.length && parts.reduce((sum, part) => sum + part.size, 0) !== size) {
      error.textContent = 'Subgroup sizes must add up to the booking’s visitor count.'
      return
    }
    if (new Set(parts.map(part => part.name.toLowerCase())).size !== parts.length) {
      error.textContent = 'Use a different name for each subgroup in this booking.'
      return
    }
    if (!parts.length) {
      const original = group?.parts[0]
      const whole = !split && original && !removed.has(original.id) ? original : null
      parts.push({ id: whole?.id ?? newId(), name, size, slot: whole?.slot ?? null })
    }
    const booking = { id: group?.id ?? newId(), name, size, arrival: form.elements.arrival.value, parts }
    if (group) groups[groups.indexOf(group)] = booking
    else groups.push(booking)
    finishEdit(`[data-booking="${booking.id}"]`)
  })
  if (split) group.parts.forEach(part => addSplitRow(part, removed))
  else updateSplitCount()
  form.elements.size.addEventListener('input', updateSplitCount)
  byId('add-split').addEventListener('click', () => {
    const rows = [...fields.querySelectorAll('.split-row')]
    if (!rows.length && !split && group?.parts[0].slot && !removed.has(group.parts[0].id)) {
      addSplitRow(group.parts[0], removed)
    }
    const remaining = Number(form.elements.size.value)
      - [...fields.querySelectorAll('[name="partSize"]')].reduce((sum, input) => sum + Number(input.value), 0)
    addSplitRow({ id: newId(), name: '', size: remaining > 0 ? remaining : '' }, removed, true)
  })
  if (group) {
    byId('delete-group').addEventListener('click', () => {
      if (!confirm(`Delete ${group.name} and all its subgroups and assignments?`)) return
      groups = groups.filter(booking => booking !== group)
      finishEdit('#add-group')
    })
  }
}

function editSlot({ partId, time, roomId } = {}) {
  const plan = inspectPlan(groups)
  const entries = [...plan.entries].sort((a, b) => Number(Boolean(a.part.slot)) - Number(Boolean(b.part.slot))
    || sortGroups(a.group, b.group))
  if (!entries.length) {
    showEditor('Assign a slot', '<p>Add a group before assigning an activity slot.</p>', 'Assign slot', '', () => {})
    byId('editor-submit').disabled = true
    return
  }

  const chosen = entries.find(entry => entry.part.id === partId) ?? entries[0]
  const defaultStart = entry => entry.part.slot?.start ?? clock(Math.min(lastStart, minutes(entry.group.arrival)))
  const defaultRoom = entry => entry.part.slot?.room ?? rooms[0].id
  const start = time ?? defaultStart(chosen)
  const selectedRoom = roomId ?? defaultRoom(chosen)
  const choices = partId
    ? `<p><strong>${escapeText(chosen.part.name)}</strong> · ${count(chosen.part.size, 'visitor')}</p>`
    : `<label>Subgroup<select name="part" required>${entries.map(({ group, part }) => `
        <option value="${part.id}">${escapeText(part.name === group.name ? part.name : `${group.name} / ${part.name}`)} · ${part.size} visitors${part.slot ? ` · Assigned at ${part.slot.start}` : ''}</option>`).join('')}</select></label>`
  const content = `${choices}
    <div class="field-row">
      <label>Activity start<input name="start" type="time" required max="${clock(lastStart)}" value="${start}" aria-describedby="slot-note"></label>
      <label>Space<select name="room" required>${rooms.map(room => `
        <option value="${room.id}" ${room.id === selectedRoom ? 'selected' : ''}>${room.name} · ${room.capacity} max</option>`).join('')}</select></label>
    </div>
    <p id="slot-note" class="form-note" aria-live="polite"></p>`
  const extra = partId ? '<button id="clear-slot" type="button" class="button danger">Clear assignment</button>' : ''
  const selectedEntry = () => partId ? chosen : entries.find(entry => entry.part.id === form.elements.part.value)
  showEditor(partId ? 'Edit assignment' : 'Assign a slot', content, partId ? 'Save assignment' : 'Assign slot', extra, () => {
    const { part } = selectedEntry()
    part.slot = { start: form.elements.start.value, room: form.elements.room.value }
    finishEdit(`[data-part="${part.id}"]`)
  })

  function preview() {
    const entry = selectedEntry()
    const field = form.elements.start
    const note = byId('slot-note')
    if (!field.validity.valid) {
      note.textContent = 'Choose a start time no later than 23:30 for a 30-minute activity.'
      note.classList.add('problem')
      return
    }
    const currentStart = field.value
    const room = roomFor(form.elements.room.value)
    const conflicts = []
    if (currentStart < entry.group.arrival) conflicts.push('Starts before arrival')
    if (entry.part.size > room.capacity) conflicts.push(`Over capacity by ${entry.part.size - room.capacity}`)
    const otherNames = plan.assigned.filter(other =>
      other.part !== entry.part && other.room === room &&
      Math.abs(minutes(other.part.slot.start) - minutes(currentStart)) < duration
    ).map(other => other.part.name)
    if (otherNames.length) conflicts.push(`Overlaps ${otherNames.join(', ')}`)
    note.textContent = `Arrives at ${entry.group.arrival} · Ends at ${endTime(currentStart)}${conflicts.length ? ` · ${conflicts.join(' · ')}` : ''}`
    note.classList.toggle('problem', Boolean(conflicts.length))
  }
  fields.querySelectorAll('input, select').forEach(field => field.addEventListener('input', preview))
  if (!partId && !time) {
    form.elements.part.addEventListener('change', () => {
      const entry = selectedEntry()
      form.elements.start.value = defaultStart(entry)
      form.elements.room.value = defaultRoom(entry)
      preview()
    })
  }
  preview()
  byId('clear-slot')?.addEventListener('click', () => {
    const { start: originalTime, room: originalRoom } = chosen.part.slot
    chosen.part.slot = null
    finishEdit(`[data-time="${originalTime}"][data-room="${originalRoom}"]`)
  })
}

document.querySelectorAll('[data-icon]').forEach(node => { node.innerHTML = svg(node.dataset.icon) })
saveStatus(initialStatus, initialStatus === 'Local save unavailable')
render()

byId('add-group').addEventListener('click', () => editBooking())
byId('add-slot').addEventListener('click', () => editSlot())
byId('arrivals-list').addEventListener('click', event => {
  const button = event.target.closest('[data-booking]')
  if (button) editBooking(groups.find(group => group.id === button.dataset.booking))
})
byId('board').addEventListener('click', event => {
  const button = event.target.closest('button')
  if (button) editSlot({ partId: button.dataset.part, time: button.dataset.time, roomId: button.dataset.room })
})
byId('print-button').addEventListener('click', () => window.print())
form.addEventListener('submit', event => {
  event.preventDefault()
  onSubmit()
})
editor.querySelectorAll('[data-action="close"]').forEach(button => button.addEventListener('click', () => editor.close()))
