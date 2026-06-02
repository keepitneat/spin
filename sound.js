// sound.js — tiny Web Audio blips for the spin. No audio files, no network,
// works offline. The AudioContext is created lazily on first use (after a user
// gesture) to satisfy browser autoplay policies. Callers own the on/off state.

let ctx = null;

function audio() {
  if (!ctx) {
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

// A single short tone that fades out.
function blip(freq, durMs, type = 'square', gain = 0.05) {
  const a = audio();
  if (!a) return;
  const osc = a.createOscillator();
  const g = a.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  g.gain.setValueAtTime(gain, a.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + durMs / 1000);
  osc.connect(g).connect(a.destination);
  osc.start();
  osc.stop(a.currentTime + durMs / 1000);
}

// A peg passing the pointer.
export function tick() {
  blip(1100, 28, 'square', 0.03);
}

// A two-note chime when the wheel lands on the winner.
export function ding() {
  blip(660, 180, 'sine', 0.09);
  setTimeout(() => blip(988, 280, 'sine', 0.08), 90);
}

// Resume the context within a user gesture (so later programmatic sounds play).
export function unlock() {
  audio();
}
