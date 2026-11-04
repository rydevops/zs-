// synth.js — a tiny offline DSP toolkit.
// Pure functions over Float32Arrays, no Web Audio or DOM dependencies, so the same
// code renders the music stems at build time (Node) and the sound effects at runtime
// (browser), and doubles as a fallback renderer if a music file fails to decode.

export const TAU = Math.PI * 2;
export const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

// Note names -> MIDI, e.g. n('D3') = 50, n('Bb2') = 46, n('C#4') = 61
const NOTE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
export function n(name) {
  const m = /^([A-G])([#b]?)(-?\d)$/.exec(name);
  if (!m) throw new Error('bad note ' + name);
  let v = NOTE[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
  return v + (parseInt(m[3], 10) + 1) * 12;
}
export const nf = (name) => mtof(n(name));

export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class Biquad {
  constructor(type, f, q, sr) {
    this.type = type; this.sr = sr;
    this.x1 = this.x2 = this.y1 = this.y2 = 0;
    this.set(f, q);
  }
  set(f, q = this.q) {
    this.q = q;
    const w = (TAU * Math.min(Math.max(f, 10), this.sr * 0.45)) / this.sr;
    const c = Math.cos(w), s = Math.sin(w), a = s / (2 * q);
    let b0, b1, b2;
    if (this.type === 'lp') { b0 = (1 - c) / 2; b1 = 1 - c; b2 = b0; }
    else if (this.type === 'hp') { b0 = (1 + c) / 2; b1 = -(1 + c); b2 = b0; }
    else { b0 = a; b1 = 0; b2 = -a; } // band-pass (constant 0 dB peak)
    const a0 = 1 + a;
    this.b0 = b0 / a0; this.b1 = b1 / a0; this.b2 = b2 / a0;
    this.a1 = (-2 * c) / a0; this.a2 = (1 - a) / a0;
  }
  p(x) {
    const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2;
    this.x2 = this.x1; this.x1 = x; this.y2 = this.y1; this.y1 = y;
    return y;
  }
}

function blep(t, dt) {
  if (t < dt) { t /= dt; return t + t - t * t - 1; }
  if (t > 1 - dt) { t = (t - 1) / dt; return t * t + t + t + 1; }
  return 0;
}

// Band-limited-ish saw oscillator with per-sample frequency.
export class Saw {
  constructor(phase = 0) { this.ph = phase; }
  p(f, sr) {
    const dt = f / sr;
    this.ph += dt; if (this.ph >= 1) this.ph -= 1;
    return 2 * this.ph - 1 - blep(this.ph, dt);
  }
}

export const env = {
  // attack/decay to sustain, release after `dur`
  adsr(t, dur, a, d, s, r) {
    if (t < 0) return 0;
    if (t < a) return t / a;
    if (t < a + d) return 1 - (1 - s) * ((t - a) / d);
    if (t < dur) return s;
    const rt = t - dur;
    return rt < r ? s * (1 - rt / r) : 0;
  },
};

const len = (sec, sr) => Math.max(1, Math.ceil(sec * sr));

// ---------- Percussion ----------
export function kick(sr, vel = 1, seed = 1) {
  const L = len(0.6, sr), o = new Float32Array(L), R = rng(seed);
  let ph = 0;
  for (let i = 0; i < L; i++) {
    const t = i / sr;
    const f = 42 + 120 * Math.exp(-t * 28);
    ph += f / sr;
    let v = Math.sin(TAU * ph) * Math.exp(-t * 6.5);
    v += (R() * 2 - 1) * Math.exp(-t * 260) * 0.35;
    o[i] = Math.tanh(v * 1.6) * vel;
  }
  return o;
}

export function tom(sr, f0 = 70, vel = 1, seed = 2, decay = 3.6) {
  const L = len(1.4, sr), o = new Float32Array(L), R = rng(seed);
  const lp = new Biquad('lp', 900, 0.7, sr);
  let ph = 0;
  for (let i = 0; i < L; i++) {
    const t = i / sr;
    const f = f0 * (1 + 0.7 * Math.exp(-t * 14));
    ph += f / sr;
    let v = Math.sin(TAU * ph) * Math.exp(-t * decay) + 0.25 * Math.sin(TAU * ph * 1.51) * Math.exp(-t * 7);
    v += lp.p(R() * 2 - 1) * Math.exp(-t * 22) * 0.5;
    o[i] = Math.tanh(v * 1.3) * vel;
  }
  return o;
}

export function snare(sr, vel = 1, seed = 3, tail = 14) {
  const L = len(0.45, sr), o = new Float32Array(L), R = rng(seed);
  const bp = new Biquad('bp', 2300, 0.6, sr), hp = new Biquad('hp', 400, 0.7, sr);
  for (let i = 0; i < L; i++) {
    const t = i / sr;
    const nz = hp.p(bp.p(R() * 2 - 1)) * Math.exp(-t * tail) * 2.2;
    const tone = Math.sin(TAU * 185 * t) * Math.exp(-t * 26) * 0.6;
    o[i] = (nz + tone) * vel;
  }
  return o;
}

export function hat(sr, vel = 1, open = false, seed = 4) {
  const L = len(open ? 0.5 : 0.08, sr), o = new Float32Array(L), R = rng(seed);
  const hp = new Biquad('hp', 7000, 0.8, sr), hp2 = new Biquad('hp', 5000, 0.7, sr);
  const k = open ? 7 : 55;
  for (let i = 0; i < L; i++) {
    const t = i / sr;
    o[i] = hp2.p(hp.p(R() * 2 - 1)) * Math.exp(-t * k) * vel;
  }
  return o;
}

export function metal(sr, f0 = 110, vel = 1, seed = 5, dur = 2.6) {
  const L = len(dur, sr), o = new Float32Array(L), R = rng(seed);
  const ratios = [1, 1.52, 2.76, 3.9, 5.4, 8.93];
  const decays = [1.4, 2.2, 2.8, 3.8, 5, 7];
  const ph = ratios.map(() => R());
  for (let i = 0; i < L; i++) {
    const t = i / sr;
    let v = 0;
    for (let k = 0; k < ratios.length; k++) v += Math.sin(TAU * (ph[k] + f0 * ratios[k] * t)) * Math.exp(-t * decays[k]) / (k + 1.5);
    v += (R() * 2 - 1) * Math.exp(-t * 60) * 0.4;
    o[i] = v * vel;
  }
  return o;
}

// ---------- Tonal ----------
function voiced(sr, freq, dur, opt) {
  const { voices = 5, detune = 12, attack = 0.4, release = 0.6, cutoff = 1400, cutEnv = 0, cutDecay = 6,
    q = 0.8, vib = 0.004, vibRate = 5, drive = 0, seed = 7, decay = 0, sustain = 1, cutoffEnd = null } = opt;
  const total = dur + release;
  const L = len(total, sr), o = new Float32Array(L), R = rng(seed);
  const osc = [], det = [];
  for (let v = 0; v < voices; v++) {
    osc.push(new Saw(R()));
    det.push(Math.pow(2, ((voices === 1 ? 0 : (v / (voices - 1)) * 2 - 1) * detune) / 1200));
  }
  const lp = new Biquad('lp', cutoff, q, sr), lp2 = new Biquad('lp', cutoff, 0.6, sr);
  const vibPh = R() * TAU;
  for (let i = 0; i < L; i++) {
    const t = i / sr;
    if ((i & 31) === 0) {
      let c = cutoff + cutEnv * Math.exp(-t * cutDecay);
      if (cutoffEnd !== null) c = cutoff + (cutoffEnd - cutoff) * Math.min(1, t / dur);
      lp.set(c); lp2.set(c * 1.2);
    }
    const vibAmt = vib * Math.min(1, t / 0.35);
    const fm = 1 + vibAmt * Math.sin(vibPh + TAU * vibRate * t);
    let s = 0;
    for (let v = 0; v < voices; v++) s += osc[v].p(freq * det[v] * fm, sr);
    s /= Math.sqrt(voices);
    let a;
    if (t < attack) a = t / attack;
    else if (t < dur) a = decay > 0 ? sustain + (1 - sustain) * Math.exp(-(t - attack) * decay) : 1;
    else a = (decay > 0 ? sustain + (1 - sustain) * Math.exp(-(dur - attack) * decay) : 1) * Math.max(0, 1 - (t - dur) / release);
    let y = lp2.p(lp.p(s)) * a;
    if (drive) y = Math.tanh(y * drive) / Math.tanh(drive);
    o[i] = y;
  }
  return o;
}

export const strings = (sr, f, dur, vel = 1, o = {}) => scale(voiced(sr, f, dur, { attack: 0.5, release: 0.9, cutoff: 1300, ...o }), vel * 0.5);
export const stacc = (sr, f, dur, vel = 1, o = {}) =>
  scale(voiced(sr, f, dur, { voices: 3, detune: 8, attack: 0.006, release: 0.1, cutoff: 900, cutEnv: 2600, cutDecay: 18, vib: 0, decay: 9, sustain: 0.25, ...o }), vel * 0.55);
export const brass = (sr, f, dur, vel = 1, o = {}) =>
  scale(voiced(sr, f, dur, { voices: 3, detune: 9, attack: 0.03, release: 0.25, cutoff: 350, cutEnv: 2200 * vel, cutDecay: 5, drive: 2.5, vib: 0.002, ...o }), vel * 0.5);

export function choir(sr, f, dur, vel = 1, seed = 9) {
  const src = voiced(sr, f, dur, { voices: 4, detune: 14, attack: 0.9, release: 1.2, cutoff: 3500, vib: 0.006, vibRate: 4.6, seed });
  const fm = [[730, 8, 1], [1090, 10, 0.5], [2440, 12, 0.22]];
  const o = new Float32Array(src.length);
  for (const [ff, q, g] of fm) {
    const bp = new Biquad('bp', ff, q, sr);
    for (let i = 0; i < src.length; i++) o[i] += bp.p(src[i]) * g;
  }
  return scale(o, vel * 1.6);
}

export function heartbeat(sr, vel = 1) {
  const L = len(0.7, sr), o = new Float32Array(L);
  const beat = (t0, g) => {
    let ph = 0;
    for (let i = Math.floor(t0 * sr); i < L; i++) {
      const t = i / sr - t0;
      ph += (40 + 45 * Math.exp(-t * 30)) / sr;
      o[i] += Math.sin(TAU * ph) * Math.exp(-t * 11) * g;
    }
  };
  beat(0, 1); beat(0.2, 0.65);
  return scale(o, vel);
}

// Sustained drone; rendered with fades so it can be folded into a seamless loop.
export function drone(sr, f, dur, vel = 1, seed = 11, bright = 420) {
  const L = len(dur, sr), o = new Float32Array(L), R = rng(seed);
  const a = new Saw(R()), b = new Saw(R()), c = new Saw(R());
  const lp = new Biquad('lp', bright, 1.2, sr);
  let sub = 0;
  for (let i = 0; i < L; i++) {
    const t = i / sr;
    if ((i & 63) === 0) lp.set(bright + bright * 0.5 * Math.sin(TAU * t / 10));
    sub += f * 0.5 / sr;
    const s = (a.p(f, sr) + b.p(f * 1.004, sr) + c.p(f * 0.997, sr)) / 3;
    o[i] = (lp.p(s) * 0.8 + Math.sin(TAU * sub) * 0.5) * vel;
  }
  return o;
}

// Filtered noise wind with slow gusts.
export function wind(sr, dur, seed = 21, vel = 1) {
  const L = len(dur, sr), o = new Float32Array(L), R = rng(seed);
  const bp = new Biquad('bp', 500, 1.2, sr), lp = new Biquad('lp', 260, 0.7, sr);
  const p1 = R() * TAU, p2 = R() * TAU, p3 = R() * TAU;
  for (let i = 0; i < L; i++) {
    const t = i / sr;
    const g = 0.55 + 0.25 * Math.sin(p1 + TAU * t / 7.3) + 0.2 * Math.sin(p2 + TAU * t / 3.1);
    if ((i & 63) === 0) bp.set(380 + 380 * g + 120 * Math.sin(p3 + TAU * t / 1.7), 1.4);
    const w = R() * 2 - 1;
    o[i] = (bp.p(w) * 0.9 * g + lp.p(w) * 0.6) * vel;
  }
  return o;
}

export function dogBarks(sr, count = 2, seed = 31, vel = 1) {
  const R = rng(seed);
  const L = len(count * 0.42 + 0.4, sr), o = new Float32Array(L);
  for (let k = 0; k < count; k++) {
    const t0 = k * (0.34 + R() * 0.12);
    const f0 = 330 + R() * 60;
    const saw = new Saw(R());
    const b1 = new Biquad('bp', 950, 3, sr), b2 = new Biquad('bp', 1900, 4, sr);
    const n0 = Math.floor(t0 * sr), n1 = Math.min(L, n0 + Math.floor(0.2 * sr));
    for (let i = n0; i < n1; i++) {
      const t = i / sr - t0;
      const f = f0 * (1 - 0.25 * t / 0.2);
      const s = saw.p(f, sr) * 0.7 + (R() * 2 - 1) * 0.5;
      const e = Math.min(1, t / 0.008) * Math.exp(-t * 16);
      o[i] += (b1.p(s) + 0.6 * b2.p(s)) * e * vel;
    }
  }
  const lp = new Biquad('lp', 1300, 0.7, sr);
  for (let i = 0; i < L; i++) o[i] = lp.p(o[i]) * 1.8;
  return o;
}

export function hum(sr, dur, seed = 41, vel = 1) {
  const L = len(dur, sr), o = new Float32Array(L), R = rng(seed);
  const lp = new Biquad('lp', 1100, 0.7, sr);
  let gate = 1, target = 1;
  for (let i = 0; i < L; i++) {
    const t = i / sr;
    if ((i & 1023) === 0) target = R() < 0.06 ? 0.15 : 1;
    gate += (target - gate) * 0.004;
    let s = 0;
    for (let h = 1; h <= 9; h++) s += Math.sin(TAU * 60 * h * t + h) / h;
    o[i] = lp.p(s * 0.3) * gate * vel;
  }
  return o;
}

// ---------- Mixing ----------
export function scale(a, g) { for (let i = 0; i < a.length; i++) a[i] *= g; return a; }

export class Mix {
  constructor(sec, sr) {
    this.sr = sr;
    this.L = new Float32Array(len(sec, sr));
    this.R = new Float32Array(len(sec, sr));
  }
  add(src, at, gain = 1, pan = 0) {
    const s0 = Math.round(at * this.sr);
    const gl = Math.cos((pan + 1) * Math.PI / 4) * Math.SQRT2 * gain;
    const gr = Math.sin((pan + 1) * Math.PI / 4) * Math.SQRT2 * gain;
    const n = Math.min(src.length, this.L.length - s0);
    for (let i = Math.max(0, -s0); i < n; i++) { this.L[s0 + i] += src[i] * gl; this.R[s0 + i] += src[i] * gr; }
  }
  // Equal-power fade in at the start and out at the end of a sustained source.
  addSustained(src, at, gain, pan, fade) {
    const f = Math.floor(fade * this.sr), N = src.length;
    for (let i = 0; i < N; i++) {
      let g = 1;
      if (i < f) g = Math.sin((i / f) * Math.PI / 2);
      else if (i > N - f) g = Math.sin(((N - i) / f) * Math.PI / 2);
      src[i] *= g;
    }
    this.add(src, at, gain, pan);
  }
  reverb(wet = 0.25, room = 0.84, damp = 0.3) {
    const sr = this.sr, k = sr / 44100;
    const combT = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617];
    const apT = [556, 441, 341, 225];
    const run = (inp, spread) => {
      const out = new Float32Array(inp.length);
      const combs = combT.map((c) => ({ b: new Float32Array(Math.floor((c + spread) * k)), i: 0, f: 0 }));
      const aps = apT.map((c) => ({ b: new Float32Array(Math.floor((c + spread) * k)), i: 0 }));
      for (let n = 0; n < inp.length; n++) {
        const x = inp[n] * 0.015;
        let s = 0;
        for (const c of combs) {
          const y = c.b[c.i];
          c.f = y * (1 - damp) + c.f * damp;
          c.b[c.i] = x + c.f * room;
          if (++c.i >= c.b.length) c.i = 0;
          s += y;
        }
        for (const a of aps) {
          const y = a.b[a.i];
          a.b[a.i] = s + y * 0.5;
          if (++a.i >= a.b.length) a.i = 0;
          s = y - s;
        }
        out[n] = s;
      }
      return out;
    };
    const mono = new Float32Array(this.L.length);
    for (let i = 0; i < mono.length; i++) mono[i] = (this.L[i] + this.R[i]) * 0.5;
    const wl = run(mono, 0), wr = run(mono, 23);
    for (let i = 0; i < mono.length; i++) { this.L[i] += wl[i] * wet * 3; this.R[i] += wr[i] * wet * 3; }
  }
  // Fold everything after `loopSec` back onto the start so the loop is seamless.
  fold(loopSec) {
    const n = Math.round(loopSec * this.sr);
    for (const ch of [this.L, this.R]) for (let i = n; i < ch.length; i++) ch[i - n] += ch[i];
    this.L = this.L.slice(0, n); this.R = this.R.slice(0, n);
    return this;
  }
  normalize(peak = 0.89) {
    let m = 1e-6;
    for (const ch of [this.L, this.R]) for (let i = 0; i < ch.length; i++) m = Math.max(m, Math.abs(ch[i]));
    const g = peak / m;
    for (const ch of [this.L, this.R]) for (let i = 0; i < ch.length; i++) ch[i] *= g;
    return this;
  }
  gain(g) { scale(this.L, g); scale(this.R, g); return this; }
}
