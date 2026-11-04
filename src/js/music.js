// music.js — the score. Each stem is composed in code and rendered with synth.js.
// All tempo-synced stems share BPM 96 and an 8-bar (20 s) loop in D minor, so any
// combination of layers can play together and stay in time.
import { Mix, nf, kick, tom, snare, hat, metal, strings, stacc, brass, choir, heartbeat, drone, wind, dogBarks, hum } from './synth.js';

export const BPM = 96;
export const BEAT = 60 / BPM;
export const BAR = BEAT * 4;
export const LOOP = BAR * 8; // 20 s
const S16 = BEAT / 4;

// Dm | Dm | Bb | A | Dm | Dm | Gm | A
const ROOTS = ['D2', 'D2', 'Bb1', 'A1', 'D2', 'D2', 'G1', 'A1'];
const OSTI = [
  ['D4', 'D4', 'A3', 'D4', 'F4', 'D4', 'A3', 'D4'],
  ['D4', 'D4', 'A3', 'D4', 'F4', 'E4', 'D4', 'A3'],
  ['Bb3', 'Bb3', 'F3', 'Bb3', 'D4', 'Bb3', 'F3', 'Bb3'],
  ['A3', 'A3', 'E3', 'A3', 'C#4', 'A3', 'E3', 'A3'],
  ['D4', 'D4', 'A3', 'D4', 'F4', 'D4', 'A3', 'D4'],
  ['D4', 'D4', 'A3', 'D4', 'G4', 'F4', 'E4', 'D4'],
  ['G3', 'G3', 'D3', 'G3', 'Bb3', 'G3', 'D3', 'G3'],
  ['A3', 'A3', 'E3', 'A3', 'C#4', 'E4', 'C#4', 'A3'],
];
const FIFTH = { D2: 'A2', Bb1: 'F2', A1: 'E2', G1: 'D2' };
const up = (note, oct) => note.replace(/-?\d$/, (d) => String(parseInt(d, 10) + oct));

function drums(m, sr, { hats = true, snares = true, gain = 1, fill = true }) {
  for (let b = 0; b < 8; b++) {
    const t0 = b * BAR;
    for (const [s, v] of [[0, 1], [3, 0.6], [6, 0.75], [8, 0.95], [11, 0.6]]) m.add(tom(sr, 68, v, 100 + b * 16 + s), t0 + s * S16, 0.55 * gain, -0.1);
    m.add(kick(sr, 1, 200 + b), t0, 0.5 * gain);
    m.add(kick(sr, 0.8, 300 + b), t0 + 8 * S16, 0.45 * gain);
    if (snares) for (const s of [4, 12]) m.add(snare(sr, 0.7, 400 + b * 2 + s), t0 + s * S16, 0.22 * gain, 0.15);
    if (hats) for (let s = 0; s < 16; s += 2) m.add(hat(sr, s % 4 === 0 ? 0.6 : 0.35, false, 500 + b * 16 + s), t0 + s * S16, 0.12 * gain, 0.35);
    if (fill && (b === 3 || b === 7)) for (const s of [12, 13, 14, 15]) m.add(tom(sr, s % 2 ? 92 : 80, 0.7, 600 + b * 16 + s), t0 + s * S16, 0.4 * gain, s % 2 ? 0.3 : -0.3);
  }
}

function ostinato(m, sr, gain = 1, pan = 0.2) {
  for (let b = 0; b < 8; b++) {
    const pat = OSTI[b];
    for (let s = 0; s < 16; s++) {
      const note = pat[s % 8];
      const acc = s % 4 === 0 ? 1 : 0.7;
      m.add(stacc(sr, nf(note), S16 * 0.9, acc, { seed: 700 + b * 16 + s }), b * BAR + s * S16, 0.32 * gain, pan);
    }
  }
}

function lowPads(m, sr, gain = 1) {
  for (let b = 0; b < 8; b++) {
    const r = ROOTS[b];
    m.add(strings(sr, nf(up(r, 1)), BAR, 0.9, { seed: 800 + b, cutoff: 900 }), b * BAR, 0.38 * gain, -0.25);
    m.add(strings(sr, nf(up(FIFTH[r], 1)), BAR, 0.7, { seed: 820 + b, cutoff: 900 }), b * BAR, 0.28 * gain, 0.25);
    m.add(strings(sr, nf(r), BAR, 0.9, { seed: 840 + b, cutoff: 500, voices: 3 }), b * BAR, 0.35 * gain, 0);
  }
}

function droneBed(m, sr, gain = 1) {
  m.addSustained(drone(sr, nf('D1'), LOOP + 3, 1, 900), 0, 0.42 * gain, -0.1, 3);
  m.addSustained(drone(sr, nf('A1'), LOOP + 3, 0.6, 901, 320), 0, 0.25 * gain, 0.15, 3);
}

export const STEMS = {
  ambience: {
    loop: 24, tail: 4,
    render(sr) {
      const T = 24, m = new Mix(T + 4, sr);
      const wl = wind(sr, T + 3, 21), wr = wind(sr, T + 3, 22);
      m.addSustained(wl, 0, 0.55, -0.7, 3);
      m.addSustained(wr, 0, 0.55, 0.7, 3);
      m.addSustained(hum(sr, T + 3, 41), 0, 0.05, -0.2, 3);
      m.add(dogBarks(sr, 2, 31), 4.2, 0.22, -0.65);
      m.add(dogBarks(sr, 3, 33), 15.6, 0.17, 0.55);
      m.add(dogBarks(sr, 1, 35), 20.1, 0.12, 0.2);
      m.add(metal(sr, 61, 0.3, 37, 3), 10.4, 0.06, 0.4);
      m.reverb(0.35, 0.88, 0.4);
      return m.fold(T).normalize(0.7);
    },
  },
  tension: {
    loop: LOOP, tail: 4,
    render(sr) {
      const m = new Mix(LOOP + 4, sr);
      droneBed(m, sr, 1);
      for (let t = 0; t < LOOP - 0.01; t += BEAT * 2) m.add(heartbeat(sr, 1), t, 0.6, 0);
      for (const bar of [2, 6]) {
        m.add(strings(sr, nf('D5'), BAR * 2 - 0.6, 0.6, { seed: 50 + bar, attack: 2.2, release: 1.5, cutoff: 2200 }), bar * BAR, 0.1, -0.4);
        m.add(strings(sr, nf('Eb5'), BAR * 2 - 0.6, 0.6, { seed: 60 + bar, attack: 2.4, release: 1.5, cutoff: 2200 }), bar * BAR + 0.3, 0.08, 0.4);
      }
      m.reverb(0.3, 0.86, 0.35);
      return m.fold(LOOP).normalize(0.75);
    },
  },
  combat: {
    loop: LOOP, tail: 3,
    render(sr) {
      const m = new Mix(LOOP + 3, sr);
      drums(m, sr, { hats: true, snares: true });
      ostinato(m, sr, 1);
      lowPads(m, sr, 0.9);
      m.reverb(0.18, 0.8, 0.4);
      return m.fold(LOOP).normalize(0.85);
    },
  },
  boss: {
    loop: LOOP, tail: 4,
    render(sr) {
      const m = new Mix(LOOP + 4, sr);
      const riffA = [['D2', 0, 1], ['D2', 2, 1], ['D2', 4, 2], ['F2', 8, 1], ['E2', 10, 1], ['Eb2', 12, 3]];
      const riffB = [['D2', 0, 1], ['D2', 2, 1], ['D2', 4, 2], ['C2', 8, 2], ['A1', 12, 3]];
      for (let b = 0; b < 8; b++) {
        const t0 = b * BAR;
        m.add(kick(sr, 1, 900 + b), t0, 0.7);
        m.add(kick(sr, 0.9, 950 + b), t0 + 6 * S16, 0.5);
        m.add(tom(sr, 52, 1, 1000 + b, 2.6), t0, 0.7);
        m.add(tom(sr, 52, 0.9, 1100 + b, 2.6), t0 + 8 * S16, 0.6);
        m.add(snare(sr, 1, 1200 + b, 9), t0 + 8 * S16, 0.38, 0.1);
        if (b % 2 === 0) m.add(metal(sr, 98, 0.9, 1300 + b), t0, 0.22, 0.3);
        for (let s = 0; s < 16; s += 2) m.add(hat(sr, 0.5, s === 14, 1400 + b * 16 + s), t0 + s * S16, 0.08, -0.35);
        for (const [note, st, l] of b % 2 === 0 ? riffA : riffB) {
          m.add(brass(sr, nf(note), l * S16 * 0.95, 1, { seed: 1500 + b * 16 + st }), t0 + st * S16, 0.34, -0.15);
          m.add(brass(sr, nf(up(note, 1)), l * S16 * 0.95, 0.7, { seed: 1600 + b * 16 + st }), t0 + st * S16, 0.18, 0.2);
        }
      }
      const ch = [['D3', 'F3', 'A3'], ['D3', 'F3', 'Bb3'], ['C3', 'E3', 'A3'], ['D3', 'F3', 'A3']];
      for (let k = 0; k < 4; k++) ch[k].forEach((note, j) => m.add(choir(sr, nf(note), BAR * 2 - 0.4, 0.8, 1700 + k * 3 + j), k * BAR * 2, 0.16, (j - 1) * 0.5));
      m.addSustained(drone(sr, nf('D1'), LOOP + 3, 1, 1800, 300), 0, 0.3, 0, 3);
      m.reverb(0.2, 0.82, 0.35);
      return m.fold(LOOP).normalize(0.88);
    },
  },
  hold0: {
    loop: LOOP, tail: 4,
    render(sr) {
      const m = new Mix(LOOP + 4, sr);
      droneBed(m, sr, 0.9);
      for (let t = 0; t < LOOP - 0.01; t += BEAT) m.add(heartbeat(sr, 1), t, 0.5, 0);
      lowPads(m, sr, 0.8);
      m.reverb(0.25, 0.84, 0.35);
      return m.fold(LOOP).normalize(0.75);
    },
  },
  hold1: {
    loop: LOOP, tail: 3,
    render(sr) {
      const m = new Mix(LOOP + 3, sr);
      drums(m, sr, { hats: false, snares: false, fill: true });
      m.reverb(0.18, 0.8, 0.4);
      return m.fold(LOOP).normalize(0.8);
    },
  },
  hold2: {
    loop: LOOP, tail: 3,
    render(sr) {
      const m = new Mix(LOOP + 3, sr);
      ostinato(m, sr, 1, 0.15);
      for (let b = 0; b < 8; b++) for (const s of [4, 12]) m.add(snare(sr, 0.8, 2000 + b * 2 + s), b * BAR + s * S16, 0.3, 0.1);
      m.reverb(0.18, 0.8, 0.4);
      return m.fold(LOOP).normalize(0.75);
    },
  },
  hold3: {
    loop: LOOP, tail: 4,
    render(sr) {
      const m = new Mix(LOOP + 4, sr);
      const mel = [['D5', 0, 2], ['F5', 2, 2], ['E5', 4, 2], ['C#5', 6, 2], ['D5', 8, 2], ['A5', 10, 2], ['G5', 12, 2], ['E5', 14, 2]];
      for (const [note, beat, l] of mel) m.add(strings(sr, nf(note), l * BEAT - 0.1, 0.9, { seed: 2100 + beat, attack: 0.25, cutoff: 2600, voices: 6, detune: 10 }), beat * BEAT, 0.22, -0.2);
      for (let k = 0; k < 4; k++) {
        const chord = [['D4', 'A4'], ['Bb3', 'F4'], ['D4', 'A4'], ['G3', 'D4']][k];
        chord.forEach((note, j) => m.add(choir(sr, nf(note), BAR * 2 - 0.3, 0.8, 2200 + k * 2 + j), k * BAR * 2, 0.14, j ? 0.4 : -0.4));
      }
      for (let b = 0; b < 8; b++) {
        for (let s = 0; s < 16; s++) m.add(hat(sr, s % 4 === 2 ? 0.7 : 0.35, false, 2300 + b * 16 + s), b * BAR + s * S16, 0.1, 0.35);
        m.add(brass(sr, nf(up(ROOTS[b], 1)), BEAT * 0.8, 1, { seed: 2400 + b }), b * BAR, 0.26, -0.1);
      }
      m.reverb(0.22, 0.84, 0.35);
      return m.fold(LOOP).normalize(0.75);
    },
  },
};

// Relative mix levels used at runtime.
export const STEM_GAIN = { ambience: 0.55, tension: 0.6, combat: 0.62, boss: 0.7, hold0: 0.6, hold1: 0.65, hold2: 0.5, hold3: 0.5 };
// Wrap padding around each exported loop so encoder priming/padding never lands inside the loop window.
export const PAD = 0.5;
