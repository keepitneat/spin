// store.js
/* App state + persistence. State transforms are pure (return a new state);
 * the browser persists via saveState(localStorage, state). `storage` is any
 * { getItem, setItem }. IDs are passed in by callers so this stays testable. */

export const STORAGE_KEY = 'jts:state';
export const SCHEMA_VERSION = 1;
export const HISTORY_CAP = 20;

const DEFAULT_SETTINGS = { removeWinner: false, weighted: false, history: true };

export function defaultWheel(id, name) {
  return { id, name, items: [], settings: { ...DEFAULT_SETTINGS }, history: [] };
}

export function defaultState() {
  const wheel = defaultWheel('w_1', 'My first wheel');
  return {
    version: SCHEMA_VERSION,
    activeWheelId: wheel.id,
    palette: 'festive',
    theme: 'system',
    wheels: [wheel],
  };
}

// --- persistence ---

export function loadState(storage) {
  const raw = storage.getItem(STORAGE_KEY);
  if (!raw) return defaultState();
  try {
    const parsed = JSON.parse(raw);
    return normalize(parsed);
  } catch {
    return defaultState();
  }
}

export function saveState(storage, state) {
  storage.setItem(STORAGE_KEY, JSON.stringify(state));
}

// Coerce a parsed object into a valid state; fill gaps from defaults.
function normalize(parsed) {
  if (!parsed || !Array.isArray(parsed.wheels) || parsed.wheels.length === 0) {
    return defaultState();
  }
  const wheels = parsed.wheels.map((w) => ({
    id: String(w.id),
    name: String(w.name ?? 'Wheel'),
    items: Array.isArray(w.items)
      ? w.items.map((it) => ({ label: String(it.label ?? ''), weight: Number(it.weight) || 1 }))
      : [],
    settings: { ...DEFAULT_SETTINGS, ...(w.settings || {}) },
    history: Array.isArray(w.history) ? w.history.slice(0, HISTORY_CAP) : [],
  }));
  const activeWheelId = wheels.some((w) => w.id === parsed.activeWheelId)
    ? parsed.activeWheelId
    : wheels[0].id;
  return {
    version: SCHEMA_VERSION,
    activeWheelId,
    palette: parsed.palette || 'festive',
    theme: parsed.theme || 'system',
    wheels,
  };
}

// --- pure transforms ---

const mapWheel = (state, id, fn) => ({
  ...state,
  wheels: state.wheels.map((w) => (w.id === id ? fn(w) : w)),
});

export function createWheel(state, id, name) {
  return { ...state, wheels: [...state.wheels, defaultWheel(id, name)], activeWheelId: id };
}

export function renameWheel(state, id, name) {
  return mapWheel(state, id, (w) => ({ ...w, name }));
}

export function deleteWheel(state, id) {
  if (state.wheels.length <= 1) return state; // never empty the list
  const wheels = state.wheels.filter((w) => w.id !== id);
  const activeWheelId = state.activeWheelId === id ? wheels[0].id : state.activeWheelId;
  return { ...state, wheels, activeWheelId };
}

export function duplicateWheel(state, id, newId) {
  const src = state.wheels.find((w) => w.id === id);
  if (!src) return state;
  const copy = {
    id: newId,
    name: `${src.name} copy`,
    items: src.items.map((it) => ({ ...it })),
    settings: { ...src.settings },
    history: [],
  };
  return { ...state, wheels: [...state.wheels, copy], activeWheelId: newId };
}

export function setActive(state, id) {
  return { ...state, activeWheelId: id };
}

export function setItems(state, id, items) {
  return mapWheel(state, id, (w) => ({ ...w, items }));
}

export function setSettings(state, id, partial) {
  return mapWheel(state, id, (w) => ({ ...w, settings: { ...w.settings, ...partial } }));
}

export function recordWinner(state, id, label, ts) {
  return mapWheel(state, id, (w) => ({
    ...w,
    history: [{ label, ts }, ...w.history].slice(0, HISTORY_CAP),
  }));
}
