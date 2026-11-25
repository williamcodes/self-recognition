'use strict';

const Inventory = (() => {
  const key = 'seed-library.inventory.v1';
  const lowLimit = 3;

  function openingState() {
    const rows = [['Snow Pea', 'P26-01', 17], ['Calendula', 'C26-02', 9], ['Bush Bean', 'B25-04', 4]];
    return {
      version: 1,
      lots: rows.map(([variety, code], index) => ({ id: index + 1, variety, code })),
      entries: rows.map(([, , count], index) => ({
        id: index + 1, lotId: index + 1, type: 'opening', delta: count, balance: count, at: null
      }))
    };
  }

  function load() {
    const raw = localStorage.getItem(key);
    if (raw === null) return openingState();
    const data = JSON.parse(raw);
    if (data?.version !== 1 || !Array.isArray(data.lots) || !Array.isArray(data.entries) || !data.lots.length) {
      throw new Error('The saved inventory could not be read.');
    }
    return data;
  }

  function balances(data) {
    const result = new Map();
    for (const item of data.entries) result.set(item.lotId, item.balance);
    return result;
  }

  function quantity(value, min) {
    if (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) < min) {
      throw new EntryError(min ? 'Enter a positive whole number of packets.' : 'Enter a whole number of packets, zero or more.', 'quantity');
    }
    return Number(value);
  }

  const clean = value => value.trim().replace(/\s+/g, ' ');
  const fold = value => clean(value).toLowerCase();

  class EntryError extends Error {
    constructor(message, field) {
      super(message);
      this.field = field;
    }
  }

  function apply(data, input, at = new Date().toISOString()) {
    let lot = data.lots.find(item => item.id === input.lotId);
    const counts = balances(data);
    let delta;
    let reason;
    let reverses;
    let counted;
    let added = false;

    if (input.type === 'donation') {
      const variety = clean(input.variety);
      const code = clean(input.code).toUpperCase();
      if (!variety || variety.length > 70) throw new EntryError('Enter a variety name up to 70 characters.', 'variety');
      if (!code || code.length > 35) throw new EntryError('Enter a lot code up to 35 characters.', 'code');
      delta = quantity(input.quantity, 1);
      lot = data.lots.find(item => fold(item.variety) === fold(variety) && fold(item.code) === fold(code));
      if (!lot) {
        const knownVariety = data.lots.find(item => fold(item.variety) === fold(variety));
        lot = { id: data.lots.at(-1).id + 1, variety: knownVariety?.variety ?? variety, code };
        added = true;
      }
    } else {
      if (!lot) throw new EntryError('Select a lot and try again.');
      const available = counts.get(lot.id);
      if (input.type === 'checkout') {
        delta = -quantity(input.quantity, 1);
        if (available + delta < 0) throw new EntryError(`Only ${available} packets are available in this lot.`, 'quantity');
      } else if (input.type === 'correction') {
        counted = quantity(input.quantity, 0);
        reason = clean(input.reason);
        if (!reason || reason.length > 120) throw new EntryError('Enter a short reason up to 120 characters.', 'reason');
        delta = counted - available;
      } else if (input.type === 'undo') {
        const original = data.entries.find(item => item.id === input.entryId && item.lotId === lot.id);
        if (!original || original.type === 'opening' || original.type === 'undo') throw new EntryError('This entry cannot be undone.');
        if (data.entries.some(item => item.reverses === original.id)) throw new EntryError('This entry has already been undone.');
        delta = -original.delta;
        reverses = original.id;
        if (available + delta < 0) throw new EntryError('Undoing this entry would make stock negative. Check later activity for this lot.');
      } else {
        throw new EntryError('Choose a stock action.');
      }
    }

    const balance = (counts.get(lot.id) ?? 0) + delta;
    if (!Number.isSafeInteger(balance)) throw new EntryError('The resulting lot count is too large.', 'quantity');
    const entry = {
      id: data.entries.at(-1).id + 1, lotId: lot.id, type: input.type, delta, balance, at,
      ...(reason && { reason, counted }), ...(reverses && { reverses })
    };
    if (added) data.lots.push(lot);
    data.entries.push(entry);
    return entry;
  }

  async function save(input) {
    // Read, apply and save together so a second open desk tab uses the latest counts.
    function commit() {
      const data = load();
      const entry = apply(data, input);
      localStorage.setItem(key, JSON.stringify(data));
      return { data, entry };
    }
    if (typeof navigator.locks?.request === 'function') {
      return navigator.locks.request(key, commit);
    }
    return commit();
  }

  return { key, load, save, balances, lowLimit, openingState, EntryError };
})();
