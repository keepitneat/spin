// palette.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PALETTES, PALETTE_NAMES, colorForSlice, normalizePalette, labelColor } from './palette.js';

test('PALETTE_NAMES lists the three modes in order', () => {
  assert.deepEqual(PALETTE_NAMES, ['festive', 'mono', 'bw']);
});

test('festive palette is the six locked jewel hues in wheel order', () => {
  assert.deepEqual(PALETTES.festive, [
    '#047857', '#b45309', '#4338ca', '#be123c', '#0e7490', '#7c3aed',
  ]);
});

test('colorForSlice cycles when there are more items than colors', () => {
  assert.equal(colorForSlice('festive', 0), '#047857');
  assert.equal(colorForSlice('festive', 6), '#047857'); // wraps
  assert.equal(colorForSlice('festive', 7), '#b45309');
});

test('normalizePalette falls back to festive for unknown values', () => {
  assert.equal(normalizePalette('mono'), 'mono');
  assert.equal(normalizePalette('rainbow'), 'festive');
  assert.equal(normalizePalette(null), 'festive');
});

test('labelColor: dark text on light slices, light text on dark slices', () => {
  assert.equal(labelColor('#f3f4f6'), '#111827'); // B&W paper → dark text
  assert.equal(labelColor('#111827'), '#ffffff'); // B&W ink → light text
  assert.equal(labelColor('#047857'), '#ffffff'); // emerald → light text
  assert.equal(labelColor('#b45309'), '#ffffff'); // amber → light text
});
