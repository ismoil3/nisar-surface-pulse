// "Hear the pulse": every satellite pass is one heartbeat (Web Audio, no files).
// The beat is louder when more of the surface changed since the previous pass,
// and a soft tone rises or falls with the measured value (higher = more water / more plants).
let ctx = null;

/** Sound is off until the visitor turns it on; the choice is remembered. */
export const soundSaved = () => { try { return localStorage.getItem("nsp_sound") === "1"; } catch { return false; } };
export const saveSound = (on) => { try { localStorage.setItem("nsp_sound", on ? "1" : "0"); } catch { /* ignore */ } };

/** Must be called from a click (browsers only start audio after a user gesture). */
export function unlockSound() {
  try {
    ctx ??= new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === "suspended") ctx.resume();
  } catch { ctx = null; }
  return !!ctx;
}

function thump(at, gain, f0) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = "sine";
  o.frequency.setValueAtTime(f0, at);
  o.frequency.exponentialRampToValueAtTime(f0 * 0.45, at + 0.16);
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(gain, at + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, at + 0.24);
  o.connect(g).connect(ctx.destination);
  o.start(at);
  o.stop(at + 0.26);
}

/**
 * One heartbeat. strength 0..1 = how much changed since the last pass (loudness);
 * level 0..1 = where the measured value sits between its lowest and highest (pitch of the tone), or null.
 */
export function beat(strength = 0.5, level = null) {
  if (!ctx || ctx.state !== "running") return;
  const s = Math.min(1, Math.max(0, strength)), at = ctx.currentTime + 0.01;
  thump(at, 0.25 + 0.6 * s, 92);
  thump(at + 0.17, 0.16 + 0.4 * s, 70);
  if (level == null) return;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = "triangle";
  o.frequency.value = 220 * Math.pow(2, Math.min(1, Math.max(0, level)) * 1.0); // one octave: A3..A4
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(0.07, at + 0.04);
  g.gain.exponentialRampToValueAtTime(0.0001, at + 0.5);
  o.connect(g).connect(ctx.destination);
  o.start(at);
  o.stop(at + 0.55);
}

/** 0..1 position of each value between the series' minimum and maximum (null stays null). */
export function levels(values) {
  const ok = values.filter((v) => v != null);
  const lo = Math.min(...ok), hi = Math.max(...ok);
  return values.map((v) => (v == null ? null : hi > lo ? (v - lo) / (hi - lo) : 0.5));
}

/** 0..1 strength of each step: |change from the previous value|, relative to the biggest step. */
export function strengths(values) {
  const d = values.map((v, i) => (i && v != null && values[i - 1] != null ? Math.abs(v - values[i - 1]) : null));
  const hi = Math.max(...d.filter((x) => x != null), 1e-9);
  return d.map((x) => (x == null ? 0.3 : 0.15 + 0.85 * (x / hi)));
}
