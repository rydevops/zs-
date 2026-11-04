// audio.js — Web Audio playback: synced looping music stems plus positional SFX.
import { SFX } from './sfx.js';
import { STEMS, STEM_GAIN, PAD } from './music.js';

const SYNCED = ['tension', 'combat', 'boss', 'hold0', 'hold1', 'hold2', 'hold3'];

export class AudioEngine {
  constructor(basePath = 'audio/') {
    this.base = basePath;
    this.ctx = null;
    this.buffers = {};
    this.stems = {};
    this.target = {};
    this.listener = { x: 0, y: 0 };
    this.musicVol = 0.8; this.sfxVol = 1;
    this.ready = false;
    this.lastPlay = {};
  }

  // Must be called from a user gesture (browser autoplay rules).
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC({ latencyHint: 'interactive' });
      const c = this.ctx;
      this.master = c.createGain();
      const comp = c.createDynamicsCompressor();
      comp.threshold.value = -14; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.2;
      this.master.connect(comp).connect(c.destination);
      this.musicBus = c.createGain(); this.musicBus.connect(this.master);
      this.sfxBus = c.createGain(); this.sfxBus.connect(this.master);
      this.setVolumes(this.musicVol, this.sfxVol);
      // iOS: play a silent buffer inside the gesture to fully unlock output
      const b = c.createBuffer(1, 1, 22050), s = c.createBufferSource();
      s.buffer = b; s.connect(c.destination); s.start(0);
      this._renderSfx();
      this._loadMusic();
    }
    if (this.ctx.state !== 'running') this.ctx.resume().catch(() => {});
  }

  setVolumes(music, sfx) {
    this.musicVol = music; this.sfxVol = sfx;
    if (!this.ctx) return;
    this.musicBus.gain.setTargetAtTime(music * 0.9, this.ctx.currentTime, 0.05);
    this.sfxBus.gain.setTargetAtTime(sfx, this.ctx.currentTime, 0.05);
  }

  suspend() { if (this.ctx && this.ctx.state === 'running') this.ctx.suspend().catch(() => {}); }
  resume() { if (this.ctx && this.ctx.state !== 'running') this.ctx.resume().catch(() => {}); }

  _renderSfx() {
    const names = Object.keys(SFX), sr = this.ctx.sampleRate;
    let i = 0;
    const step = () => {
      const t = performance.now();
      while (i < names.length && performance.now() - t < 12) {
        const name = names[i++];
        try {
          const data = SFX[name](sr);
          const buf = this.ctx.createBuffer(1, data.length, sr);
          buf.copyToChannel ? buf.copyToChannel(data, 0) : buf.getChannelData(0).set(data);
          this.buffers[name] = buf;
        } catch (e) { console.warn('sfx', name, e); }
      }
      if (i < names.length) setTimeout(step, 0); else this.ready = true;
    };
    step();
  }

  async _loadStem(name) {
    const c = this.ctx;
    let buf = null;
    try {
      const res = await fetch(this.base + name + '.mp3');
      if (!res.ok) throw new Error(res.status);
      const ab = await res.arrayBuffer();
      buf = await new Promise((ok, bad) => { const p = c.decodeAudioData(ab, ok, bad); if (p && p.catch) p.catch(bad); });
    } catch (e) {
      // Fallback: render the stem in the browser with the same synth code.
      console.warn('music file failed, synthesizing', name, e);
      await new Promise((r) => setTimeout(r, 50));
      const m = STEMS[name].render(c.sampleRate), p = Math.round(PAD * c.sampleRate), n = m.L.length;
      buf = c.createBuffer(2, n + 2 * p, c.sampleRate);
      [m.L, m.R].forEach((ch, k) => {
        const o = buf.getChannelData(k);
        o.set(ch.subarray(n - p), 0); o.set(ch, p); o.set(ch.subarray(0, p), p + n);
      });
    }
    return buf;
  }

  async _loadMusic() {
    const c = this.ctx;
    this.t0 = c.currentTime + 0.1;
    for (const name of ['ambience', ...SYNCED]) {
      const buf = await this._loadStem(name);
      if (!buf) continue;
      const loop = STEMS[name].loop;
      const src = c.createBufferSource(), g = c.createGain();
      src.buffer = buf; src.loop = true; src.loopStart = PAD; src.loopEnd = PAD + loop;
      g.gain.value = 0;
      src.connect(g).connect(this.musicBus);
      const now = c.currentTime + 0.05;
      const off = ((now - this.t0) % loop + loop) % loop;
      src.start(now, PAD + off);
      this.stems[name] = { src, g, level: 0 };
      this._apply(name);
    }
  }

  // levels: { stemName: 0..1 }; unspecified stems fade out.
  setMusic(levels, fade = 1.2) {
    for (const name of ['ambience', ...SYNCED]) {
      const v = levels[name] || 0;
      if (this.target[name] !== v) { this.target[name] = v; this._apply(name, fade); }
    }
  }
  _apply(name, fade = 1.2) {
    const s = this.stems[name];
    if (!s) return;
    const v = (this.target[name] || 0) * (STEM_GAIN[name] || 0.6);
    s.g.gain.cancelScheduledValues(this.ctx.currentTime);
    s.g.gain.setTargetAtTime(v, this.ctx.currentTime, fade / 3);
  }

  _spatial(opts) {
    let gain = opts.vol ?? 1, pan = opts.pan ?? 0;
    if (opts.x !== undefined) {
      const dx = opts.x - this.listener.x, dy = opts.y - this.listener.y;
      const d = Math.hypot(dx, dy), range = opts.range ?? 28;
      if (d > range) return null;
      gain *= Math.pow(1 - d / range, 1.6) * 0.85 + 0.15 * (d < 2 ? 1 : 0);
      pan = Math.max(-0.9, Math.min(0.9, dx / 10));
    }
    return { gain, pan };
  }

  play(name, opts = {}) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const buf = this.buffers[name];
    if (!buf) return;
    const now = this.ctx.currentTime;
    if (opts.throttle && now - (this.lastPlay[name] || 0) < opts.throttle) return;
    this.lastPlay[name] = now;
    const sp = this._spatial(opts);
    if (!sp) return;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = (opts.rate ?? 1) * (1 + (opts.vary ?? 0.05) * (Math.random() * 2 - 1));
    const g = this.ctx.createGain(); g.gain.value = sp.gain;
    let node = src.connect(g);
    if (this.ctx.createStereoPanner) { const p = this.ctx.createStereoPanner(); p.pan.value = sp.pan; node = node.connect(p); }
    node.connect(this.sfxBus);
    src.start(now + (opts.delay || 0));
  }

  // Looping positional sound (alarm, generator). Returns a handle.
  loop(name, opts = {}) {
    if (!this.ctx || !this.buffers[name]) return null;
    const c = this.ctx, src = c.createBufferSource(), g = c.createGain();
    src.buffer = this.buffers[name]; src.loop = true;
    g.gain.value = 0;
    const p = c.createStereoPanner ? c.createStereoPanner() : null;
    (p ? src.connect(g).connect(p) : src.connect(g)).connect(this.sfxBus);
    src.start();
    const h = {
      opts: { ...opts },
      update: () => {
        const sp = this._spatial(h.opts) || { gain: 0, pan: 0 };
        g.gain.setTargetAtTime(sp.gain, c.currentTime, 0.08);
        if (p) p.pan.setTargetAtTime(sp.pan, c.currentTime, 0.08);
      },
      rate: (r) => src.playbackRate.setTargetAtTime(r, c.currentTime, 0.2),
      stop: () => { g.gain.setTargetAtTime(0, c.currentTime, 0.1); setTimeout(() => { try { src.stop(); } catch (e) {} }, 600); },
    };
    h.update();
    return h;
  }
}

// Silent stand-in used by tests and before audio is unlocked.
export const nullAudio = { listener: { x: 0, y: 0 }, play() {}, loop() { return null; }, setMusic() {}, unlock() {}, suspend() {}, resume() {}, setVolumes() {} };
