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

const FONT = 9;        // label font size
const LINE_H = 10;     // line height for wrapped labels
const MAX_CHARS = 12;  // wrap target — words past this start a new line
const MAX_LINE_PX = 76; // hard width cap; longer lines get compressed to fit

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
// means no rotation (used for the single-item disc).
function renderLabel(label, x, y, fill, rotateDeg) {
  const lines = wrapLabel(label, MAX_CHARS);
  const firstDy = -((lines.length - 1) / 2) * LINE_H;
  const xs = x.toFixed(2);
  const tspans = lines.map((line, i) => {
    const dy = (i === 0 ? firstDy : LINE_H).toFixed(1);
    const tooWide = line.length * FONT * 0.6 > MAX_LINE_PX;
    const fit = tooWide ? ` textLength="${MAX_LINE_PX}" lengthAdjust="spacingAndGlyphs"` : '';
    return `<tspan x="${xs}" dy="${dy}"${fit}>${escapeXML(line)}</tspan>`;
  }).join('');
  const transform = rotateDeg == null
    ? ''
    : ` transform="rotate(${rotateDeg.toFixed(1)} ${xs} ${y.toFixed(2)})"`;
  return (
    `<text x="${xs}" y="${y.toFixed(2)}" fill="${fill}" font-size="${FONT}" ` +
    `font-family="-apple-system,sans-serif" text-anchor="middle" ` +
    `dominant-baseline="middle"${transform}>${tspans}</text>`
  );
}

export function buildWheelSVG(items, paletteName) {
  const weights = items.map((it) => it.weight || 1);
  const angles = items.length ? sliceAngles(weights) : [];

  const slices = angles.map((seg, i) => {
    const fill = colorForSlice(paletteName, i);
    const label = items[i].label;
    if (seg.end - seg.start >= 360) {
      // Single-item wheel: SVG drops degenerate 360° arcs, so use a full disc instead.
      return (
        `<circle r="${R}" fill="${fill}" stroke="#fff" stroke-width="2"/>` +
        renderLabel(label, 0, -LABEL_R, labelColor(fill), null)
      );
    }
    const mid = (seg.start + seg.end) / 2;
    const labelPos = polarToXY(LABEL_R, mid);
    const rot = mid > 180 ? mid - 270 : mid - 90; // keep text upright-ish
    return (
      `<path d="${slicePath(seg.start, seg.end)}" fill="${fill}" ` +
      `stroke="#fff" stroke-width="2"/>` +
      renderLabel(label, labelPos.x, labelPos.y, labelColor(fill), rot)
    );
  }).join('');

  return (
    `<g class="wheel-rotor" filter="url(#wsh)">` +
    slices +
    `<circle r="${R}" fill="url(#sheen)"/>` +
    `<circle r="13" fill="#fff" stroke="#e5e7eb"/>` +
    `</g>`
  );
}
