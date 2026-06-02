// store.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  STORAGE_KEY, SCHEMA_VERSION, HISTORY_CAP,
  defaultState, loadState, saveState,
  createWheel, renameWheel, deleteWheel, duplicateWheel, setActive,
  setItems, setSettings, recordWinner,
} from './store.js';

function fakeStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
  };
}

test('defaultState: one wheel, it is active, festive + system defaults', () => {
  const s = defaultState();
  assert.equal(s.version, SCHEMA_VERSION);
  assert.equal(s.wheels.length, 1);
  assert.equal(s.activeWheelId, s.wheels[0].id);
  assert.equal(s.palette, 'festive');
  assert.equal(s.theme, 'system');
});

test('loadState: empty storage yields a default state', () => {
  const s = loadState(fakeStorage());
  assert.equal(s.wheels.length, 1);
});

test('loadState: corrupt JSON falls back to default', () => {
  const s = loadState(fakeStorage({ [STORAGE_KEY]: '{not json' }));
  assert.equal(s.wheels.length, 1);
});

test('save then load round-trips', () => {
  const storage = fakeStorage();
  const s = createWheel(defaultState(), 'w_2', 'Chores');
  saveState(storage, s);
  const loaded = loadState(storage);
  assert.equal(loaded.wheels.length, 2);
  assert.equal(loaded.wheels[1].name, 'Chores');
});

test('createWheel: appends a wheel and makes it active', () => {
  const s = createWheel(defaultState(), 'w_2', 'Names');
  assert.equal(s.wheels.length, 2);
  assert.equal(s.activeWheelId, 'w_2');
  assert.deepEqual(s.wheels[1].items, []);
  assert.deepEqual(s.wheels[1].settings, { removeWinner: false, weighted: false, history: true });
});

test('renameWheel: changes only the target name', () => {
  const base = defaultState();
  const id = base.wheels[0].id;
  const s = renameWheel(base, id, 'Dinner');
  assert.equal(s.wheels[0].name, 'Dinner');
});

test('deleteWheel: removes wheel and reassigns active if needed', () => {
  let s = createWheel(defaultState(), 'w_2', 'Names');
  s = deleteWheel(s, 'w_2');
  assert.equal(s.wheels.length, 1);
  assert.equal(s.activeWheelId, s.wheels[0].id);
});

test('deleteWheel: never empties the list (last wheel is kept)', () => {
  const base = defaultState();
  const s = deleteWheel(base, base.wheels[0].id);
  assert.equal(s.wheels.length, 1);
});

test('duplicateWheel: copies items + settings under a new id and name', () => {
  let base = setItems(defaultState(), defaultState().wheels[0].id,
    [{ label: 'A', weight: 1 }]);
  const id = base.wheels[0].id;
  const s = duplicateWheel(base, id, 'w_copy');
  assert.equal(s.wheels.length, 2);
  assert.equal(s.wheels[1].id, 'w_copy');
  assert.match(s.wheels[1].name, /copy/i);
  assert.deepEqual(s.wheels[1].items, [{ label: 'A', weight: 1 }]);
});

test('setItems / setSettings update the target wheel immutably', () => {
  const base = defaultState();
  const id = base.wheels[0].id;
  const withItems = setItems(base, id, [{ label: 'X', weight: 2 }]);
  assert.deepEqual(withItems.wheels[0].items, [{ label: 'X', weight: 2 }]);
  assert.deepEqual(base.wheels[0].items, []);
  const withSettings = setSettings(withItems, id, { weighted: true });
  assert.equal(withSettings.wheels[0].settings.weighted, true);
  assert.equal(withSettings.wheels[0].settings.history, true);
});

test('setItems: clones the array so later caller mutation does not leak', () => {
  const base = defaultState();
  const id = base.wheels[0].id;
  const caller = [{ label: 'A', weight: 1 }];
  const s = setItems(base, id, caller);
  caller.push({ label: 'B', weight: 1 }); // mutate the caller's array afterward
  assert.equal(s.wheels[0].items.length, 1); // stored state is unaffected
});

test('recordWinner: prepends and caps at HISTORY_CAP', () => {
  let s = defaultState();
  const id = s.wheels[0].id;
  for (let i = 0; i < HISTORY_CAP + 5; i++) s = recordWinner(s, id, `w${i}`, i);
  assert.equal(s.wheels[0].history.length, HISTORY_CAP);
  assert.equal(s.wheels[0].history[0].label, `w${HISTORY_CAP + 4}`);
});

test('setActive: switches the active wheel', () => {
  const s = setActive(createWheel(defaultState(), 'w_2', 'B'), 'w_2');
  assert.equal(s.activeWheelId, 'w_2');
});
