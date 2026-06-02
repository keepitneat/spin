// geometry.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sliceAngles, winnerAt, rotationForWinner } from './geometry.js';

test('sliceAngles: equal weights divide 360 evenly', () => {
  const a = sliceAngles([1, 1, 1, 1]);
  assert.deepEqual(a, [
    { start: 0, end: 90 },
    { start: 90, end: 180 },
    { start: 180, end: 270 },
    { start: 270, end: 360 },
  ]);
});

test('sliceAngles: unequal weights are proportional', () => {
  const a = sliceAngles([3, 1]);
  assert.deepEqual(a, [
    { start: 0, end: 270 },
    { start: 270, end: 360 },
  ]);
});

test('winnerAt: rotation 0 points at the first slice', () => {
  const a = sliceAngles([1, 1, 1, 1]);
  assert.equal(winnerAt(a, 0), 0);
});

test('winnerAt: normalizes large and negative rotations', () => {
  const a = sliceAngles([1, 1, 1, 1]);
  assert.equal(winnerAt(a, 90), 3);
  assert.equal(winnerAt(a, 360 * 5 + 90), 3);
});

test('rotationForWinner / winnerAt round-trip for every slice', () => {
  const a = sliceAngles([1, 2, 3, 4, 5]);
  for (let i = 0; i < a.length; i++) {
    const r = rotationForWinner(a, i, 5);
    assert.equal(winnerAt(a, r), i, `slice ${i} round-trip failed`);
  }
});

test('rotationForWinner: includes the requested number of full turns', () => {
  const a = sliceAngles([1, 1]);
  const r = rotationForWinner(a, 0, 5);
  assert.ok(r >= 360 * 5, `expected >= 1800, got ${r}`);
});
