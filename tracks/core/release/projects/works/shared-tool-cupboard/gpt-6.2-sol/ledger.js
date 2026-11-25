'use strict';

const Ledger = (() => {
  const items = [
    { id: 'T-01', name: 'Folding table', capacity: 1, art: 'table' },
    { id: 'T-02', name: 'Folding table', capacity: 1, art: 'table' },
    { id: 'P-01', name: 'Projector', capacity: 1, art: 'projector' },
    { id: 'cords', name: 'Extension cords', capacity: 3, art: 'cords' },
  ];

  function localDay(date = new Date()) {
    return [
      String(date.getFullYear()).padStart(4, '0'),
      String(date.getMonth() + 1).padStart(2, '0'),
      String(date.getDate()).padStart(2, '0'),
    ].join('-');
  }

  function addDays(day, days) {
    const date = new Date(day + 'T12:00:00');
    date.setDate(date.getDate() + days);
    return localDay(date);
  }

  function remaining(loan) {
    return loan.quantity - loan.returned;
  }

  function commitments(state, item, today, excludeId) {
    const loans = state.loans.filter(loan => loan.item === item && remaining(loan) > 0);
    const bookings = state.reservations.filter(booking =>
      booking.item === item && booking.id !== excludeId && booking.end >= today);
    return [
      ...loans.map(loan => ({
        kind: 'loan', household: loan.household, quantity: remaining(loan),
        start: today, end: loan.end < today ? null : loan.end, due: loan.end,
      })),
      ...bookings.map(booking => ({
        kind: 'reservation', household: booking.household, quantity: booking.quantity,
        start: booking.start, end: booking.end,
      })),
    ];
  }

  // Usage can only increase when a commitment starts. Check those dates
  // and the first requested day to find the tightest point in the range.
  function availability(state, item, start, end, today, excludeId) {
    const capacity = items.find(entry => entry.id === item).capacity;
    const spans = commitments(state, item, today, excludeId).filter(span =>
      (end === null || span.start <= end) && (span.end === null || span.end >= start));
    const checkpoints = [...new Set([start, ...spans.map(span => span.start)
      .filter(day => day > start)])].sort();
    let peak = { day: start, used: 0, blockers: [] };
    for (const day of checkpoints) {
      const active = spans.filter(span => span.start <= day && (span.end === null || span.end >= day));
      const used = active.reduce((total, span) => total + span.quantity, 0);
      if (used > peak.used) peak = { day, used, blockers: active };
    }
    return { free: Math.max(0, capacity - peak.used), peak, spans };
  }

  return { items, localDay, addDays, remaining, availability };
})();

if (typeof module !== 'undefined') module.exports = Ledger;
