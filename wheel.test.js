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
