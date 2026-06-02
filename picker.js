// picker.js
/* Fair selection. The winner is chosen here FIRST (weighted random);
 * the animation is computed afterward to land on it, so the visual can
 * never disagree with the math. Equal weights ⇒ uniform. */

// Uniform float in [0, 1) backed by the platform CSPRNG.
export function cryptoRandom() {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0] / 2 ** 32;
}

// Weighted pick. `random` returns a float in [0,1); injectable for tests.
export function pickIndex(weights, random = cryptoRandom) {
  const total = weights.reduce((sum, w) => sum + w, 0);
  let r = random() * total;
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i];
    if (r < 0) return i;
  }
  return weights.length - 1; // floating-point safety net
}

// Immutable removal — used by remove-winner mode.
export function removeAt(items, index) {
  return items.filter((_, i) => i !== index);
}

// Immutable reorder — used by drag-to-reorder in the editor.
export function moveItem(items, from, to) {
  const copy = items.slice();
  const [moved] = copy.splice(from, 1);
  copy.splice(to, 0, moved);
  return copy;
}
