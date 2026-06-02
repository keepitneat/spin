// palette.js
/* Slice color palettes. `festive` is the default (brand-green-led jewel set,
 * ordered so lookalikes never sit adjacent). Colors cycle for long lists.
 * The depth treatment (sheen, dividers, shadow) lives in wheel.js + CSS. */

export const PALETTES = {
  // emerald → amber → indigo → ruby → teal → amethyst
  festive: ['#047857', '#b45309', '#4338ca', '#be123c', '#0e7490', '#7c3aed'],
  // brand-green tonal scale
  mono: ['#064e3b', '#047857', '#059669', '#10b981', '#34d399', '#6ee7b7'],
  // ink / paper alternating
  bw: ['#111827', '#f3f4f6'],
};

export const PALETTE_NAMES = ['festive', 'mono', 'bw'];

export function normalizePalette(name) {
  return PALETTE_NAMES.includes(name) ? name : 'festive';
}

export function colorForSlice(paletteName, index) {
  const colors = PALETTES[normalizePalette(paletteName)];
  return colors[index % colors.length];
}

// Readable label color for a given slice fill, chosen by perceived luminance.
// Keeps labels legible on the light B&W "paper" slices.
export function labelColor(hex) {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.6 ? '#111827' : '#ffffff';
}
