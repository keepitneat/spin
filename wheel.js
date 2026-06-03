// wheel.js
/* Builds the wheel as an SVG markup string from items + a palette.
 * Pure (no DOM) so it is unit-testable. Composes geometry.js + palette.js.
 * Shared <defs> (#sheen gradient, #wsh shadow) are declared in index.html. */

import { sliceAngles } from './geometry.js';
import { colorForSlice, labelColor } from './palette.js';

const R = 92;          // wheel radius in the 0..0 centered coordinate space
const LABEL_R = 58;    // radius at which labels are placed

const escapeXML = (s) =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

// Angle clockwise from top (12 o'clock). Returns {x, y} on a circle of radius r.
function polarToXY(r, angleDeg) {
  const rad = ((angleDeg - 90) * Math.PI) / 180; // -90: 0° points up
  return { x: r * Math.cos(rad), y: r * Math.sin(rad) };
}

function slicePath(start, end) {
  const a = polarToXY(R, start);
  const b = polarToXY(R, end);
  const largeArc = end - start > 180 ? 1 : 0;
  return `M0,0 L${a.x.toFixed(2)},${a.y.toFixed(2)} ` +
    `A${R},${R} 0 ${largeArc},1 ${b.x.toFixed(2)},${b.y.toFixed(2)} Z`;
}

const MAX_LINE_PX = 76; // hard width cap; longer lines get compressed to fit

// Label sizing scales down as the wheel gets more (thinner) slices, so labels
// stay inside their wedges instead of crowding.
function labelMetrics(n) {
  if (n <= 8) return { font: 9, lineH: 10, maxChars: 12 };
  if (n <= 14) return { font: 7.5, lineH: 8.5, maxChars: 10 };
  if (n <= 22) return { font: 6.5, lineH: 7.5, maxChars: 9 };
  return { font: 5.5, lineH: 6.5, maxChars: 8 };
}

// Greedily wrap a label into lines of at most maxChars (by whole words).
// A single word longer than the limit stays on its own line (then gets
// width-capped at render time).
function wrapLabel(label, maxChars) {
  const words = String(label).split(/\s+/).filter(Boolean);
  if (!words.length) return [String(label)];
  const lines = [];
  let line = '';
  for (const word of words) {
    if (!line) line = word;
    else if ((line + ' ' + word).length <= maxChars) line += ' ' + word;
    else { lines.push(line); line = word; }
  }
  lines.push(line);
  return lines;
}

// A <text> label, word-wrapped into centered <tspan> lines. `rotateDeg` null
// means no rotation (used for the single-item disc). `m` is labelMetrics().
function renderLabel(label, x, y, fill, rotateDeg, m) {
  const lines = wrapLabel(label, m.maxChars);
  const firstDy = -((lines.length - 1) / 2) * m.lineH;
  const xs = x.toFixed(2);
  const tspans = lines.map((line, i) => {
    const dy = (i === 0 ? firstDy : m.lineH).toFixed(1);
    const tooWide = line.length * m.font * 0.6 > MAX_LINE_PX;
    const fit = tooWide ? ` textLength="${MAX_LINE_PX}" lengthAdjust="spacingAndGlyphs"` : '';
    return `<tspan x="${xs}" dy="${dy}"${fit}>${escapeXML(line)}</tspan>`;
  }).join('');
  const transform = rotateDeg == null
    ? ''
    : ` transform="rotate(${rotateDeg.toFixed(1)} ${xs} ${y.toFixed(2)})"`;
  return (
    `<text x="${xs}" y="${y.toFixed(2)}" fill="${fill}" font-size="${m.font}" ` +
    `font-family="-apple-system,sans-serif" text-anchor="middle" ` +
    `dominant-baseline="middle"${transform}>${tspans}</text>`
  );
}

// Two equal items read best as top/bottom halves (a coin-flip layout): the top
// item upright, the bottom item upside-down — so a 180° spin lands either one
// upright under the pointer. Exposed so app.js can match the spin physics.
export function isTwoHalfLayout(weights) {
  return weights.length === 2 && weights[0] === weights[1];
}

// Wrap a slice's shape + label in a group whose <title> is the native hover
// tooltip (so the full name shows even when the printed label is wrapped/small).
function sliceGroup(label, shape, labelSvg) {
  return `<g><title>${escapeXML(label)}</title>${shape}${labelSvg}</g>`;
}

function twoHalfSlices(items, paletteName, m) {
  const c0 = colorForSlice(paletteName, 0);
  const c1 = colorForSlice(paletteName, 1);
  // Top semicircle (item 0) and bottom semicircle (item 1); horizontal divider.
  const top = `<path d="M${-R},0 A${R},${R} 0 0,1 ${R},0 Z" fill="${c0}" stroke="#fff" stroke-width="2"/>`;
  const bottom = `<path d="M${R},0 A${R},${R} 0 0,1 ${-R},0 Z" fill="${c1}" stroke="#fff" stroke-width="2"/>`;
  return (
    sliceGroup(items[0].label, top, renderLabel(items[0].label, 0, -LABEL_R, labelColor(c0), null, m)) +
    sliceGroup(items[1].label, bottom, renderLabel(items[1].label, 0, LABEL_R, labelColor(c1), 180, m))
  );
}

export function buildWheelSVG(items, paletteName) {
  const weights = items.map((it) => it.weight || 1);
  const m = labelMetrics(items.length || 1);

  let slices;
  if (isTwoHalfLayout(weights)) {
    slices = twoHalfSlices(items, paletteName, m);
  } else {
    const angles = items.length ? sliceAngles(weights) : [];
    slices = angles.map((seg, i) => {
      const fill = colorForSlice(paletteName, i);
      const label = items[i].label;
      if (seg.end - seg.start >= 360) {
        // Single-item wheel: SVG drops degenerate 360° arcs, so use a full disc instead.
        const disc = `<circle r="${R}" fill="${fill}" stroke="#fff" stroke-width="2"/>`;
        return sliceGroup(label, disc, renderLabel(label, 0, -LABEL_R, labelColor(fill), null, m));
      }
      const mid = (seg.start + seg.end) / 2;
      const labelPos = polarToXY(LABEL_R, mid);
      const rot = mid > 180 ? mid - 270 : mid - 90; // keep text upright-ish
      const path = `<path d="${slicePath(seg.start, seg.end)}" fill="${fill}" stroke="#fff" stroke-width="2"/>`;
      return sliceGroup(label, path, renderLabel(label, labelPos.x, labelPos.y, labelColor(fill), rot, m));
    }).join('');
  }

  return (
    `<g class="wheel-rotor" filter="url(#wsh)">` +
    slices +
    // Overlays sit on top of the slices — make them transparent to the pointer
    // so hovering a wedge reaches its <title> tooltip instead of the sheen.
    `<circle r="${R}" fill="url(#sheen)" pointer-events="none"/>` +
    `<circle r="13" fill="#fff" stroke="#e5e7eb" pointer-events="none"/>` +
    `</g>`
  );
}
