// picker.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickIndex, removeAt, moveItem, cryptoRandom } from './picker.js';

test('pickIndex: equal weights select by proportional band', () => {
  assert.equal(pickIndex([1, 1, 1, 1], () => 0.0), 0);
  assert.equal(pickIndex([1, 1, 1, 1], () => 0.3), 1);
  assert.equal(pickIndex([1, 1, 1, 1], () => 0.6), 2);
  assert.equal(pickIndex([1, 1, 1, 1], () => 0.99), 3);
});

test('pickIndex: respects unequal weights', () => {
  assert.equal(pickIndex([3, 1], () => 0.74), 0);
  assert.equal(pickIndex([3, 1], () => 0.76), 1);
});

test('pickIndex: r at the very top still returns the last index', () => {
  assert.equal(pickIndex([1, 1], () => 1 - Number.EPSILON), 1);
});

test('pickIndex: single weight always returns 0', () => {
  assert.equal(pickIndex([5], () => 0.999), 0);
});

test('removeAt: returns a new array without the index', () => {
  const items = ['a', 'b', 'c'];
  assert.deepEqual(removeAt(items, 1), ['a', 'c']);
  assert.deepEqual(items, ['a', 'b', 'c']);
});

test('moveItem: relocates an item and leaves the original untouched', () => {
  const items = ['a', 'b', 'c'];
  assert.deepEqual(moveItem(items, 0, 2), ['b', 'c', 'a']);
  assert.deepEqual(moveItem(items, 2, 0), ['c', 'a', 'b']);
  assert.deepEqual(items, ['a', 'b', 'c']);
});

test('cryptoRandom: returns a float in [0,1)', () => {
  for (let i = 0; i < 100; i++) {
    const r = cryptoRandom();
    assert.ok(r >= 0 && r < 1, `out of range: ${r}`);
  }
});
