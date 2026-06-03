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

const INK = '#111827';
const PAPER = '#ffffff';

// WCAG relative luminance of a #rrggbb color.
function relLuminance(hex) {
  const h = hex.replace('#', '');
  const chan = (i) => {
    const c = parseInt(h.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * chan(0) + 0.7152 * chan(2) + 0.0722 * chan(4);
}

function contrast(a, b) {
  const la = relLuminance(a);
  const lb = relLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

// Readable label color for a slice fill: whichever of ink/paper contrasts more.
// A true contrast comparison (not a luminance threshold) keeps medium-tone
// fills like the mono palette's mid-greens legible.
export function labelColor(hex) {
  return contrast(hex, INK) > contrast(hex, PAPER) ? INK : PAPER;
}
