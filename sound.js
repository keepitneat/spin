// sound.js — tiny Web Audio synthesis for the spin. No audio files, no network,
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

// A single tone with a short attack (no click) and exponential decay.
function tone(freq, durSec, { type = 'sine', gain = 0.05, delay = 0 } = {}) {
  const a = audio();
  if (!a) return;
  const t0 = a.currentTime + delay;
  const osc = a.createOscillator();
  const g = a.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.004); // 4ms attack
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + durSec);
  osc.connect(g).connect(a.destination);
  osc.start(t0);
  osc.stop(t0 + durSec + 0.02);
}

// A peg passing the pointer — a woodblock "tok": a pitched triangle body that
// drops quickly in pitch, with a very fast percussive decay.
export function tick() {
  const a = audio();
  if (!a) return;
  const t0 = a.currentTime;
  const osc = a.createOscillator();
  const g = a.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(1080, t0);
  osc.frequency.exponentialRampToValueAtTime(560, t0 + 0.028); // pitch drop = woody "tok"
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(0.22, t0 + 0.002); // sharp attack
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.06); // fast decay
  osc.connect(g).connect(a.destination);
  osc.start(t0);
  osc.stop(t0 + 0.08);
}

// A bell: a strike built from inharmonic partials (the metallic ratios real
// bells ring at), each with its own decay, over a long tail.
export function ding() {
  const a = audio();
  if (!a) return;
  const fundamental = 587; // ~D5
  // ratio, relative loudness, relative decay length
  const partials = [
    [1.0, 1.0, 1.0],
    [2.0, 0.55, 0.85],
    [2.76, 0.45, 0.7], // the characteristic "clang" partial
    [4.07, 0.3, 0.5],
    [5.43, 0.2, 0.4],
  ];
  const base = 1.6; // seconds of tail
  for (const [ratio, loud, decay] of partials) {
    tone(fundamental * ratio, base * decay, { type: 'sine', gain: 0.16 * loud });
  }
}

// Resume the context within a user gesture (so later programmatic sounds play).
export function unlock() {
  audio();
}
