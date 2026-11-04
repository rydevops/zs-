// sfx.js — sound-effect recipes, synthesized at startup with synth.js.
import { Biquad, Saw, rng, TAU, kick, metal, snare } from './synth.js';

const L = (s, sr) => Math.ceil(s * sr);
const noiseHit = (sr, dur, { lp = 8000, hp = 60, decay = 20, seed = 1, gain = 1, bp = 0, q = 1 } = {}) => {
  const n = L(dur, sr), o = new Float32Array(n), R = rng(seed);
  const f1 = new Biquad('lp', lp, 0.7, sr), f2 = new Biquad('hp', hp, 0.7, sr), f3 = bp ? new Biquad('bp', bp, q, sr) : null;
  for (let i = 0; i < n; i++) {
    let v = f2.p(f1.p(R() * 2 - 1));
    if (f3) v = f3.p(v) * 2;
    o[i] = v * Math.exp(-(i / sr) * decay) * gain;
  }
  return o;
};
const add = (a, b, g = 1, at = 0, sr = 44100) => {
  const s = Math.floor(at * sr);
  for (let i = 0; i < b.length && s + i < a.length; i++) a[s + i] += b[i] * g;
  return a;
};
const tone = (sr, dur, f0, f1, decay, type = 'sin', gain = 1) => {
  const n = L(dur, sr), o = new Float32Array(n); let ph = 0; const saw = new Saw();
  for (let i = 0; i < n; i++) {
    const t = i / sr, f = f1 + (f0 - f1) * Math.exp(-t * 8 / dur);
    ph += f / sr;
    const v = type === 'saw' ? saw.p(f, sr) : type === 'sq' ? (Math.sin(TAU * ph) > 0 ? 1 : -1) : Math.sin(TAU * ph);
    o[i] = v * Math.exp(-t * decay) * gain;
  }
  return o;
};
const fade = (o, sr, a = 0.004, r = 0.02) => {
  const na = L(a, sr), nr = L(r, sr);
  for (let i = 0; i < na && i < o.length; i++) o[i] *= i / na;
  for (let i = 0; i < nr && i < o.length; i++) o[o.length - 1 - i] *= i / nr;
  return o;
};
const shape = (o, k) => { for (let i = 0; i < o.length; i++) o[i] = Math.tanh(o[i] * k) / Math.tanh(k); return o; };

function groan(sr, { f = 95, dur = 1.2, seed = 1, rasp = 0.5, formant = 500, gain = 1, rise = 0 }) {
  const n = L(dur, sr), o = new Float32Array(n), R = rng(seed), saw = new Saw(R());
  const b1 = new Biquad('bp', formant, 4, sr), b2 = new Biquad('bp', formant * 2.3, 6, sr), lp = new Biquad('lp', 2200, 0.7, sr);
  const p = R() * TAU;
  for (let i = 0; i < n; i++) {
    const t = i / sr, u = t / dur;
    const ff = f * (1 + rise * u + 0.06 * Math.sin(p + TAU * 3.3 * t) + 0.04 * (R() - 0.5));
    if ((i & 63) === 0) { b1.set(formant * (0.8 + 0.4 * Math.sin(Math.PI * u))); }
    const s = saw.p(ff, sr) + (R() * 2 - 1) * rasp;
    const e = Math.sin(Math.PI * Math.min(1, u * 1.15)) ** 0.7;
    o[i] = lp.p(b1.p(s) + 0.5 * b2.p(s)) * e * gain * 2.2;
  }
  return o;
}

export const SFX = {
  pistol(sr) {
    const o = noiseHit(sr, 0.45, { lp: 9000, hp: 500, decay: 34, seed: 11, gain: 1 });
    add(o, tone(sr, 0.12, 900, 160, 45), 0.6);
    add(o, noiseHit(sr, 0.45, { lp: 1600, hp: 80, decay: 9, seed: 12, gain: 0.35 }), 1);
    return fade(shape(o, 2.2), sr, 0.0005, 0.05);
  },
  shotgun(sr) {
    const o = noiseHit(sr, 0.8, { lp: 4200, hp: 60, decay: 13, seed: 21, gain: 1.1 });
    add(o, kick(sr, 1, 22), 0.9);
    add(o, noiseHit(sr, 0.8, { lp: 900, hp: 40, decay: 5, seed: 23, gain: 0.5 }), 1);
    return fade(shape(o, 2.6), sr, 0.0005, 0.08);
  },
  swing(sr) {
    const n = L(0.25, sr), o = new Float32Array(n), R = rng(31), bp = new Biquad('bp', 600, 2, sr);
    for (let i = 0; i < n; i++) { const t = i / sr, u = t / 0.25; bp.set(500 + 1800 * u, 2); o[i] = bp.p(R() * 2 - 1) * Math.sin(Math.PI * u) * 1.4; }
    return o;
  },
  thud(sr) { // crowbar on flesh
    const o = add(tone(sr, 0.22, 160, 60, 22, 'sin', 0.9), noiseHit(sr, 0.2, { lp: 1800, decay: 30, seed: 41, gain: 0.7 }));
    return fade(shape(o, 1.8), sr);
  },
  wet(sr) { // wet impact
    const o = noiseHit(sr, 0.25, { lp: 2400, hp: 150, decay: 22, seed: 51, gain: 0.9, bp: 900, q: 1.2 });
    add(o, tone(sr, 0.15, 220, 90, 30, 'sin', 0.6));
    return fade(o, sr);
  },
  ricochet(sr) { return fade(add(noiseHit(sr, 0.18, { hp: 2000, decay: 30, seed: 55, gain: 0.5 }), tone(sr, 0.18, 2400, 1700, 18, 'sin', 0.25)), sr); },
  click(sr) { return fade(noiseHit(sr, 0.04, { hp: 2500, decay: 120, seed: 61, gain: 0.8 }), sr, 0.0005, 0.01); },
  reload(sr) {
    const o = new Float32Array(L(0.9, sr));
    add(o, noiseHit(sr, 0.05, { hp: 1500, bp: 3200, q: 3, decay: 90, seed: 62, gain: 1 }), 1, 0.05, sr);
    add(o, noiseHit(sr, 0.07, { hp: 900, bp: 1800, q: 3, decay: 70, seed: 63, gain: 1 }), 1, 0.55, sr);
    add(o, noiseHit(sr, 0.05, { hp: 2000, bp: 4200, q: 4, decay: 110, seed: 64, gain: 0.9 }), 1, 0.78, sr);
    return o;
  },
  shell(sr) {
    const o = new Float32Array(L(0.3, sr));
    add(o, noiseHit(sr, 0.06, { hp: 800, bp: 1400, q: 3, decay: 80, seed: 65, gain: 1 }), 1, 0, sr);
    add(o, tone(sr, 0.08, 500, 300, 50, 'sin', 0.25), 1, 0.01, sr);
    return o;
  },
  pump(sr) {
    const o = new Float32Array(L(0.45, sr));
    add(o, noiseHit(sr, 0.08, { hp: 600, bp: 1200, q: 2, decay: 60, seed: 66, gain: 1.2 }), 1, 0, sr);
    add(o, noiseHit(sr, 0.08, { hp: 900, bp: 2000, q: 2, decay: 60, seed: 67, gain: 1.2 }), 1, 0.2, sr);
    return o;
  },
  pickup(sr) {
    const o = new Float32Array(L(0.4, sr));
    add(o, tone(sr, 0.18, 880, 880, 18, 'sin', 0.35), 1, 0, sr);
    add(o, tone(sr, 0.25, 1320, 1320, 14, 'sin', 0.3), 1, 0.07, sr);
    return o;
  },
  ammo(sr) {
    const o = new Float32Array(L(0.35, sr));
    for (let k = 0; k < 3; k++) add(o, noiseHit(sr, 0.05, { hp: 1800, bp: 3500 + k * 400, q: 4, decay: 90, seed: 70 + k, gain: 0.8 }), 1, k * 0.06, sr);
    return o;
  },
  heal(sr) {
    const n = L(0.7, sr), o = new Float32Array(n), R = rng(80), bp = new Biquad('bp', 2500, 1.5, sr);
    for (let i = 0; i < n; i++) { const t = i / sr; o[i] = bp.p(R() * 2 - 1) * (0.5 + 0.5 * Math.sin(TAU * 9 * t)) * Math.sin(Math.PI * t / 0.7) * 0.6; }
    add(o, tone(sr, 0.4, 660, 660, 8, 'sin', 0.15), 1, 0.3, sr);
    return o;
  },
  hurt(sr) {
    const o = groan(sr, { f: 150, dur: 0.28, seed: 90, rasp: 0.2, formant: 650, gain: 0.8, rise: -0.3 });
    add(o, tone(sr, 0.2, 120, 55, 20, 'sin', 0.8));
    return fade(o, sr);
  },
  death(sr) {
    const o = groan(sr, { f: 130, dur: 1.1, seed: 91, rasp: 0.3, formant: 600, gain: 0.9, rise: -0.5 });
    add(o, kick(sr, 1, 92), 0.7);
    return fade(o, sr);
  },
  roll(sr) {
    const n = L(0.4, sr), o = new Float32Array(n), R = rng(95), lp = new Biquad('lp', 900, 0.7, sr);
    for (let i = 0; i < n; i++) { const u = i / n; o[i] = lp.p(R() * 2 - 1) * Math.sin(Math.PI * u) * 1.2; }
    return o;
  },
  step(sr) { return fade(noiseHit(sr, 0.07, { lp: 900, hp: 100, decay: 60, seed: 96, gain: 0.5 }), sr); },
  walker0: (sr) => groan(sr, { f: 82, dur: 1.4, seed: 100, rasp: 0.6, formant: 420, gain: 1 }),
  walker1: (sr) => groan(sr, { f: 74, dur: 1.7, seed: 101, rasp: 0.7, formant: 380, gain: 1, rise: -0.15 }),
  walker2: (sr) => groan(sr, { f: 90, dur: 1.1, seed: 102, rasp: 0.5, formant: 460, gain: 1, rise: 0.1 }),
  runner0: (sr) => groan(sr, { f: 260, dur: 0.7, seed: 110, rasp: 1.4, formant: 1300, gain: 0.9, rise: 0.4 }),
  runner1: (sr) => groan(sr, { f: 300, dur: 0.5, seed: 111, rasp: 1.6, formant: 1500, gain: 0.9, rise: -0.2 }),
  brute(sr) {
    const o = groan(sr, { f: 48, dur: 1.8, seed: 120, rasp: 0.9, formant: 300, gain: 1.4 });
    add(o, groan(sr, { f: 97, dur: 1.8, seed: 121, rasp: 0.6, formant: 520, gain: 0.5 }));
    return shape(o, 1.6);
  },
  bruteRoar(sr) {
    const o = groan(sr, { f: 55, dur: 1.1, seed: 122, rasp: 1.2, formant: 340, gain: 1.6, rise: 0.5 });
    add(o, groan(sr, { f: 110, dur: 1.1, seed: 123, rasp: 0.9, formant: 700, gain: 0.8, rise: 0.5 }));
    return shape(o, 2);
  },
  slam(sr) {
    const o = kick(sr, 1, 130);
    add(o, metal(sr, 70, 0.6, 131, 1.2), 0.5);
    add(o, noiseHit(sr, 0.8, { lp: 700, decay: 6, seed: 132, gain: 0.7 }));
    return fade(shape(o, 2), sr);
  },
  zdeath(sr) {
    const o = groan(sr, { f: 70, dur: 0.8, seed: 140, rasp: 0.8, formant: 380, gain: 0.9, rise: -0.6 });
    add(o, noiseHit(sr, 0.3, { lp: 600, decay: 14, seed: 141, gain: 0.6 }), 1, 0.45, sr);
    return fade(o, sr);
  },
  door(sr) {
    const n = L(0.9, sr), o = new Float32Array(n), R = rng(150);
    const b = new Biquad('bp', 900, 12, sr);
    for (let i = 0; i < n; i++) {
      const t = i / sr;
      b.set(700 + 500 * Math.sin(t * 7) + 200 * Math.sin(t * 31), 14);
      o[i] = b.p((R() * 2 - 1) * (0.5 + 0.5 * Math.sin(TAU * 38 * t))) * Math.sin(Math.PI * t / 0.9) * 2.5;
    }
    add(o, kick(sr, 0.5, 151), 0.3, 0.75, sr);
    return o;
  },
  alarm(sr) { // 2 s two-tone car alarm, seamless loop
    const n = L(2, sr), o = new Float32Array(n); let ph = 0;
    for (let i = 0; i < n; i++) {
      const t = i / sr;
      const f = Math.floor(t * 4) % 2 ? 1250 : 900;
      ph += f / sr;
      o[i] = (Math.sin(TAU * ph) > 0 ? 1 : -1) * 0.25 + Math.sin(TAU * ph * 2) * 0.1;
    }
    const lp = new Biquad('lp', 3000, 0.7, sr);
    for (let i = 0; i < n; i++) o[i] = lp.p(o[i]);
    return o;
  },
  generator(sr) { // 1 s seamless engine loop; pitch raised at runtime
    const n = L(1, sr), o = new Float32Array(n), R = rng(160), lp = new Biquad('lp', 700, 1.5, sr);
    for (let i = 0; i < n; i++) {
      const t = i / sr;
      let v = 0;
      for (let h = 1; h <= 6; h++) v += Math.sin(TAU * 30 * h * t + h) / h;
      v += Math.sin(TAU * 240 * t) * 0.15 + (R() * 2 - 1) * 0.15;
      o[i] = lp.p(v) * 0.6 * (0.85 + 0.15 * Math.sin(TAU * 10 * t));
    }
    return o;
  },
  genStart(sr) {
    const n = L(1.6, sr), o = new Float32Array(n), R = rng(161), lp = new Biquad('lp', 500, 1, sr);
    for (let i = 0; i < n; i++) {
      const t = i / sr, ch = Math.sin(TAU * (8 + t * 14) * t) > 0.3 ? 1 : 0.3;
      o[i] = lp.p((R() * 2 - 1) * ch + Math.sin(TAU * (20 + t * 10) * t)) * Math.min(1, t * 3) * Math.exp(-Math.max(0, t - 1.2) * 6);
    }
    return o;
  },
  gate(sr) {
    const o = new Float32Array(L(2.2, sr));
    for (let k = 0; k < 14; k++) add(o, metal(sr, 180 + (k % 3) * 40, 0.3, 170 + k, 0.4), 0.25, k * 0.12, sr);
    add(o, kick(sr, 0.9, 171), 0.6, 1.9, sr);
    return o;
  },
  objective(sr) {
    const o = new Float32Array(L(1.2, sr));
    [587, 698, 880].forEach((f, k) => add(o, tone(sr, 0.8, f, f, 4, 'sin', 0.22), 1, k * 0.11, sr));
    return o;
  },
  checkpoint(sr) {
    const o = new Float32Array(L(1.4, sr));
    [440, 554, 659, 880].forEach((f, k) => add(o, tone(sr, 0.9, f, f, 3.5, 'sin', 0.18), 1, k * 0.09, sr));
    return o;
  },
  wave(sr) {
    const o = add(kick(sr, 1, 180), metal(sr, 87, 0.7, 181, 2), 0.5);
    add(o, snare(sr, 0.8, 182, 5), 0.4);
    return o;
  },
  ui(sr) { return fade(tone(sr, 0.06, 1200, 1200, 40, 'sin', 0.3), sr); },
  cache(sr) {
    const o = new Float32Array(L(1, sr));
    add(o, noiseHit(sr, 0.2, { lp: 1500, decay: 20, seed: 190, gain: 0.6 }), 1, 0, sr);
    [523, 659, 784, 1046].forEach((f, k) => add(o, tone(sr, 0.5, f, f, 6, 'sin', 0.16), 1, 0.12 + k * 0.07, sr));
    return o;
  },
  heartbeat(sr) {
    const o = new Float32Array(L(0.6, sr));
    add(o, tone(sr, 0.2, 75, 40, 18, 'sin', 1), 1, 0, sr);
    add(o, tone(sr, 0.2, 70, 40, 18, 'sin', 0.6), 1, 0.2, sr);
    return o;
  },
};
