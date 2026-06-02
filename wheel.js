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

export function buildWheelSVG(items, paletteName) {
  const weights = items.map((it) => it.weight || 1);
  const angles = items.length ? sliceAngles(weights) : [];

  const slices = angles.map((seg, i) => {
    const fill = colorForSlice(paletteName, i);
    const mid = (seg.start + seg.end) / 2;
    const labelPos = polarToXY(LABEL_R, mid);
    const rot = mid > 180 ? mid - 270 : mid - 90; // keep text upright-ish
    return (
      `<path d="${slicePath(seg.start, seg.end)}" fill="${fill}" ` +
      `stroke="#fff" stroke-width="2"/>` +
      `<text x="${labelPos.x.toFixed(2)}" y="${labelPos.y.toFixed(2)}" ` +
      `fill="${labelColor(fill)}" font-size="9" font-family="-apple-system,sans-serif" ` +
      `text-anchor="middle" dominant-baseline="middle" ` +
      `transform="rotate(${rot.toFixed(1)} ${labelPos.x.toFixed(2)} ${labelPos.y.toFixed(2)})">` +
      `${escapeXML(seg.label ?? items[i].label)}</text>`
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
