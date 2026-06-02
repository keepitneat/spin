// parse.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseList } from './parse.js';

test('parseList: splits on newlines', () => {
  assert.deepEqual(parseList('Thai\nPizza\nTacos'), ['Thai', 'Pizza', 'Tacos']);
});

test('parseList: splits on commas', () => {
  assert.deepEqual(parseList('Thai, Pizza, Tacos'), ['Thai', 'Pizza', 'Tacos']);
});

test('parseList: mixes commas and newlines', () => {
  assert.deepEqual(parseList('Thai, Pizza\nTacos'), ['Thai', 'Pizza', 'Tacos']);
});

test('parseList: trims whitespace and drops empty tokens', () => {
  assert.deepEqual(parseList('  Thai ,\n\n , Pizza ,'), ['Thai', 'Pizza']);
});

test('parseList: keeps duplicates', () => {
  assert.deepEqual(parseList('Pizza\nPizza'), ['Pizza', 'Pizza']);
});

test('parseList: empty input yields empty array', () => {
  assert.deepEqual(parseList(''), []);
  assert.deepEqual(parseList('   '), []);
});
