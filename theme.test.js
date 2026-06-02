// theme.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { THEME_STATES, normalizeTheme, themeAttr } from './theme.js';

test('normalizeTheme: passes through each known state', () => {
  for (const state of THEME_STATES) assert.equal(normalizeTheme(state), state);
});

test('normalizeTheme: null / undefined / empty fall back to system', () => {
  assert.equal(normalizeTheme(null), 'system');
  assert.equal(normalizeTheme(undefined), 'system');
  assert.equal(normalizeTheme(''), 'system');
});

test('normalizeTheme: unknown / stale values fall back to system', () => {
  assert.equal(normalizeTheme('sepia'), 'system');
  assert.equal(normalizeTheme('DARK'), 'system');
});

test('themeAttr: system yields null', () => {
  assert.equal(themeAttr('system'), null);
});

test('themeAttr: light / dark yield their own name', () => {
  assert.equal(themeAttr('light'), 'light');
  assert.equal(themeAttr('dark'), 'dark');
});

test('themeAttr: unknown values fall back to system → null', () => {
  assert.equal(themeAttr('bogus'), null);
});
