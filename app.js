/* Just the Spin — app wiring. Owns live state, persists to localStorage,
 * renders the wheel, orchestrates spins. Pure logic lives in the imported
 * modules; this file is the DOM glue. */

import { loadState, saveState, createWheel, renameWheel, deleteWheel,
  duplicateWheel, setActive, setItems, setSettings, recordWinner } from './store.js';
import { parseList } from './parse.js';
import { pickIndex, removeAt, moveItem } from './picker.js';
import { sliceAngles, rotationForWinner } from './geometry.js';
import { buildWheelSVG } from './wheel.js';
import { PALETTE_NAMES, normalizePalette } from './palette.js';
import { THEME_STATES, normalizeTheme, themeAttr } from './theme.js';

const storage = window.localStorage;
let state = loadState(storage);
let rotation = 0;          // current cumulative wheel rotation (deg)
let spinning = false;
let removedThisDraw = [];  // winners removed during the current remove-winner draw
let dragFrom = null;       // index being dragged in the editor

const $ = (id) => document.getElementById(id);
const nextId = (prefix) => `${prefix}_${Date.now().toString(36)}_${Math.floor(Math.random() * 1e6).toString(36)}`;
const activeWheel = () => state.wheels.find((w) => w.id === state.activeWheelId) || state.wheels[0];

function persist() { saveState(storage, state); }

// --- rendering ---

function renderWheel() {
  const w = activeWheel();
  // Draw slices with the same effective weights the spin math uses, so the
  // visual wheel can never disagree with the picker (weighted off ⇒ uniform).
  const drawItems = w.settings.weighted ? w.items : w.items.map((it) => ({ ...it, weight: 1 }));
  $('wheel-rotor-host').innerHTML = buildWheelSVG(drawItems, state.palette);
  $('active-wheel-name').textContent = w.name;
  $('spin-btn').disabled = w.items.length === 0 || spinning;
  renderRestore();
}

// When remove-winner has drawn the wheel empty, offer to put everything back.
function renderRestore() {
  let btn = $('restore-btn');
  const show = activeWheel().items.length === 0 && removedThisDraw.length > 0;
  if (show && !btn) {
    btn = document.createElement('button');
    btn.id = 'restore-btn';
    btn.type = 'button';
    btn.textContent = '↺ Restore items';
    btn.addEventListener('click', restoreDraw);
    $('stage').appendChild(btn);
  } else if (!show && btn) {
    btn.remove();
  }
}

function restoreDraw() {
  const w = activeWheel();
  state = setItems(state, w.id, [...removedThisDraw]);
  removedThisDraw = [];
  persist(); renderAll();
}

function renderEditor() {
  const w = activeWheel();
  $('item-count').textContent = `Items (${w.items.length})`;
  $('chip-remove').setAttribute('aria-pressed', String(w.settings.removeWinner));
  $('chip-weights').setAttribute('aria-pressed', String(w.settings.weighted));
  $('chip-history').setAttribute('aria-pressed', String(w.settings.history));

  const list = $('item-list');
  list.innerHTML = '';
  w.items.forEach((item, i) => {
    const li = document.createElement('li');
    li.draggable = true;
    li.dataset.i = String(i);
    const weightField = w.settings.weighted
      ? `<input class="weight" type="number" min="1" value="${item.weight}" data-i="${i}" aria-label="Weight for ${item.label}">`
      : '';
    li.innerHTML = `<span class="grip" aria-hidden="true">⠿</span>` +
      `<span class="label"></span>${weightField}` +
      `<button class="remove" data-i="${i}" aria-label="Remove ${item.label}">✕</button>`;
    li.querySelector('.label').textContent = item.label;
    list.appendChild(li);
  });

  const hist = $('history-list');
  if (w.settings.history && w.history.length) {
    hist.hidden = false;
    hist.innerHTML = w.history.map((h) => `<li></li>`).join('');
    [...hist.children].forEach((li, i) => { li.textContent = w.history[i].label; });
  } else {
    hist.hidden = true;
  }
}

function renderAll() { renderWheel(); renderEditor(); }

// --- spinning ---

function spin() {
  const w = activeWheel();
  if (spinning || w.items.length === 0) return;
  spinning = true;
  $('spin-btn').disabled = true;
  $('winner').hidden = true;

  const weights = w.items.map((it) => (w.settings.weighted ? it.weight || 1 : 1));
  const winnerIndex = pickIndex(weights);
  const angles = sliceAngles(weights);
  const target = rotationForWinner(angles, winnerIndex, 5);

  // Always advance forward from current rotation to the next aligned target.
  const base = Math.ceil(rotation / 360) * 360;
  rotation = base + target;

  const rotor = $('wheel-rotor-host').firstElementChild;
  rotor.classList.add('spinning');
  rotor.style.transform = `rotate(${rotation}deg)`;

  const settle = () => {
    if (!spinning) return; // idempotent: transitionend and the timeout can't both run the body
    rotor.removeEventListener('transitionend', settle);
    spinning = false;
    const winner = w.items[winnerIndex];
    $('winner').hidden = false;
    $('winner').textContent = `🎉 Winner: ${winner.label}`;

    if (w.settings.history) { state = recordWinner(state, w.id, winner.label, Date.now()); }
    if (w.settings.removeWinner) {
      removedThisDraw.push({ label: winner.label, weight: winner.weight });
      state = setItems(state, w.id, removeAt(w.items, winnerIndex));
    }
    persist();
    renderAll();
  };
  rotor.addEventListener('transitionend', settle);
  // Safety net: if transitionend is ever missed (no transition, backgrounded
  // tab, or a re-render orphaning the listener), settle anyway so the Spin
  // button can never get stuck disabled. settle() is idempotent.
  const durMs = (parseFloat(getComputedStyle(rotor).transitionDuration) || 4) * 1000;
  setTimeout(settle, durMs + 250);
}

// --- editor actions ---

function addItem(label) {
  const w = activeWheel();
  removedThisDraw = [];
  state = setItems(state, w.id, [...w.items, { label, weight: 1 }]);
  persist(); renderAll();
}

function bulkAdd(text) {
  const w = activeWheel();
  const additions = parseList(text).map((label) => ({ label, weight: 1 }));
  if (!additions.length) return;
  removedThisDraw = [];
  state = setItems(state, w.id, [...w.items, ...additions]);
  persist(); renderAll();
}

function removeItem(i) {
  const w = activeWheel();
  removedThisDraw = [];
  state = setItems(state, w.id, removeAt(w.items, i));
  persist(); renderAll();
}

function reorderItem(from, to) {
  const w = activeWheel();
  if (from === to || from == null) return;
  state = setItems(state, w.id, moveItem(w.items, from, to));
  persist(); renderAll();
}

function setWeight(i, value) {
  const w = activeWheel();
  const items = w.items.map((it, idx) => (idx === i ? { ...it, weight: Math.max(1, value | 0) } : it));
  state = setItems(state, w.id, items);
  persist(); renderAll();
}

function toggleSetting(key) {
  const w = activeWheel();
  state = setSettings(state, w.id, { [key]: !w.settings[key] });
  persist(); renderAll();
}

// --- switcher ---

function renderMenu() {
  const menu = $('wheel-menu');
  menu.innerHTML = '';
  state.wheels.forEach((w) => {
    const b = document.createElement('button');
    b.textContent = (w.id === state.activeWheelId ? '✓ ' : '') + w.name;
    b.onclick = () => { removedThisDraw = []; state = setActive(state, w.id); persist(); closeMenu(); renderAll(); };
    menu.appendChild(b);
  });
  const add = (text, fn) => { const b = document.createElement('button'); b.textContent = text; b.onclick = fn; menu.appendChild(b); };
  add('+ New wheel', () => {
    const name = prompt('Name this wheel:', 'New wheel');
    if (name) { removedThisDraw = []; state = createWheel(state, nextId('w'), name.trim()); persist(); closeMenu(); renderAll(); }
  });
  add('✎ Rename current', () => {
    const name = prompt('Rename wheel:', activeWheel().name);
    if (name) { state = renameWheel(state, state.activeWheelId, name.trim()); persist(); closeMenu(); renderAll(); }
  });
  add('⧉ Duplicate current', () => { removedThisDraw = []; state = duplicateWheel(state, state.activeWheelId, nextId('w')); persist(); closeMenu(); renderAll(); });
  if (state.wheels.length > 1) {
    add('🗑 Delete current', () => {
      if (confirm(`Delete "${activeWheel().name}"?`)) { removedThisDraw = []; state = deleteWheel(state, state.activeWheelId); persist(); closeMenu(); renderAll(); }
    });
  }
}
function openMenu() { renderMenu(); $('wheel-menu').hidden = false; $('switch-toggle').setAttribute('aria-expanded', 'true'); }
function closeMenu() { $('wheel-menu').hidden = true; $('switch-toggle').setAttribute('aria-expanded', 'false'); }

// --- toggles ---

function cyclePalette() {
  const i = PALETTE_NAMES.indexOf(normalizePalette(state.palette));
  state.palette = PALETTE_NAMES[(i + 1) % PALETTE_NAMES.length];
  document.documentElement.setAttribute('data-palette', state.palette);
  localStorage.setItem('palette', state.palette);
  persist(); renderWheel();
}

function cycleTheme() {
  const i = THEME_STATES.indexOf(normalizeTheme(state.theme));
  state.theme = THEME_STATES[(i + 1) % THEME_STATES.length];
  const attr = themeAttr(state.theme);
  if (attr) document.documentElement.setAttribute('data-theme', attr);
  else document.documentElement.removeAttribute('data-theme');
  localStorage.setItem('theme', state.theme);
  persist();
}

// --- events ---

$('spin-btn').addEventListener('click', spin);
$('wheel').addEventListener('click', () => { if (!spinning) spin(); });

$('add-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const v = $('add-input').value.trim();
  if (v) { addItem(v); $('add-input').value = ''; }
});

$('paste-btn').addEventListener('click', async () => {
  let text = '';
  try { text = await navigator.clipboard.readText(); } catch { /* permission denied */ }
  if (!text) text = prompt('Paste your list (one per line or comma-separated):') || '';
  bulkAdd(text);
});

$('item-list').addEventListener('click', (e) => {
  const btn = e.target.closest('.remove');
  if (btn) removeItem(Number(btn.dataset.i));
});
$('item-list').addEventListener('change', (e) => {
  if (e.target.classList.contains('weight')) setWeight(Number(e.target.dataset.i), Number(e.target.value));
});

// Drag-to-reorder (HTML5 DnD on the <li> rows).
$('item-list').addEventListener('dragstart', (e) => {
  const li = e.target.closest('li');
  if (li) { dragFrom = Number(li.dataset.i); e.dataTransfer.effectAllowed = 'move'; }
});
$('item-list').addEventListener('dragover', (e) => { e.preventDefault(); });
$('item-list').addEventListener('drop', (e) => {
  e.preventDefault();
  const li = e.target.closest('li');
  if (li && dragFrom != null) reorderItem(dragFrom, Number(li.dataset.i));
  dragFrom = null;
});

$('chip-remove').addEventListener('click', () => toggleSetting('removeWinner'));
$('chip-weights').addEventListener('click', () => toggleSetting('weighted'));
$('chip-history').addEventListener('click', () => toggleSetting('history'));

$('switch-toggle').addEventListener('click', () => {
  $('wheel-menu').hidden ? openMenu() : closeMenu();
});
document.addEventListener('click', (e) => {
  if (!$('switcher').contains(e.target)) closeMenu();
});

$('palette-toggle').addEventListener('click', cyclePalette);
$('theme-toggle').addEventListener('click', cycleTheme);

// --- init ---

document.documentElement.setAttribute('data-palette', normalizePalette(state.palette));
renderAll();

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/service-worker.js').catch((err) => {
    console.warn('SW registration failed', err);
  });
}
