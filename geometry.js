// geometry.js
/* Wheel geometry. Pointer at top = 0°, angles clockwise. The wheel rotates
 * clockwise by R; the original angle under the pointer is (-R) mod 360.
 * winnerAt and rotationForWinner are exact inverses (see round-trip test). */

const norm360 = (deg) => ((deg % 360) + 360) % 360;

// Cumulative slice ranges in degrees, proportional to weights, starting at 0.
export function sliceAngles(weights) {
  const total = weights.reduce((sum, w) => sum + w, 0);
  const ranges = [];
  let start = 0;
  for (const w of weights) {
    const end = start + (w / total) * 360;
    ranges.push({ start, end });
    start = end;
  }
  return ranges;
}

// Which slice sits under the top pointer at the given rotation.
export function winnerAt(angles, rotation) {
  const p = norm360(-rotation);
  for (let i = 0; i < angles.length; i++) {
    if (p >= angles[i].start && p < angles[i].end) return i;
  }
  return angles.length - 1; // p === 360 edge / float safety
}

// Rotation (deg) that lands slice `index`'s midpoint under the pointer,
// after `turns` full clockwise spins.
export function rotationForWinner(angles, index, turns = 5) {
  const mid = (angles[index].start + angles[index].end) / 2;
  return turns * 360 + norm360(-mid);
}
