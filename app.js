/* Just the Spin — app wiring. Owns live state, persists to localStorage,
 * renders the wheel, orchestrates spins. Pure logic lives in the imported
 * modules; this file is the DOM glue. */

import { loadState, saveState, createWheel, renameWheel, deleteWheel,
  duplicateWheel, setActive, setItems, setSettings, recordWinner } from './store.js';
import { parseList } from './parse.js';
import { pickIndex, removeAt, moveItem } from './picker.js';
import { sliceAngles, rotationForWinner, winnerAt } from './geometry.js';
import { buildWheelSVG, isTwoHalfLayout } from './wheel.js';
import { PALETTE_NAMES, normalizePalette } from './palette.js';
import { THEME_STATES, normalizeTheme, themeAttr } from './theme.js';
import { tick, ding, unlock } from './sound.js';

const storage = window.localStorage;
let state = loadState(storage);
let rotation = 0;          // current cumulative wheel rotation (deg)
let spinning = false;
let removedThisDraw = [];  // winners removed during the current remove-winner draw
let dragFrom = null;       // index being dragged in the editor
let soundOn = localStorage.getItem('sound') !== 'off'; // default on; user can mute

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
  // Re-apply the current orientation to the freshly-rendered rotor so the wheel
  // stays parked on the winner after a spin instead of snapping back to start.
  // No .spinning class here ⇒ no transition ⇒ instant, no visible reset.
  const parked = $('wheel-rotor-host').firstElementChild;
  if (parked) parked.style.transform = `rotate(${rotation}deg)`;
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
  // Two equal items use the top/bottom coin-flip layout, so landing the winner
  // upright means a half-turn to the bottom item or none for the top item.
  const target = isTwoHalfLayout(weights)
    ? 5 * 360 + winnerIndex * 180
    : rotationForWinner(angles, winnerIndex, 5);

  // Always advance forward from current rotation to the next aligned target.
  const base = Math.ceil(rotation / 360) * 360;
  rotation = base + target;

  const rotor = $('wheel-rotor-host').firstElementChild;
  rotor.classList.add('spinning');
  rotor.style.transform = `rotate(${rotation}deg)`;

  // Tick once per slice that passes the pointer, synced to the real rotation
  // (so ticks decelerate exactly with the wheel). A landing chime fires on settle.
  if (soundOn) startTicking(rotor, angles);

  const settle = () => {
    if (!spinning) return; // idempotent: transitionend and the timeout can't both run the body
    rotor.removeEventListener('transitionend', settle);
    spinning = false;
    const winner = w.items[winnerIndex];
    $('winner').hidden = false;
    $('winner').textContent = `🎉 Winner: ${winner.label}`;
    if (soundOn) ding();

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

// Current applied rotation (deg) read from the element's transform matrix.
function currentRotationDeg(el) {
  const t = getComputedStyle(el).transform;
  if (!t || t === 'none') return 0;
  const m = new DOMMatrixReadOnly(t);
  return (Math.atan2(m.b, m.a) * 180) / Math.PI;
}

// Plays a tick each time a new slice crosses under the top pointer, following
// the real animated rotation so ticks slow down with the wheel. Stops on settle.
function startTicking(rotor, angles) {
  let lastIndex = winnerAt(angles, currentRotationDeg(rotor));
  const step = () => {
    if (!spinning) return;
    const idx = winnerAt(angles, currentRotationDeg(rotor));
    if (idx !== lastIndex) { lastIndex = idx; tick(); }
    requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
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

let menuMode = 'list'; // 'list' | 'new' | 'rename' | 'delete'

function menuButton(text, onclick, className) {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = text;
  if (className) b.className = className;
  // Stop the click reaching the document outside-click handler: re-rendering the
  // menu detaches this button, which would otherwise be read as an outside click.
  b.onclick = (e) => { e.stopPropagation(); onclick(e); };
  return b;
}

// Inline name entry for New / Rename — replaces the menu list with a field.
function renderNameInput(renaming) {
  const row = document.createElement('div');
  row.className = 'menu-input-row';
  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = renaming ? 'Rename wheel…' : 'Name this wheel…';
  input.value = renaming ? activeWheel().name : '';
  const commit = () => {
    const name = input.value.trim();
    if (!name) { menuMode = 'list'; renderMenu(); return; }
    if (renaming) {
      state = renameWheel(state, state.activeWheelId, name);
    } else {
      removedThisDraw = [];
      state = createWheel(state, nextId('w'), name);
    }
    persist();
    menuMode = 'list';
    closeMenu();
    renderAll();
  };
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); commit(); }
    else if (e.key === 'Escape') { menuMode = 'list'; renderMenu(); }
  });
  row.append(
    input,
    menuButton(renaming ? 'Save' : 'Add', commit, 'primary'),
    menuButton('Cancel', () => { menuMode = 'list'; renderMenu(); }, 'ghost')
  );
  $('wheel-menu').appendChild(row);
  input.focus();
}

// Inline two-step delete confirm — no native confirm() dialog.
function renderDeleteConfirm() {
  const row = document.createElement('div');
  row.className = 'menu-confirm';
  const label = document.createElement('span');
  label.textContent = `Delete "${activeWheel().name}"?`;
  row.append(
    label,
    menuButton('Delete', () => {
      removedThisDraw = [];
      state = deleteWheel(state, state.activeWheelId);
      persist();
      menuMode = 'list';
      closeMenu();
      renderAll();
    }, 'danger'),
    menuButton('Cancel', () => { menuMode = 'list'; renderMenu(); }, 'ghost')
  );
  $('wheel-menu').appendChild(row);
}

function renderMenu() {
  const menu = $('wheel-menu');
  menu.innerHTML = '';

  if (menuMode === 'new') { renderNameInput(false); return; }
  if (menuMode === 'rename') { renderNameInput(true); return; }
  if (menuMode === 'delete') { renderDeleteConfirm(); return; }

  state.wheels.forEach((w) => {
    menu.appendChild(menuButton((w.id === state.activeWheelId ? '✓ ' : '') + w.name, () => {
      removedThisDraw = [];
      state = setActive(state, w.id);
      persist(); closeMenu(); renderAll();
    }));
  });

  const sep = document.createElement('div');
  sep.className = 'menu-sep';
  menu.appendChild(sep);

  menu.appendChild(menuButton('＋ New wheel', () => { menuMode = 'new'; renderMenu(); }));
  menu.appendChild(menuButton('✎ Rename', () => { menuMode = 'rename'; renderMenu(); }));
  menu.appendChild(menuButton('⧉ Duplicate', () => {
    removedThisDraw = [];
    state = duplicateWheel(state, state.activeWheelId, nextId('w'));
    persist(); closeMenu(); renderAll();
  }));
  if (state.wheels.length > 1) {
    menu.appendChild(menuButton(`🗑 Delete "${activeWheel().name}"`, () => { menuMode = 'delete'; renderMenu(); }, 'danger-text'));
  }
}

function openMenu() { menuMode = 'list'; renderMenu(); $('wheel-menu').hidden = false; $('switch-toggle').setAttribute('aria-expanded', 'true'); }
function closeMenu() { menuMode = 'list'; $('wheel-menu').hidden = true; $('switch-toggle').setAttribute('aria-expanded', 'false'); }

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

// Inline paste: reveal a textarea in the editor instead of a native popup.
function openPaste() {
  $('paste-area').hidden = false;
  $('paste-btn').setAttribute('aria-expanded', 'true');
  $('paste-input').focus();
}
function closePaste() {
  $('paste-area').hidden = true;
  $('paste-input').value = '';
  $('paste-btn').setAttribute('aria-expanded', 'false');
}
$('paste-btn').addEventListener('click', () => {
  $('paste-area').hidden ? openPaste() : closePaste();
});
$('paste-add').addEventListener('click', () => {
  bulkAdd($('paste-input').value);
  closePaste();
});
$('paste-cancel').addEventListener('click', closePaste);

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

function updateSoundIcon() { $('sound-toggle').textContent = soundOn ? '🔊' : '🔇'; }
$('sound-toggle').addEventListener('click', () => {
  soundOn = !soundOn;
  localStorage.setItem('sound', soundOn ? 'on' : 'off');
  updateSoundIcon();
  if (soundOn) { unlock(); ding(); } // confirm + unlock audio within the gesture
});
// Spin is a user gesture — unlock audio there too so the first spin can tick.
$('spin-btn').addEventListener('click', unlock);

// --- init ---

document.documentElement.setAttribute('data-palette', normalizePalette(state.palette));
updateSoundIcon();
renderAll();

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/service-worker.js').catch((err) => {
    console.warn('SW registration failed', err);
  });
}
