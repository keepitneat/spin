// theme.js
/* Three-state theme (system / light / dark). Pure helpers — no DOM, no
 * localStorage; callers own persistence + the document attribute.
 * The FOUC inline script in index.html reimplements this rule by hand
 * (it runs before modules load). Keep THEME_STATES in sync there. */

export const THEME_STATES = ['system', 'light', 'dark'];

export function normalizeTheme(value) {
  return THEME_STATES.includes(value) ? value : 'system';
}

export function themeAttr(state) {
  const normalized = normalizeTheme(state);
  return normalized === 'system' ? null : normalized;
}
