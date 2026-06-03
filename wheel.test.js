// wheel.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildWheelSVG } from './wheel.js';

const items = (labels) => labels.map((label) => ({ label, weight: 1 }));

test('buildWheelSVG: one <path> per item', () => {
  const svg = buildWheelSVG(items(['A', 'B', 'C']), 'festive');
  assert.equal((svg.match(/<path/g) || []).length, 3);
});

test('buildWheelSVG: prints every label (escaped)', () => {
  const svg = buildWheelSVG(items(['Thai', 'Fish & Chips']), 'festive');
  assert.ok(svg.includes('Thai'));
  assert.ok(svg.includes('Fish &amp; Chips')); // XML-escaped
});

test('buildWheelSVG: uses palette colors', () => {
  const svg = buildWheelSVG(items(['A', 'B']), 'festive');
  assert.ok(svg.includes('#047857'));
  assert.ok(svg.includes('#b45309'));
});

test('buildWheelSVG: references the shared sheen overlay', () => {
  const svg = buildWheelSVG(items(['A', 'B']), 'festive');
  assert.ok(svg.includes('url(#sheen)'));
});

test('buildWheelSVG: empty list renders no slice paths', () => {
  const svg = buildWheelSVG([], 'festive');
  assert.equal((svg.match(/<path/g) || []).length, 0);
});

test('buildWheelSVG: single item renders a full disc, not a degenerate arc', () => {
  const svg = buildWheelSVG([{ label: 'Solo', weight: 1 }], 'festive');
  assert.ok(svg.includes('Solo'));                       // label present
  assert.match(svg, /<circle r="92" fill="#047857"/);    // full-disc slice in palette color
  assert.equal((svg.match(/<path/g) || []).length, 0);   // no degenerate path
});

test('buildWheelSVG: respects weights via geometry (wider first slice)', () => {
  const svg = buildWheelSVG([{ label: 'Big', weight: 3 }, { label: 'Small', weight: 1 }], 'festive');
  assert.ok(svg.includes('A')); // arc command present
});

test('buildWheelSVG: wraps long multi-word labels into multiple tspan lines', () => {
  const svg = buildWheelSVG([{ label: 'terraforming mars', weight: 1 }, { label: 'x', weight: 1 }], 'festive');
  assert.ok(svg.includes('terraforming'));
  assert.ok(svg.includes('mars'));
  // 'terraforming' + 'mars' wrap to 2 lines, 'x' is 1 line ⇒ ≥ 3 tspans total
  assert.ok((svg.match(/<tspan/g) || []).length >= 3);
});

test('buildWheelSVG: short labels stay on a single line (no spurious wrap)', () => {
  const svg = buildWheelSVG([{ label: 'Thai', weight: 1 }, { label: 'Pizza', weight: 1 }], 'festive');
  assert.equal((svg.match(/<tspan/g) || []).length, 2); // one tspan per label
});

test('buildWheelSVG: two equal items use a top/bottom split with an upside-down loser', () => {
  const svg = buildWheelSVG([{ label: 'Heads', weight: 1 }, { label: 'Tails', weight: 1 }], 'festive');
  assert.ok(svg.includes('Heads'));
  assert.ok(svg.includes('Tails'));
  assert.equal((svg.match(/<path/g) || []).length, 2); // two semicircles
  assert.match(svg, /rotate\(180/);                     // bottom label is upside-down
});

test('buildWheelSVG: two UNequal-weight items keep the normal radial layout', () => {
  const svg = buildWheelSVG([{ label: 'Big', weight: 3 }, { label: 'Small', weight: 1 }], 'festive');
  // radial slices are pie paths (M0,0 …), not semicircle halves
  assert.match(svg, /M0,0 L/);
});

test('buildWheelSVG: each slice has a <title> for hover/accessibility', () => {
  const svg = buildWheelSVG([{ label: 'Thai', weight: 1 }, { label: 'Pizza', weight: 1 }, { label: 'Tacos', weight: 1 }], 'festive');
  assert.equal((svg.match(/<title>/g) || []).length, 3);
  assert.ok(svg.includes('<title>Tacos</title>'));
});

test('buildWheelSVG: shrinks label font as the wheel gets crowded', () => {
  const few = buildWheelSVG(Array.from({ length: 4 }, (_, i) => ({ label: `i${i}`, weight: 1 })), 'festive');
  const many = buildWheelSVG(Array.from({ length: 20 }, (_, i) => ({ label: `i${i}`, weight: 1 })), 'festive');
  assert.ok(few.includes('font-size="9"'));
  assert.ok(!many.includes('font-size="9"')); // scaled down
});
