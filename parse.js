// parse.js
/* Paste-list parsing: turn a pasted block into clean item labels.
 * Split on any run of newlines and/or commas, trim, drop blanks.
 * Duplicates are intentionally preserved. */

export function parseList(text) {
  if (!text) return [];
  return text
    .split(/[\n,]+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 0);
}
