// render.js — procedural art and lighting on a 2D canvas, drawn in world metres.
import * as L from './level.js';
import { CELL, GW, GH, SOLID, OPAQUE } from './world.js';
import { rng } from './synth.js';
import { PLAYER } from './config.js';

const TAU = Math.PI * 2;
const HK = 0.35; // screen-up shift per metre of height (gives the 60° pitched camera look)
const VIEW_W = 9; // metres across the screen

const SKIN = { walker: '#7f9a5f', runner: '#a3b25a', brute: '#61784a' };
const CLOTH = ['#4a4038', '#3e4650', '#54483a', '#3b3b3d', '#5a4848', '#3f4a3f'];
const BUILD = {
  brick: { face: '#4f3530', roof: '#2f3134', trim: '#6b4a40' },
  brick2: { face: '#463f3b', roof: '#34363a', trim: '#5e5650' },
  concrete: { face: '#5f6466', roof: '#4b4f52', trim: '#777c7e' },
  shed: { face: '#4d4a3c', roof: '#5a5848', trim: '#6c6956' },
  clinic: { face: '#a9aca6', roof: '#7d8285', trim: '#c9ccc6' },
  store: { face: '#6e6a62', roof: '#3d4043', trim: '#b5462f' },
  diner: { face: '#7a6d5e', roof: '#454044', trim: '#c23d55' },
  shop: { face: '#4c4642', roof: '#36383b', trim: '#3d7f99' },
  bus: { face: '#b9b7ad', roof: '#cfcdc2', trim: '#3b6c8e' },
};

function makeTex(base, draw, size = 256) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  g.fillStyle = base; g.fillRect(0, 0, size, size);
  draw(g, rng(base.length * 977 + size), size);
  return c;
}
function specks(g, R, n, light, dark, size = 256, s = 3) {
  for (let i = 0; i < n; i++) {
    g.fillStyle = R() < 0.5 ? `rgba(${light},${0.04 + R() * 0.1})` : `rgba(${dark},${0.05 + R() * 0.12})`;
    const w = 1 + R() * s;
    g.fillRect(R() * size, R() * size, w, w);
  }
}

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.light = document.createElement('canvas');
    this.lctx = this.light.getContext('2d');
    this.scale = 1;
    this.insets = { t: 0, r: 0, b: 0, l: 0 };
    this.makePatterns();
    this.prepareStatic();
  }

  resize(w, h, dpr) {
    this.W = w; this.H = h; this.dpr = dpr * this.scale;
    this.canvas.width = Math.round(w * this.dpr); this.canvas.height = Math.round(h * this.dpr);
    this.ls = Math.min(this.dpr, 2) * 0.5;
    this.light.width = Math.ceil(w * this.ls); this.light.height = Math.ceil(h * this.ls);
    this.ppm = w / VIEW_W;
  }

  makePatterns() {
    const ctx = this.ctx;
    const T = {};
    T.grass = makeTex('#283024', (g, R) => {
      specks(g, R, 2600, '120,140,90', '10,14,8');
      g.strokeStyle = 'rgba(90,110,60,0.25)'; g.lineWidth = 1;
      for (let i = 0; i < 500; i++) { const x = R() * 256, y = R() * 256; g.beginPath(); g.moveTo(x, y); g.lineTo(x + R() * 4 - 2, y - 3 - R() * 5); g.stroke(); }
    });
    T.asphalt = makeTex('#303337', (g, R) => {
      specks(g, R, 4200, '150,150,155', '8,8,10', 256, 2);
      g.strokeStyle = 'rgba(10,10,12,0.5)'; g.lineWidth = 1.2;
      for (let i = 0; i < 5; i++) { let x = R() * 256, y = R() * 256; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 6; k++) { x += R() * 24 - 12; y += R() * 24 - 12; g.lineTo(x, y); } g.stroke(); }
    });
    T.concrete = makeTex('#4f5355', (g, R) => {
      specks(g, R, 3000, '170,170,165', '20,20,22');
      g.strokeStyle = 'rgba(25,25,28,0.55)'; g.lineWidth = 1.5;
      for (let k = 0; k <= 256; k += 128) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k, 256); g.moveTo(0, k); g.lineTo(256, k); g.stroke(); }
      for (let i = 0; i < 6; i++) { g.fillStyle = `rgba(30,28,24,${0.05 + R() * 0.08})`; g.beginPath(); g.ellipse(R() * 256, R() * 256, 10 + R() * 30, 8 + R() * 20, R() * 3, 0, TAU); g.fill(); }
    });
    T.dirt = makeTex('#3f382d', (g, R) => {
      specks(g, R, 3000, '140,120,90', '15,12,8', 256, 4);
      for (let i = 0; i < 120; i++) { g.fillStyle = `rgba(110,100,85,${0.2 + R() * 0.3})`; g.beginPath(); g.arc(R() * 256, R() * 256, 1 + R() * 2.5, 0, TAU); g.fill(); }
    });
    T.tile = makeTex('#5a574f', (g, R) => {
      for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { g.fillStyle = (x + y) % 2 ? '#4f4c45' : '#625e55'; g.fillRect(x * 32, y * 32, 32, 32); }
      specks(g, R, 1800, '200,190,170', '20,18,14');
      g.strokeStyle = 'rgba(20,18,16,0.4)'; g.lineWidth = 1;
      for (let k = 0; k <= 256; k += 32) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k, 256); g.moveTo(0, k); g.lineTo(256, k); g.stroke(); }
    });
    T.roof = makeTex('#33363a', (g, R) => { specks(g, R, 2500, '120,120,125', '5,5,8', 256, 3); g.strokeStyle = 'rgba(0,0,0,0.25)'; for (let k = 0; k < 256; k += 16) { g.beginPath(); g.moveTo(0, k); g.lineTo(256, k); g.stroke(); } });
    T.bus = makeTex('#2b2f33', (g, R) => { specks(g, R, 1500, '120,120,120', '0,0,0', 256, 2); g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 2; for (let k = 0; k < 256; k += 12) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k, 256); g.stroke(); } });
    T.woods = makeTex('#141a13', (g, R) => specks(g, R, 2500, '60,80,50', '0,0,0', 256, 5));
    this.tex = T;
    this.pat = {};
    const m = typeof DOMMatrix !== 'undefined' ? new DOMMatrix([1 / 64, 0, 0, 1 / 64, 0, 0]) : null;
    for (const k in T) { const p = ctx.createPattern(T[k], 'repeat'); if (m && p.setTransform) p.setTransform(m); this.pat[k] = p; }
  }

  prepareStatic() {
    const R = rng(1234);
    // woods: runs of solid, uncovered cells, plus tree canopies
    this.woodRuns = []; this.trees = [];
    this.groundRuns = [];
    this._woodsReady = false;
    // static decals -> shapes
    this.decalShapes = [];
    for (const d of L.DECALS) {
      const [k] = d;
      if (k === 'trail') {
        const [, x0, y0, x1, y1] = d, n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 0.6);
        for (let i = 0; i <= n; i++) { const u = i / n; this.decalShapes.push({ k: 'smear', x: x0 + (x1 - x0) * u + (R() - 0.5) * 0.4, y: y0 + (y1 - y0) * u + (R() - 0.5) * 0.4, s: 0.12 + R() * 0.2, a: Math.atan2(y1 - y0, x1 - x0), al: 0.35 + R() * 0.3 }); }
      } else if (k === 'blood') {
        const [, x, y, s] = d;
        for (let i = 0; i < 7; i++) this.decalShapes.push({ k: 'blood', x: x + (R() - 0.5) * s, y: y + (R() - 0.5) * s, s: s * (0.15 + R() * 0.35), al: 0.55 });
      } else if (k === 'oil') this.decalShapes.push({ k: 'oil', x: d[1], y: d[2], s: d[3], a: R() * 3 });
      else if (k === 'debris' || k === 'glass') {
        const [, x, y, s] = d;
        for (let i = 0; i < (k === 'glass' ? 14 : 10); i++) this.decalShapes.push({ k, x: x + (R() - 0.5) * s * 2, y: y + (R() - 0.5) * s * 2, s: k === 'glass' ? 0.04 + R() * 0.05 : 0.08 + R() * 0.22, a: R() * 3, c: R() });
      } else if (k === 'crack') {
        const [, x, y, s] = d; const pts = []; let px = x, py = y;
        for (let i = 0; i < 7; i++) { pts.push([px, py]); px += (R() - 0.5) * s * 0.6; py += (R() - 0.5) * s * 0.6; }
        this.decalShapes.push({ k: 'crack', pts });
      }
    }
    this.fires = L.LIGHTS.filter((l) => l.f === 'fire').map((l) => ({ x: l.x, y: l.y }));
    for (const p of L.PROPS) if (p.fire) this.fires.push({ x: (p.r[0] + p.r[2]) / 2, y: (p.r[1] + p.r[3]) / 2, small: p.k === 'barrel' });
    this.fires = this.fires.filter((f, i, a) => a.findIndex((g) => Math.hypot(g.x - f.x, g.y - f.y) < 1) === i);
  }

  buildWoods(world) {
    const R = rng(99);
    this.woodRuns = []; this.trees = [];
    for (let j = 0; j < GH; j++) {
      let start = -1;
      for (let i = 0; i <= GW; i++) {
        const c = j * GW + i;
        const w = i < GW && (world.g[c] & SOLID) && !world.cover[c] && world.ground[c] !== 1 && world.ground[c] !== 2;
        if (w && start < 0) start = i;
        if (!w && start >= 0) { this.woodRuns.push([start * CELL, j * CELL, (i - start) * CELL]); start = -1; }
        if (w && R() < 0.09) this.trees.push({ x: (i + 0.5) * CELL + (R() - 0.5) * 0.4, y: (j + 0.5) * CELL + (R() - 0.5) * 0.4, r: 0.7 + R() * 0.9, s: R() });
      }
    }
    this.trees.sort((a, b) => a.y - b.y);
    this._woodsReady = true;
  }

  // ------------------------------------------------------------------ frame
  draw(game, t) {
    if (!this._woodsReady) this.buildWoods(game.world);
    const ctx = this.ctx, W = this.W, H = this.H, ppm = this.ppm, dpr = this.dpr;
    const p = game.player;
    const sh = game.shake * 0.12;
    const ox = game.cam.x - W / 2 / ppm + (Math.random() - 0.5) * sh;
    const oy = game.cam.y - (H * 0.6) / ppm + (Math.random() - 0.5) * sh;
    this.view = { x0: ox, y0: oy, x1: ox + W / ppm, y1: oy + H / ppm };
    const V = this.view;
    const vis = (r, pad = 0) => r[2] >= V.x0 - pad && r[0] <= V.x1 + pad && r[3] >= V.y0 - pad && r[1] <= V.y1 + pad + 3;
    this.vis = vis;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    ctx.fillStyle = '#0b0e12'; ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    const s = dpr * ppm;
    ctx.setTransform(s, 0, 0, s, -ox * s, -oy * s);
    this.t = t;

    // which room is the player inside?
    this.inside = L.ROOMS.find((r) => p.x > r.r[0] && p.x < r.r[2] && p.y > r.r[1] && p.y < r.r[3]) || null;
    if (this.roofA === undefined) this.roofA = {};

    this.drawGround(ctx, V, vis);
    this.drawDecals(ctx, game, vis);
    this.drawRoomsLow(ctx, vis);
    this.drawProps(ctx, game, vis, false);
    this.drawPickups(ctx, game, vis);
    this.drawDoors(ctx, game);
    // characters sorted by y
    const chars = game.enemies.filter((e) => e.alive && e.x > V.x0 - 3 && e.x < V.x1 + 3 && e.y > V.y0 - 3 && e.y < V.y1 + 3);
    chars.push(p);
    chars.sort((a, b) => a.y - b.y);
    for (const c of chars) c === p ? this.drawPlayer(ctx, game, p) : this.drawZombie(ctx, c);
    this.drawParticles(ctx, game, false);
    this.drawTall(ctx, game, vis);

    // ---- lighting
    this.drawLighting(game, ox, oy);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(this.light, 0, 0, this.canvas.width, this.canvas.height);
    ctx.setTransform(s, 0, 0, s, -ox * s, -oy * s);
    this.drawEmissive(ctx, game, vis);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
  }

  w2s(x, y) { return { x: (x - this.view.x0) * this.ppm, y: (y - this.view.y0) * this.ppm }; }

  // ------------------------------------------------------------------ ground
  drawGround(ctx, V, vis) {
    ctx.fillStyle = this.pat.grass; ctx.fillRect(V.x0, V.y0, V.x1 - V.x0, V.y1 - V.y0 + 4);
    for (const [k, r] of L.GROUND) {
      if (!vis(r)) continue;
      ctx.fillStyle = this.pat[k]; ctx.fillRect(r[0], r[1], r[2] - r[0], r[3] - r[1]);
    }
    // curbs along the street
    ctx.fillStyle = 'rgba(160,160,150,0.35)';
    ctx.fillRect(33.85, 44, 0.15, 23); ctx.fillRect(46, 44, 0.15, 23);
    // markings
    ctx.lineWidth = 0.12;
    for (const [x0, y0, x1, y1, c, dashed] of L.MARKS) {
      if (!vis([Math.min(x0, x1), Math.min(y0, y1), Math.max(x0, x1), Math.max(y0, y1)])) continue;
      ctx.strokeStyle = c; ctx.globalAlpha = 0.55;
      ctx.setLineDash(dashed ? [1.5, 1.5] : []);
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    }
    ctx.setLineDash([]); ctx.globalAlpha = 1;
    // woods (impassable growth)
    ctx.fillStyle = this.pat.woods;
    for (const [x, y, w] of this.woodRuns) if (y > V.y0 - 1 && y < V.y1 + 1 && x + w > V.x0 && x < V.x1) ctx.fillRect(x, y, w, CELL + 0.01);
  }

  drawDecals(ctx, game, vis) {
    const V = this.view;
    const on = (x, y, m = 1) => x > V.x0 - m && x < V.x1 + m && y > V.y0 - m && y < V.y1 + m;
    for (const d of this.decalShapes) {
      if (d.k === 'crack') {
        if (!on(d.pts[0][0], d.pts[0][1], 4)) continue;
        ctx.strokeStyle = 'rgba(10,10,10,0.55)'; ctx.lineWidth = 0.05; ctx.beginPath();
        d.pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke(); continue;
      }
      if (!on(d.x, d.y, 2)) continue;
      if (d.k === 'smear') { ctx.fillStyle = `rgba(70,8,8,${d.al})`; ctx.beginPath(); ctx.ellipse(d.x, d.y, d.s * 1.8, d.s * 0.6, d.a, 0, TAU); ctx.fill(); }
      else if (d.k === 'blood') { ctx.fillStyle = `rgba(80,6,6,${d.al})`; ctx.beginPath(); ctx.arc(d.x, d.y, d.s, 0, TAU); ctx.fill(); }
      else if (d.k === 'oil') { ctx.fillStyle = 'rgba(5,5,8,0.45)'; ctx.beginPath(); ctx.ellipse(d.x, d.y, d.s, d.s * 0.6, d.a, 0, TAU); ctx.fill(); }
      else if (d.k === 'debris') { ctx.fillStyle = d.c < 0.3 ? '#5c564c' : d.c < 0.6 ? '#3e3a35' : '#6b5a42'; ctx.save(); ctx.translate(d.x, d.y); ctx.rotate(d.a); ctx.fillRect(-d.s / 2, -d.s / 3, d.s, d.s * 0.66); ctx.restore(); }
      else if (d.k === 'glass') { ctx.fillStyle = 'rgba(190,210,220,0.5)'; ctx.fillRect(d.x, d.y, d.s, d.s); }
    }
    for (const d of game.decals) {
      if (!on(d.x, d.y, 2)) continue;
      if (d.k === 'pool') { ctx.fillStyle = 'rgba(60,4,4,0.75)'; ctx.beginPath(); ctx.ellipse(d.x, d.y, d.s, d.s * 0.75, d.a, 0, TAU); ctx.fill(); }
      else if (d.k === 'splat') { ctx.fillStyle = 'rgba(85,8,8,0.6)'; ctx.beginPath(); ctx.ellipse(d.x, d.y, d.s * 0.5, d.s * 0.3, d.a, 0, TAU); ctx.fill(); }
      else if (d.k === 'drop') { ctx.fillStyle = 'rgba(80,6,6,0.6)'; ctx.beginPath(); ctx.arc(d.x, d.y, d.s, 0, TAU); ctx.fill(); }
    }
    for (const d of game.decals) if (d.k === 'corpse' && on(d.x, d.y, 2)) this.drawCorpse(ctx, d);
  }

  drawCorpse(ctx, d) {
    const k = d.type === 'brute' ? 1.9 : d.type === 'runner' ? 0.9 : 1;
    ctx.save(); ctx.translate(d.x, d.y); ctx.rotate(d.a); ctx.scale(k, k);
    ctx.fillStyle = '#2a2622';
    ctx.beginPath(); ctx.ellipse(-0.35, 0.1, 0.25, 0.07, 0.3, 0, TAU); ctx.ellipse(-0.35, -0.12, 0.25, 0.07, -0.2, 0, TAU); ctx.fill();
    ctx.fillStyle = CLOTH[Math.floor(Math.abs(d.x * 7)) % CLOTH.length];
    ctx.beginPath(); ctx.ellipse(0, 0, 0.27, 0.2, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = SKIN[d.type] || SKIN.walker;
    ctx.globalAlpha = 0.85;
    ctx.beginPath(); ctx.ellipse(0.12, 0.3, 0.2, 0.05, 0.6, 0, TAU); ctx.ellipse(0.1, -0.3, 0.2, 0.05, -0.8, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(0.36, 0.03, 0.12, 0, TAU); ctx.fill();
    ctx.restore(); ctx.globalAlpha = 1;
  }

  // ------------------------------------------------------------------ rooms & props
  roofAlpha(id, hidden) {
    const a = this.roofA[id] ?? 1, target = hidden ? 0 : 1;
    const v = a + (target - a) * 0.15;
    this.roofA[id] = v;
    return v;
  }

  drawRoomsLow(ctx, vis) {
    for (const room of L.ROOMS) {
      if (!vis(room.r, 1)) continue;
      const st = BUILD[room.kind] || BUILD.concrete;
      // interior walls (top-down) — visible when the roof fades
      ctx.fillStyle = st.trim;
      for (const w of roomWallRects(room)) ctx.fillRect(w[0], w[1], w[2] - w[0], w[3] - w[1]);
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      for (const w of roomWallRects(room)) ctx.fillRect(w[0], w[3] - 0.08, w[2] - w[0], 0.08);
    }
  }

  drawProps(ctx, game, vis) {
    const t = this.t;
    for (const p of L.PROPS) {
      if (!vis(p.r, 2)) continue;
      const [x0, y0, x1, y1] = p.r, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, w = x1 - x0, h = y1 - y0;
      switch (p.k) {
        case 'car': case 'ambulance': this.drawCar(ctx, p, cx, cy, w, h, game); break;
        case 'truck': this.drawTruck(ctx, cx, cy, w, h, p); break;
        case 'pump':
          ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(x0 + 0.1, y0 + 0.15, w, h);
          ctx.fillStyle = '#8b8f92'; ctx.fillRect(x0, y0, w, h);
          ctx.fillStyle = '#b83a2a'; ctx.fillRect(x0, y0, w, h * 0.35);
          ctx.fillStyle = '#20262b'; ctx.fillRect(x0 + 0.2, y0 + h * 0.45, w - 0.4, h * 0.25);
          break;
        case 'shelf':
          ctx.fillStyle = '#3c3a36'; ctx.fillRect(x0, y0, w, h);
          for (let i = 0; i < w * 6; i++) for (let j = 0; j < Math.max(1, h * 4); j++) {
            const r = Math.sin(i * 12.9898 + j * 78.233 + x0) * 43758.5453; const v = r - Math.floor(r);
            if (v < 0.35) continue;
            ctx.fillStyle = ['#8a5a3a', '#6d7d8a', '#a08a4a', '#7a4040', '#5a6a50'][Math.floor(v * 10) % 5];
            ctx.fillRect(x0 + i / 6 + 0.02, y0 + j / 4 + 0.03, 0.11, Math.min(0.19, h - 0.06));
          }
          break;
        case 'counter': case 'desk':
          ctx.fillStyle = '#4a3a2c'; ctx.fillRect(x0, y0, w, h);
          ctx.fillStyle = '#6a5440'; ctx.fillRect(x0 + 0.05, y0 + 0.05, w - 0.1, h - 0.1);
          if (p.k === 'desk') { ctx.fillStyle = '#d8d0b0'; ctx.fillRect(x0 + 0.3, y0 + 0.4, 0.4, 0.3); ctx.fillStyle = '#20252a'; ctx.fillRect(x0 + 0.85, y0 + 0.25, 0.4, 0.3); }
          break;
        case 'booth':
          ctx.fillStyle = '#7a2a30'; ctx.fillRect(x0, y0 - 0.25, w, 0.25); ctx.fillRect(x0, y1, w, 0.25);
          ctx.fillStyle = '#b8b2a2'; ctx.fillRect(x0 + 0.2, y0, w - 0.4, h);
          break;
        case 'seat': ctx.fillStyle = '#3a4a5c'; ctx.fillRect(x0, y0, w, h); ctx.fillStyle = '#2a3644'; ctx.fillRect(x0, y0, 0.2, h); break;
        case 'dumpster':
          ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(x0 + 0.15, y0 + 0.2, w, h);
          ctx.fillStyle = '#3d4a44'; ctx.fillRect(x0, y0, w, h);
          ctx.fillStyle = '#2c3632'; ctx.fillRect(x0 + 0.1, y0 + 0.1, w - 0.2, h / 2 - 0.15); ctx.fillRect(x0 + 0.1, cy + 0.05, w - 0.2, h / 2 - 0.15);
          break;
        case 'barrel':
          ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.beginPath(); ctx.arc(cx + 0.1, cy + 0.12, 0.45, 0, TAU); ctx.fill();
          ctx.fillStyle = '#5a3a24'; ctx.beginPath(); ctx.arc(cx, cy, 0.45, 0, TAU); ctx.fill();
          ctx.strokeStyle = '#3a2416'; ctx.lineWidth = 0.06; ctx.beginPath(); ctx.arc(cx, cy, 0.34, 0, TAU); ctx.stroke();
          if (p.fire) { ctx.fillStyle = '#1a1210'; ctx.beginPath(); ctx.arc(cx, cy, 0.3, 0, TAU); ctx.fill(); }
          break;
        case 'rubble': this.drawRubble(ctx, x0, y0, w, h); break;
        case 'statue':
          ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(x0 + 0.2, y0 + 0.3, w, h);
          ctx.fillStyle = '#5d605e'; ctx.fillRect(x0, y0, w, h);
          ctx.fillStyle = '#6f7370'; ctx.fillRect(x0 + 0.2, y0 + 0.2, w - 0.4, h - 0.4);
          break;
        case 'bench': ctx.fillStyle = '#5a4430'; ctx.fillRect(x0, y0, w, h); ctx.fillStyle = '#2a2a2a'; ctx.fillRect(x0, y0, 0.15, h); break;
        case 'generator':
          ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(x0 + 0.15, y0 + 0.2, w, h);
          ctx.fillStyle = '#b07a1e'; ctx.fillRect(x0, y0, w, h);
          ctx.fillStyle = '#2b2b2b'; for (let i = 0; i < 4; i++) ctx.fillRect(x0 + 0.15, y0 + 0.25 + i * 0.25, w - 0.3, 0.1);
          ctx.fillStyle = '#5c5c5c'; ctx.beginPath(); ctx.arc(x1 - 0.25, y0 + 0.25, 0.12, 0, TAU); ctx.fill();
          if (game.holdout.active) { ctx.fillStyle = '#777'; ctx.beginPath(); ctx.arc(x1 - 0.25 + Math.sin(t * 40) * 0.02, y0 + 0.25, 0.08, 0, TAU); ctx.fill(); }
          break;
        case 'crates':
          ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(x0 + 0.15, y0 + 0.2, w, h);
          ctx.fillStyle = '#6b5232'; ctx.fillRect(x0, y0, w, h);
          ctx.strokeStyle = '#3d2e1c'; ctx.lineWidth = 0.06; ctx.strokeRect(x0 + 0.05, y0 + 0.05, w - 0.1, h - 0.1);
          ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.moveTo(x1, y0); ctx.lineTo(x0, y1); ctx.stroke();
          break;
        case 'barrier': case 'jersey': {
          ctx.fillStyle = '#8a8a84'; ctx.fillRect(x0, y0, w, h);
          if (p.k === 'barrier') { ctx.fillStyle = '#b8462a'; for (let x = x0; x < x1; x += 0.6) ctx.fillRect(x, y0, 0.3, h); }
          else { ctx.fillStyle = '#6e6e69'; for (let y = y0; y < y1; y += 2) ctx.fillRect(x0, y, w, 0.08); }
          break;
        }
      }
    }
  }

  drawRubble(ctx, x0, y0, w, h) {
    const R = rng(Math.floor(x0 * 100 + y0));
    for (let i = 0; i < 9; i++) {
      const x = x0 + R() * w, y = y0 + R() * h, s = 0.15 + R() * 0.3;
      ctx.fillStyle = ['#5d5f5f', '#4a4c4c', '#6e6a62'][i % 3];
      ctx.beginPath(); ctx.moveTo(x - s, y); ctx.lineTo(x - s * 0.2, y - s * 0.8); ctx.lineTo(x + s, y - s * 0.2); ctx.lineTo(x + s * 0.4, y + s * 0.7); ctx.closePath(); ctx.fill();
    }
    ctx.strokeStyle = '#6a4a30'; ctx.lineWidth = 0.04;
    ctx.beginPath(); ctx.moveTo(x0, y0 + h * 0.3); ctx.lineTo(x0 + w, y0 + h * 0.6); ctx.stroke();
  }

  drawCar(ctx, p, cx, cy, w, h, game) {
    const vertical = h > w;
    const len = vertical ? h : w, wid = vertical ? w : h;
    ctx.save(); ctx.translate(cx, cy); ctx.rotate((vertical ? Math.PI / 2 : 0) + (p.rot || 0));
    const L2 = len / 2 - 0.1, W2 = wid / 2 - 0.1;
    ctx.fillStyle = 'rgba(0,0,0,0.45)'; roundRect(ctx, -L2 + 0.12, -W2 + 0.15, L2 * 2, W2 * 2, 0.3); ctx.fill();
    const body = p.burned ? '#211d1a' : p.color;
    ctx.fillStyle = body; roundRect(ctx, -L2, -W2, L2 * 2, W2 * 2, 0.35); ctx.fill();
    if (p.k === 'ambulance') {
      ctx.fillStyle = '#b8342c'; ctx.fillRect(-L2, -0.08, L2 * 2, 0.16);
      ctx.fillStyle = '#e0e0d8'; ctx.fillRect(-L2 + 0.3, -W2 + 0.15, L2 * 1.3, W2 * 2 - 0.3);
      ctx.fillStyle = '#b8342c'; ctx.fillRect(-0.4, -0.12, 0.8, 0.24); ctx.fillRect(-0.12, -0.4, 0.24, 0.8);
      ctx.fillStyle = '#1b2228'; ctx.fillRect(L2 - 0.9, -W2 + 0.15, 0.45, W2 * 2 - 0.3);
    } else {
      // windows & roof
      ctx.fillStyle = p.burned ? '#0d0b0a' : '#1b242c';
      ctx.fillRect(L2 * 0.25, -W2 + 0.12, L2 * 0.35, W2 * 2 - 0.24); // windshield
      ctx.fillRect(-L2 * 0.75, -W2 + 0.15, L2 * 0.28, W2 * 2 - 0.3); // rear window
      ctx.fillStyle = p.burned ? '#2a2420' : shade(p.color, 0.12);
      ctx.fillRect(-L2 * 0.47, -W2 + 0.12, L2 * 0.72, W2 * 2 - 0.24); // roof
      if (!p.burned) {
        ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fillRect(-L2 * 0.47, -W2 + 0.12, L2 * 0.72, 0.15);
        ctx.fillStyle = '#d9d2a0'; ctx.fillRect(L2 - 0.12, -W2 + 0.1, 0.1, 0.25); ctx.fillRect(L2 - 0.12, W2 - 0.35, 0.1, 0.25);
        ctx.fillStyle = '#7a1c1c'; ctx.fillRect(-L2 + 0.02, -W2 + 0.1, 0.08, 0.25); ctx.fillRect(-L2 + 0.02, W2 - 0.35, 0.08, 0.25);
        // cracked windshield
        ctx.strokeStyle = 'rgba(200,220,230,0.35)'; ctx.lineWidth = 0.03;
        ctx.beginPath(); ctx.moveTo(L2 * 0.4, 0); ctx.lineTo(L2 * 0.55, -0.3); ctx.moveTo(L2 * 0.4, 0); ctx.lineTo(L2 * 0.3, 0.35); ctx.stroke();
      } else {
        ctx.fillStyle = 'rgba(120,60,20,0.35)'; ctx.beginPath(); ctx.ellipse(0, 0, L2 * 0.6, W2 * 0.6, 0, 0, TAU); ctx.fill();
      }
    }
    if (p.alarm && game.alarms[p.alarm] && game.alarms[p.alarm].active && Math.floor(this.t * 4) % 2) {
      ctx.fillStyle = '#ffcf5a'; ctx.fillRect(L2 - 0.15, -W2 + 0.05, 0.15, 0.35); ctx.fillRect(L2 - 0.15, W2 - 0.4, 0.15, 0.35);
    }
    ctx.restore();
  }

  drawTruck(ctx, cx, cy, w, h, p) {
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(Math.PI / 2 + (p.rot || 0));
    const L2 = h / 2, W2 = w / 2 - 0.2;
    ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(-L2 + 0.15, -W2 + 0.2, L2 * 2, W2 * 2);
    ctx.fillStyle = '#6d6a62'; ctx.fillRect(-L2, -W2, L2 * 1.45, W2 * 2);
    ctx.strokeStyle = '#55524b'; ctx.lineWidth = 0.05;
    for (let x = -L2 + 0.4; x < -L2 + L2 * 1.45; x += 0.5) { ctx.beginPath(); ctx.moveTo(x, -W2); ctx.lineTo(x, W2); ctx.stroke(); }
    ctx.fillStyle = '#7a3a2a'; ctx.fillRect(L2 * 0.5, -W2 + 0.1, L2 * 0.5, W2 * 2 - 0.2);
    ctx.fillStyle = '#1b242c'; ctx.fillRect(L2 * 0.82, -W2 + 0.25, 0.3, W2 * 2 - 0.5);
    ctx.restore();
  }

  drawPickups(ctx, game, vis) {
    const t = this.t, V = this.view;
    for (const pk of game.allPickups()) {
      if (game.consumed.has(pk.id)) continue;
      if (pk.x < V.x0 - 1 || pk.x > V.x1 + 1 || pk.y < V.y0 - 1 || pk.y > V.y1 + 1) continue;
      drawItem(ctx, pk.k, pk.x, pk.y, t);
    }
    for (const it of L.INTERACTS) {
      if (it.x < V.x0 - 2 || it.x > V.x1 + 2 || it.y < V.y0 - 2 || it.y > V.y1 + 2) continue;
      if (it.k === 'crowbar' && !game.flags.crowbar) drawItem(ctx, 'crowbar', it.x, it.y, t);
      if (it.k === 'cache') drawCache(ctx, it.x, it.y, game.used.has(it.id));
    }
  }

  drawDoors(ctx, game) {
    // back office door
    const open = game.doorOpen;
    ctx.save(); ctx.translate(32.25, 85);
    ctx.fillStyle = '#5a3d26';
    if (open) { ctx.rotate(-1.3); ctx.fillRect(-0.06, 0, 0.12, 1.5); }
    else { ctx.fillRect(-0.18, 0, 0.36, 1.5); ctx.fillStyle = '#c9a640'; ctx.fillRect(-0.24, 0.9, 0.08, 0.12); }
    ctx.restore();
  }

  // tall things after characters: building faces & roofs, canopy, bridge, trees
  drawTall(ctx, game, vis) {
    const p = game.player, t = this.t;
    // rooms (roof fades when the player is inside)
    for (const room of L.ROOMS) {
      if (!vis(room.r, 1)) continue;
      const a = this.roofAlpha(room.id, this.inside === room || room.noRoofDraw);
      if (a < 0.02) continue;
      ctx.globalAlpha = a;
      this.drawBlock(ctx, room.r, room.h, BUILD[room.kind] || BUILD.concrete, room, game);
      ctx.globalAlpha = 1;
    }
    for (const b of L.BUILDINGS) {
      if (!vis(b.r, 1)) continue;
      const hide = this.inside && this.inside.noRoofDraw && overlaps(this.inside.r, b.r);
      const a = this.roofAlpha('b' + b.r.join(','), hide);
      if (a < 0.02) continue;
      ctx.globalAlpha = a;
      this.drawBlock(ctx, b.r, b.h, BUILD[b.kind], b, game);
      ctx.globalAlpha = 1;
    }
    // courtyard walls & the guard rail
    for (const w of L.WALLS) {
      if (!vis(w, 1)) continue;
      const [x0, y0, x1, y1, k] = w;
      if (k === 'rail') { ctx.fillStyle = '#8d9396'; ctx.fillRect(x0, y0 + 0.1, x1 - x0, 0.15); ctx.fillStyle = '#4b4f52'; for (let x = x0; x < x1; x += 2) ctx.fillRect(x, y0 + 0.05, 0.1, 0.3); continue; }
      const hh = 2.4 * HK;
      ctx.fillStyle = '#5a3a31'; ctx.fillRect(x0, y1 - hh, x1 - x0, hh);
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; for (let yy = y1 - hh + 0.2; yy < y1; yy += 0.22) ctx.fillRect(x0, yy, x1 - x0, 0.03);
      ctx.fillStyle = '#7a5446'; ctx.fillRect(x0, y0 - hh, x1 - x0, y1 - y0);
    }
    // the gate
    this.drawGate(ctx, game);
    // canopy over the pumps
    {
      const under = p.x > 40 && p.x < 49.5 && p.y > 88 && p.y < 95.5;
      const a = this.roofAlpha('canopy', under) * 0.85 + 0.1;
      ctx.globalAlpha = a;
      const sy = 4.5 * HK;
      ctx.fillStyle = '#a7aaa8'; ctx.fillRect(40, 88 - sy, 9.5, 7);
      ctx.fillStyle = '#b5402c'; ctx.fillRect(40, 95 - sy - 0.4, 9.5, 0.4); ctx.fillRect(40, 88 - sy, 9.5, 0.25);
      ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(40, 91.5 - sy, 9.5, 0.08);
      ctx.globalAlpha = 1;
    }
    // the collapsed bridge deck over the tunnel
    {
      const under = p.x > 33 && p.x < 47 && p.y > 70 && p.y < 79.5;
      const a = this.roofAlpha('bridge', under) * 0.78 + 0.2;
      const sy = 5 * HK;
      ctx.globalAlpha = a;
      ctx.fillStyle = '#585c5e'; ctx.fillRect(30, 71 - sy, 20, 7);
      ctx.fillStyle = '#6a6e70'; ctx.fillRect(30, 71 - sy, 20, 0.4); ctx.fillRect(30, 77.6 - sy, 20, 0.4);
      ctx.fillStyle = '#4a4e50'; ctx.fillRect(30, 78 - sy, 20, sy * 0.8);
      ctx.strokeStyle = '#c9a640'; ctx.lineWidth = 0.1; ctx.setLineDash([1.2, 1.2]);
      ctx.beginPath(); ctx.moveTo(30, 74.5 - sy); ctx.lineTo(50, 74.5 - sy); ctx.stroke(); ctx.setLineDash([]);
      // the collapsed east span
      ctx.fillStyle = '#0d0f10'; ctx.beginPath(); ctx.moveTo(46.5, 71 - sy); ctx.lineTo(48, 71 - sy); ctx.lineTo(47.2, 78 - sy); ctx.lineTo(45.8, 78 - sy); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#8a5a3a'; ctx.lineWidth = 0.05;
      for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.moveTo(46.4, 71.5 + i - sy); ctx.lineTo(47.4, 71.8 + i - sy); ctx.stroke(); }
      this.drawRubble(ctx, 46, 70.5, 4, 2); this.drawRubble(ctx, 30.5, 77.5, 3.5, 2.5);
      ctx.globalAlpha = 1;
    }
    // trees
    const V = this.view;
    for (const tr of this.trees) {
      if (tr.y < V.y0 - 2 || tr.y > V.y1 + 3 || tr.x < V.x0 - 2 || tr.x > V.x1 + 2) continue;
      const yy = tr.y - 1.2;
      ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.arc(tr.x + 0.3, tr.y + 0.2, tr.r, 0, TAU); ctx.fill();
      ctx.fillStyle = tr.s < 0.5 ? '#1c2619' : '#20291a'; ctx.beginPath(); ctx.arc(tr.x, yy, tr.r, 0, TAU); ctx.fill();
      ctx.fillStyle = tr.s < 0.5 ? '#283522' : '#2d3622'; ctx.beginPath(); ctx.arc(tr.x - tr.r * 0.25, yy - tr.r * 0.25, tr.r * 0.6, 0, TAU); ctx.fill();
    }
  }

  drawBlock(ctx, r, h, st, def, game) {
    const [x0, y0, x1, y1] = r, sy = h * HK, w = x1 - x0;
    // south face
    ctx.fillStyle = st.face; ctx.fillRect(x0, y1 - sy, w, sy);
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(x0, y1 - 0.12, w, 0.12);
    if (def.kind === 'bus') {
      ctx.fillStyle = st.trim; ctx.fillRect(x0, y1 - sy * 0.45, w, 0.18);
      ctx.fillStyle = '#1a2026';
      for (let x = x0 + 0.6; x < x1 - 1; x += 1.25) if (!(x > 40.5 && x < 42.6)) ctx.fillRect(x, y1 - sy + 0.12, 0.95, sy * 0.38);
      ctx.fillStyle = '#0c0f12'; ctx.fillRect(41, y1 - sy + 0.1, 1.5, sy - 0.1);
      ctx.fillStyle = 'rgba(30,20,15,0.85)'; ctx.fillRect(x0, y1 - sy, 3, sy); // scorched end
    } else if (def.kind !== 'shed') {
      const lit = (i) => Math.sin(i * 91.7 + x0 * 3.1) > 0.82;
      let i = 0;
      for (let x = x0 + 0.6; x < x1 - 0.8; x += 1.6, i++) {
        const isLit = lit(i) && def.kind !== 'clinic';
        ctx.fillStyle = isLit ? '#6b5530' : def.kind === 'clinic' ? '#3a4a55' : '#161a1e';
        ctx.fillRect(x, y1 - sy * 0.8, 0.8, sy * 0.35);
      }
    }
    // roof
    if (def.kind === 'bus') {
      ctx.fillStyle = st.roof; roundRect(ctx, x0, y0 - sy, w, y1 - y0, 0.5); ctx.fill();
      ctx.fillStyle = '#9b9a92'; ctx.fillRect(x0 + 4, y0 - sy + 0.8, 2.2, 1.6); ctx.fillRect(x0 + 8, y0 - sy + 0.8, 1.5, 1.6);
      ctx.fillStyle = 'rgba(20,14,10,0.9)'; ctx.beginPath(); ctx.ellipse(x0 + 1.6, y0 - sy + 1.75, 2.2, 1.6, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = st.trim; ctx.fillRect(x0 + 3, y0 - sy + 0.1, w - 3.2, 0.2);
    } else {
      ctx.fillStyle = def.kind === 'shed' ? st.roof : this.pat.roof;
      ctx.fillRect(x0, y0 - sy, w, y1 - y0);
      ctx.fillStyle = st.roof; ctx.globalAlpha *= 0.5; ctx.fillRect(x0, y0 - sy, w, y1 - y0); ctx.globalAlpha *= 2;
      ctx.strokeStyle = st.trim; ctx.lineWidth = 0.18; ctx.strokeRect(x0 + 0.09, y0 - sy + 0.09, w - 0.18, y1 - y0 - 0.18);
      if (w > 4 && y1 - y0 > 4) { ctx.fillStyle = '#56595c'; ctx.fillRect(x0 + w * 0.3, y0 - sy + (y1 - y0) * 0.3, 1.2, 0.9); ctx.fillStyle = '#3d4043'; ctx.fillRect(x0 + w * 0.3 + 0.15, y0 - sy + (y1 - y0) * 0.3 + 0.15, 0.9, 0.6); }
    }
  }

  drawGate(ctx, game) {
    const open = game.flags.gateOpen;
    const off = open ? 3.6 : 0;
    const hh = 2.8 * HK;
    ctx.fillStyle = '#2b2f33'; ctx.fillRect(38 - off, 3.5 - hh, 4, hh);
    ctx.strokeStyle = '#7d858c'; ctx.lineWidth = 0.07;
    for (let x = 38.2 - off; x < 42 - off; x += 0.3) { ctx.beginPath(); ctx.moveTo(x, 3.5 - hh); ctx.lineTo(x, 3.5); ctx.stroke(); }
    ctx.fillStyle = '#7d858c'; ctx.fillRect(38 - off, 3.5 - hh, 4, 0.12); ctx.fillRect(38 - off, 3.35, 4, 0.12);
    ctx.fillStyle = '#ffd24a'; ctx.fillRect(38 - off, 3.5 - hh * 0.5, 4, 0.08);
  }

  // ------------------------------------------------------------------ characters
  drawPlayer(ctx, game, p) {
    const t = this.t;
    ctx.save(); ctx.translate(p.x, p.y);
    ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.beginPath(); ctx.ellipse(0.05, 0.08, 0.38, 0.3, 0, 0, TAU); ctx.fill();
    if (game.state === 'dead') {
      ctx.rotate(p.face); ctx.globalAlpha = 0.95;
      ctx.fillStyle = '#3f6077'; ctx.beginPath(); ctx.ellipse(-0.1, 0, 0.32, 0.2, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#d4a27c'; ctx.beginPath(); ctx.arc(0.3, 0.05, 0.13, 0, TAU); ctx.fill();
      ctx.restore(); return;
    }
    ctx.rotate(p.face);
    if (p.rollT > 0) { const u = 1 - p.rollT / PLAYER.rollTime; ctx.scale(0.8 + 0.2 * Math.abs(Math.cos(u * Math.PI)), 0.85); }
    if (p.invuln > 0 && p.rollT <= 0 && Math.floor(t * 20) % 2) ctx.globalAlpha = 0.6;
    const stride = Math.sin(p.walk * 2.4) * 0.16;
    ctx.fillStyle = '#23272d';
    ctx.beginPath(); ctx.ellipse(stride, -0.11, 0.15, 0.075, 0, 0, TAU); ctx.ellipse(-stride, 0.11, 0.15, 0.075, 0, 0, TAU); ctx.fill();
    // backpack
    ctx.fillStyle = '#5c4632'; roundRect(ctx, -0.32, -0.17, 0.2, 0.34, 0.06); ctx.fill();
    // torso
    ctx.fillStyle = '#3f6077'; ctx.beginPath(); ctx.ellipse(0, 0, 0.19, 0.27, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#4f7590'; ctx.beginPath(); ctx.ellipse(0.03, -0.02, 0.12, 0.2, 0, 0, TAU); ctx.fill();
    const w = p.cur, rec = p.recoil * 0.08;
    ctx.lineCap = 'round';
    const arm = (x0, y0, x1, y1) => { ctx.strokeStyle = '#3f6077'; ctx.lineWidth = 0.11; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); ctx.fillStyle = '#d4a27c'; ctx.beginPath(); ctx.arc(x1, y1, 0.055, 0, TAU); ctx.fill(); };
    if (w === 'pistol') {
      arm(0.02, -0.2, 0.4 - rec, -0.02); arm(0.02, 0.2, 0.4 - rec, 0.03);
      ctx.fillStyle = '#15171a'; ctx.fillRect(0.4 - rec, -0.035, 0.22, 0.07);
      ctx.fillStyle = '#9aa0a6'; ctx.fillRect(0.38 - rec, 0.05, 0.12, 0.05); // flashlight
    } else if (w === 'shotgun') {
      arm(0.02, -0.2, 0.25 - rec, -0.03); arm(0.02, 0.2, 0.55 - rec, 0.02);
      ctx.fillStyle = '#4a3020'; ctx.fillRect(0.05 - rec, -0.04, 0.3, 0.08);
      ctx.fillStyle = '#17191c'; ctx.fillRect(0.3 - rec, -0.035, 0.6, 0.07);
      ctx.fillStyle = '#9aa0a6'; ctx.fillRect(0.55 - rec, 0.04, 0.12, 0.05);
    } else {
      // flashlight in the left hand, crowbar (if any) in the right
      arm(0.02, -0.2, 0.33, -0.17);
      ctx.fillStyle = '#9aa0a6'; ctx.fillRect(0.33, -0.2, 0.16, 0.06);
      if (w === 'crowbar') {
        const sw = p.swingT > 0 ? 1 - p.swingT / 0.28 : -1;
        const a = sw < 0 ? -0.2 : -1.2 + sw * 2.4;
        const hx = 0.28, hy = 0.18;
        arm(0.02, 0.2, hx, hy);
        ctx.save(); ctx.translate(hx, hy); ctx.rotate(a);
        ctx.strokeStyle = '#7b8288'; ctx.lineWidth = 0.05; ctx.beginPath(); ctx.moveTo(-0.1, 0); ctx.lineTo(0.55, 0); ctx.lineTo(0.6, -0.08); ctx.stroke();
        ctx.restore();
        if (p.swingT > 0) { ctx.strokeStyle = 'rgba(220,220,220,0.25)'; ctx.lineWidth = 0.18; ctx.beginPath(); ctx.arc(0.1, 0, 0.7, -1.0, -1.0 + sw * 2.1); ctx.stroke(); }
      } else arm(0.02, 0.2, 0.08 + stride * 0.4, 0.27);
    }
    // head
    ctx.fillStyle = '#d4a27c'; ctx.beginPath(); ctx.arc(0.02, 0, 0.13, 0, TAU); ctx.fill();
    ctx.fillStyle = '#2e2218'; ctx.beginPath(); ctx.arc(-0.02, 0, 0.125, Math.PI * 0.55, Math.PI * 1.45); ctx.fill();
    if (p.cosmetic === 'bandana') { ctx.strokeStyle = '#b02a2a'; ctx.lineWidth = 0.05; ctx.beginPath(); ctx.arc(0.02, 0, 0.12, Math.PI * 0.4, Math.PI * 1.6); ctx.stroke(); ctx.fillStyle = '#b02a2a'; ctx.fillRect(-0.2, -0.03, 0.1, 0.06); }
    ctx.restore(); ctx.globalAlpha = 1; ctx.lineCap = 'butt';
  }

  drawZombie(ctx, e) {
    const t = this.t;
    const k = e.type === 'brute' ? 1.9 : e.type === 'runner' ? 0.92 : 1;
    ctx.save(); ctx.translate(e.x, e.y);
    ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.beginPath(); ctx.ellipse(0.05, 0.08, 0.36 * k, 0.28 * k, 0, 0, TAU); ctx.fill();
    let shakeX = 0;
    if (e.act === 'telegraph') shakeX = Math.sin(t * 60) * 0.05;
    ctx.rotate(e.face); ctx.translate(shakeX, 0); ctx.scale(k, k);
    const flash = e.hitT > 0;
    const skin = flash ? '#f2f2f2' : SKIN[e.type];
    const cloth = flash ? '#dddddd' : CLOTH[e.id % CLOTH.length];
    if (e.state === 'dormant' && e.pose === 'sit') {
      ctx.fillStyle = '#26221e';
      ctx.beginPath(); ctx.ellipse(0.28, -0.1, 0.24, 0.07, 0.1, 0, TAU); ctx.ellipse(0.28, 0.1, 0.24, 0.07, -0.1, 0, TAU); ctx.fill();
      ctx.fillStyle = cloth; ctx.beginPath(); ctx.ellipse(-0.05, 0, 0.2, 0.25, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = skin;
      ctx.beginPath(); ctx.ellipse(0.15, -0.24, 0.16, 0.05, 0.4, 0, TAU); ctx.ellipse(0.12, 0.26, 0.16, 0.05, -0.3, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(0.04 + Math.sin(e.anim) * 0.02, 0.08, 0.12, 0, TAU); ctx.fill();
      ctx.restore(); return;
    }
    const spd = e.type === 'runner' ? 13 : e.type === 'brute' ? 4 : 5.5;
    const stride = Math.sin(e.anim * spd) * (e.type === 'runner' ? 0.2 : 0.13);
    ctx.fillStyle = '#26221e';
    ctx.beginPath(); ctx.ellipse(stride, -0.11, 0.15, 0.075, 0, 0, TAU); ctx.ellipse(-stride, 0.11, 0.15, 0.075, 0, 0, TAU); ctx.fill();
    // arms
    ctx.lineCap = 'round';
    const limb = (x0, y0, x1, y1, wdt = 0.09) => { ctx.strokeStyle = skin; ctx.lineWidth = wdt; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); };
    if (e.type === 'walker') {
      const reach = e.act === 'windup' ? 0.6 + Math.sin(t * 20) * 0.03 : 0.45;
      const sway = Math.sin(e.anim * 2.7) * 0.05;
      limb(0.02, -0.2, reach, -0.15 + sway); limb(0.02, 0.2, reach - 0.05, 0.13 - sway);
    } else if (e.type === 'runner') {
      if (e.act === 'windup' || e.act === 'dash') { limb(0.02, -0.18, 0.5, -0.1); limb(0.02, 0.18, 0.5, 0.1); }
      else { limb(0.02, -0.2, -stride * 1.2, -0.3); limb(0.02, 0.2, stride * 1.2, 0.3); }
    } else {
      const up = e.act === 'telegraph' || e.act === 'windup';
      limb(0.0, -0.24, up ? 0.3 : 0.2, up ? -0.5 : -0.36, 0.17); limb(0.0, 0.24, up ? 0.3 : 0.2, up ? 0.5 : 0.36, 0.17);
    }
    // torso
    const tw = e.type === 'brute' ? 0.28 : e.type === 'runner' ? 0.17 : 0.19;
    ctx.fillStyle = cloth; ctx.beginPath(); ctx.ellipse(0, 0, tw, 0.26, 0, 0, TAU); ctx.fill();
    if (!flash) {
      ctx.fillStyle = skin; ctx.globalAlpha = 0.8;
      ctx.beginPath(); ctx.ellipse(-0.05, 0.08, 0.08, 0.06, 0.4, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
      ctx.fillStyle = 'rgba(90,10,10,0.6)'; ctx.beginPath(); ctx.arc(0.06, -0.1, 0.05, 0, TAU); ctx.fill();
      if (e.type === 'brute') { ctx.fillStyle = 'rgba(150,40,30,0.75)'; ctx.beginPath(); ctx.arc(-0.1, 0.15, 0.04, 0, TAU); ctx.arc(0.08, 0.12, 0.03, 0, TAU); ctx.fill(); }
    }
    // head
    const hx = e.type === 'runner' ? 0.1 : e.type === 'brute' ? 0.12 : 0.04;
    ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(hx, Math.sin(e.anim * 1.7) * 0.02, e.type === 'brute' ? 0.1 : 0.12, 0, TAU); ctx.fill();
    if (!flash) { ctx.fillStyle = 'rgba(40,50,30,0.6)'; ctx.beginPath(); ctx.arc(hx - 0.04, 0.03, 0.06, 0, TAU); ctx.fill(); }
    ctx.restore(); ctx.lineCap = 'butt';
  }

  drawParticles(ctx, game) {
    for (const q of game.particles) {
      const u = q.t / q.life;
      if (q.k === 'blood') { ctx.fillStyle = `rgba(110,10,10,${1 - u * 0.5})`; ctx.beginPath(); ctx.arc(q.x, q.y, 0.06, 0, TAU); ctx.fill(); }
      else if (q.k === 'dust') { ctx.fillStyle = `rgba(150,145,135,${0.3 * (1 - u)})`; ctx.beginPath(); ctx.arc(q.x, q.y, 0.15 + u * 0.3, 0, TAU); ctx.fill(); }
      else if (q.k === 'casing') { ctx.fillStyle = '#c9a640'; ctx.fillRect(q.x, q.y, 0.06, 0.03); }
    }
  }

  // ------------------------------------------------------------------ lighting
  ambient(y) {
    // dusk at the crash site, full dark by the overpass (never fully black)
    const u = Math.max(0, Math.min(1, (112 - y) / 32));
    return {
      a: 0.5 + 0.36 * u,
      c: [Math.round(34 - 26 * u), Math.round(26 - 15 * u), Math.round(52 - 28 * u)],
    };
  }

  flicker(l, i) {
    const t = this.t;
    switch (l.f) {
      case 'fire': return 0.82 + 0.1 * Math.sin(t * 9 + i) + 0.08 * Math.sin(t * 23 + i * 3);
      case 'tube': return Math.sin(t * 1.3 + i * 4) > 0.93 && Math.sin(t * 37 + i) > 0 ? 0.2 : 1;
      case 'tube2': return Math.sin(t * 0.9 + i * 2) > 0.95 && Math.sin(t * 41) > -0.3 ? 0.15 : 0.95;
      case 'neon': return 0.85 + 0.1 * Math.sin(t * 3 + i) + (Math.sin(t * 0.7 + i * 5) > 0.97 ? -0.6 : 0);
      case 'flare': return 0.75 + 0.25 * Math.sin(t * 17 + i) * Math.sin(t * 5.3);
      default: return 1;
    }
  }

  activeLights(game) {
    const V = this.view, p = game.player;
    const list = [];
    L.LIGHTS.forEach((l, i) => {
      if (l.flood && !game.floods) return;
      if (l.x + l.r < V.x0 || l.x - l.r > V.x1 || l.y + l.r < V.y0 || l.y - l.r > V.y1) return;
      list.push({ ...l, i, d: Math.hypot(l.x - p.x, l.y - p.y), k: this.flicker(l, i) });
    });
    for (const a in game.alarms) if (game.alarms[a].active && Math.floor(this.t * 4) % 2) {
      const c = a === 'rest' ? [62, 87.5] : [45, 39.5];
      list.push({ x: c[0], y: c[1], r: 4, c: [255, 190, 80], d: Math.hypot(c[0] - p.x, c[1] - p.y), k: 1 });
    }
    list.sort((a, b) => a.d - b.d);
    const max = game.flashes.length ? 4 : 5; // never more than 6 dynamic lights including the flashlight
    const out = list.slice(0, max);
    for (const f of game.flashes) out.push({ x: f.x, y: f.y, r: 5, c: [255, 220, 150], k: 1 - f.t / 0.06 });
    return out.slice(0, 6 - 1);
  }

  drawLighting(game, ox, oy) {
    const l = this.lctx, p = game.player, ppm = this.ppm, ls = this.ls;
    const amb = this.ambient(p.y);
    l.setTransform(1, 0, 0, 1, 0, 0);
    l.globalCompositeOperation = 'source-over';
    l.clearRect(0, 0, this.light.width, this.light.height);
    l.fillStyle = `rgba(${amb.c[0]},${amb.c[1]},${amb.c[2]},${amb.a})`;
    l.fillRect(0, 0, this.light.width, this.light.height);
    l.globalCompositeOperation = 'destination-out';
    const s = ls * ppm;
    l.setTransform(s, 0, 0, s, -ox * s, -oy * s);
    const lights = this.activeLights(game);
    this.lights = lights;
    for (const li of lights) {
      const g = l.createRadialGradient(li.x, li.y, 0, li.x, li.y, li.r);
      g.addColorStop(0, `rgba(0,0,0,${0.95 * li.k})`); g.addColorStop(0.45, `rgba(0,0,0,${0.6 * li.k})`); g.addColorStop(1, 'rgba(0,0,0,0)');
      l.fillStyle = g; l.beginPath(); l.arc(li.x, li.y, li.r, 0, TAU); l.fill();
    }
    // personal glow so the player always reads
    {
      const g = l.createRadialGradient(p.x, p.y, 0, p.x, p.y, 2.4);
      g.addColorStop(0, 'rgba(0,0,0,0.6)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      l.fillStyle = g; l.beginPath(); l.arc(p.x, p.y, 2.4, 0, TAU); l.fill();
    }
    // flashlight cone with occlusion
    if (game.state !== 'dead') {
      const poly = this.flashPoly(game);
      const g = l.createRadialGradient(p.x, p.y, 0.2, p.x, p.y, PLAYER.flashRange);
      g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(0.65, 'rgba(0,0,0,0.85)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      l.fillStyle = g; l.beginPath(); l.moveTo(p.x, p.y);
      for (const [x, y] of poly) l.lineTo(x, y);
      l.closePath(); l.fill();
      this.poly = poly;
    }
    l.globalCompositeOperation = 'source-over';
  }

  flashPoly(game) {
    const p = game.player, w = game.world, fov = (PLAYER.flashFov * Math.PI) / 180, n = 36, R = PLAYER.flashRange;
    const pts = [];
    const sx = p.x + Math.cos(p.face) * 0.25, sy = p.y + Math.sin(p.face) * 0.25;
    for (let i = 0; i <= n; i++) {
      const a = p.face - fov / 2 + (fov * i) / n;
      const dx = Math.cos(a), dy = Math.sin(a);
      const d = w.cast(sx, sy, dx, dy, R, OPAQUE);
      pts.push([sx + dx * Math.min(R, d + 0.3), sy + dy * Math.min(R, d + 0.3)]);
    }
    return pts;
  }

  inFlash(game, x, y) {
    const p = game.player, dx = x - p.x, dy = y - p.y, d = Math.hypot(dx, dy);
    if (d > PLAYER.flashRange) return false;
    let a = Math.atan2(dy, dx) - p.face; a = Math.atan2(Math.sin(a), Math.cos(a));
    return Math.abs(a) < (PLAYER.flashFov * Math.PI) / 360 && game.world.los(p.x, p.y, x, y);
  }

  // ------------------------------------------------------------------ emissive (after darkness)
  drawEmissive(ctx, game, vis) {
    const t = this.t, p = game.player;
    ctx.globalCompositeOperation = 'lighter';
    // coloured light tint
    for (const li of this.lights || []) {
      if (!li.c) continue;
      const g = ctx.createRadialGradient(li.x, li.y, 0, li.x, li.y, li.r);
      g.addColorStop(0, `rgba(${li.c[0]},${li.c[1]},${li.c[2]},${0.22 * li.k})`); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(li.x, li.y, li.r, 0, TAU); ctx.fill();
    }
    if (this.poly && game.state !== 'dead') {
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, PLAYER.flashRange);
      g.addColorStop(0, 'rgba(255,240,200,0.12)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(p.x, p.y); for (const [x, y] of this.poly) ctx.lineTo(x, y); ctx.closePath(); ctx.fill();
    }
    // fires
    for (const f of this.fires) {
      if (!vis([f.x - 1, f.y - 1, f.x + 1, f.y + 1], 1)) continue;
      const n = f.small ? 4 : 8;
      for (let i = 0; i < n; i++) {
        const ph = t * (3 + i * 0.7) + i * 1.7;
        const fx = f.x + Math.sin(ph) * (f.small ? 0.12 : 0.35), fy = f.y - ((t * 0.8 + i * 0.13) % 1) * (f.small ? 0.6 : 1.2);
        const r = (f.small ? 0.18 : 0.32) * (1 - ((t * 0.8 + i * 0.13) % 1) * 0.6);
        ctx.fillStyle = i % 3 === 0 ? 'rgba(255,220,120,0.55)' : 'rgba(255,110,30,0.45)';
        ctx.beginPath(); ctx.arc(fx, fy, r, 0, TAU); ctx.fill();
      }
    }
    // neon signs
    for (const b of [...L.BUILDINGS, ...L.ROOMS]) if (b.sign && vis(b.r, 3)) this.drawSign(ctx, b, game);
    // muzzle flashes and tracers
    for (const f of game.flashes) {
      ctx.fillStyle = 'rgba(255,220,140,0.9)'; ctx.beginPath(); ctx.arc(f.x, f.y, 0.22, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,160,60,0.5)'; ctx.beginPath(); ctx.arc(f.x, f.y, 0.45, 0, TAU); ctx.fill();
    }
    ctx.lineWidth = 0.035;
    for (const tr of game.tracers) {
      ctx.strokeStyle = `rgba(255,230,160,${0.8 * (1 - tr.t / 0.08)})`;
      ctx.beginPath(); ctx.moveTo(tr.x0, tr.y0); ctx.lineTo(tr.x1, tr.y1); ctx.stroke();
    }
    for (const q of game.particles) if (q.k === 'spark') { ctx.fillStyle = `rgba(255,200,90,${1 - q.t / q.life})`; ctx.fillRect(q.x, q.y, 0.05, 0.05); }
    // emergency + generator glow, lit windows
    ctx.globalCompositeOperation = 'source-over';

    // enemy rim light for readability; player outline when behind cover
    for (const e of game.enemies) {
      if (!e.alive) continue;
      const d = Math.hypot(e.x - p.x, e.y - p.y);
      if (d > 16) continue;
      const lit = this.inFlash(game, e.x, e.y);
      const k = e.type === 'brute' ? 1.9 : e.type === 'runner' ? 0.92 : 1;
      ctx.strokeStyle = e.type === 'brute' ? `rgba(255,140,90,${lit ? 0.35 : 0.55})` : `rgba(170,255,120,${lit ? 0.25 : 0.45})`;
      ctx.lineWidth = 0.05;
      ctx.beginPath(); ctx.arc(e.x, e.y, 0.3 * k, e.face - 1.6, e.face + 1.6); ctx.stroke();
      if (e.act === 'telegraph') {
        ctx.strokeStyle = `rgba(255,60,40,${0.5 + 0.4 * Math.sin(t * 30)})`; ctx.lineWidth = 0.12;
        ctx.beginPath(); ctx.arc(e.x, e.y, 0.9 + (1 - e.actT) * 0.4, 0, TAU); ctx.stroke();
        const a = e.chargeA ?? e.face;
        ctx.fillStyle = 'rgba(255,60,40,0.18)'; ctx.beginPath();
        ctx.moveTo(e.x + Math.cos(a + 1.57) * 0.8, e.y + Math.sin(a + 1.57) * 0.8);
        ctx.lineTo(e.x + Math.cos(a) * 14 + Math.cos(a + 1.57) * 0.8, e.y + Math.sin(a) * 14 + Math.sin(a + 1.57) * 0.8);
        ctx.lineTo(e.x + Math.cos(a) * 14 - Math.cos(a + 1.57) * 0.8, e.y + Math.sin(a) * 14 - Math.sin(a + 1.57) * 0.8);
        ctx.lineTo(e.x - Math.cos(a + 1.57) * 0.8, e.y - Math.sin(a + 1.57) * 0.8); ctx.fill();
      }
      if (e.act === 'stun') {
        for (let i = 0; i < 3; i++) { const a = t * 5 + i * 2.1; ctx.fillStyle = 'rgba(255,230,120,0.8)'; ctx.beginPath(); ctx.arc(e.x + Math.cos(a) * 0.6, e.y - 0.9 + Math.sin(a) * 0.25, 0.07, 0, TAU); ctx.fill(); }
      }
    }
    if (this.playerOccluded(game)) {
      ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 0.05;
      ctx.beginPath(); ctx.arc(p.x, p.y, 0.3, 0, TAU); ctx.stroke();
      ctx.beginPath(); ctx.arc(p.x + Math.cos(p.face) * 0.05, p.y + Math.sin(p.face) * 0.05, 0.13, 0, TAU); ctx.stroke();
    }
    // pickups pulse (0.5 Hz) within 6 m
    const pulse = 0.5 + 0.5 * Math.sin(t * Math.PI);
    for (const pk of game.allPickups()) {
      if (game.consumed.has(pk.id)) continue;
      const d = Math.hypot(pk.x - p.x, pk.y - p.y);
      if (d > 6) continue;
      ctx.strokeStyle = `rgba(255,236,170,${0.15 + 0.35 * pulse})`; ctx.lineWidth = 0.05;
      ctx.beginPath(); ctx.arc(pk.x, pk.y, 0.35 + 0.1 * pulse, 0, TAU); ctx.stroke();
    }
    for (const it of L.INTERACTS) {
      if (!game.interactAvailable(it)) continue;
      const d = Math.hypot(it.x - p.x, it.y - p.y);
      if (d > 6) continue;
      ctx.strokeStyle = `rgba(140,210,255,${0.2 + 0.4 * pulse})`; ctx.lineWidth = 0.06;
      ctx.beginPath(); ctx.arc(it.x, it.y, 0.45 + 0.1 * pulse, 0, TAU); ctx.stroke();
    }
    // stamina arc
    if (game.state === 'play' && (p.sprinting || p.stamina < 100)) {
      ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 0.08;
      ctx.beginPath(); ctx.arc(p.x, p.y, 0.55, -Math.PI / 2, -Math.PI / 2 + TAU); ctx.stroke();
      ctx.strokeStyle = p.stamina < 25 ? 'rgba(255,140,90,0.9)' : 'rgba(150,220,255,0.85)';
      ctx.beginPath(); ctx.arc(p.x, p.y, 0.55, -Math.PI / 2, -Math.PI / 2 + TAU * (p.stamina / 100)); ctx.stroke();
    }
    // interact progress ring
    if (game.interactT > 0 && game.interactable) {
      const it = game.interactable;
      ctx.strokeStyle = 'rgba(140,210,255,0.95)'; ctx.lineWidth = 0.1;
      ctx.beginPath(); ctx.arc(it.x, it.y, 0.6, -Math.PI / 2, -Math.PI / 2 + TAU * Math.min(1, game.interactT / PLAYER.interactTime)); ctx.stroke();
    }
    // waypoint marker in the world
    const tg = game.state === 'play' ? game.objectiveTarget() : null;
    this.target = tg;
    if (tg && Math.hypot(tg.x - p.x, tg.y - p.y) > 8) {
      const V = this.view;
      if (tg.x > V.x0 && tg.x < V.x1 && tg.y > V.y0 && tg.y < V.y1) {
        const bob = Math.sin(t * 3) * 0.12;
        ctx.fillStyle = 'rgba(255,214,90,0.9)'; ctx.beginPath();
        ctx.moveTo(tg.x, tg.y - 0.9 + bob); ctx.lineTo(tg.x + 0.25, tg.y - 0.6 + bob); ctx.lineTo(tg.x, tg.y - 0.3 + bob); ctx.lineTo(tg.x - 0.25, tg.y - 0.6 + bob); ctx.closePath(); ctx.fill();
      }
    }
    // sound cues (visual counterpart for every important sound)
    for (const c of game.cues) {
      const col = cueColor(c.kind);
      if (!col) continue;
      const u = c.t / 1.2;
      ctx.strokeStyle = `rgba(${col},${0.6 * (1 - u)})`; ctx.lineWidth = 0.06;
      ctx.beginPath(); ctx.arc(c.x, c.y, 0.4 + u * (c.kind === 'alarm' || c.kind === 'breach' ? 3 : 1.5), 0, TAU); ctx.stroke();
    }
  }

  playerOccluded(game) {
    const p = game.player;
    for (const b of L.BUILDINGS) { const sy = b.h * HK; if (p.x > b.r[0] && p.x < b.r[2] && p.y > b.r[1] - sy && p.y < b.r[1]) return true; }
    for (const r of L.ROOMS) { if (this.inside === r) continue; const sy = r.h * HK; if (p.x > r.r[0] && p.x < r.r[2] && p.y > r.r[1] - sy && p.y < r.r[1]) return true; }
    for (const tr of this.trees) if (Math.abs(tr.y - 1.2 - p.y) < tr.r && Math.abs(tr.x - p.x) < tr.r && p.y < tr.y) return true;
    return false;
  }

  // Neon signs are pre-rendered once (glow included) so no per-frame shadowBlur is needed.
  signImage(s) {
    this.signCache = this.signCache || {};
    const key = s.text + s.color + s.side;
    if (this.signCache[key]) return this.signCache[key];
    const PX = 64, size = s.side === 's' ? 0.55 : 0.42;
    const c = document.createElement('canvas'), g = c.getContext('2d');
    g.font = `bold ${size * PX}px system-ui, sans-serif`;
    const tw = g.measureText(s.text).width / PX + 0.3;
    c.width = Math.ceil((tw + 0.6) * PX); c.height = Math.ceil(1.2 * PX);
    g.translate(c.width / 2, c.height / 2);
    g.fillStyle = 'rgba(10,10,14,0.85)'; g.fillRect((-tw / 2) * PX, -0.32 * PX, tw * PX, 0.64 * PX);
    g.font = `bold ${size * PX}px system-ui, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.shadowColor = s.color; g.shadowBlur = 14; g.fillStyle = s.color;
    g.fillText(s.text, 0, 0.02 * PX); g.fillText(s.text, 0, 0.02 * PX);
    return (this.signCache[key] = { c, w: c.width / PX, h: c.height / PX });
  }

  drawSign(ctx, b, game) {
    const s = b.sign, [x0, y0, x1, y1] = b.r, sy = b.h * HK;
    const f = 0.85 + 0.15 * Math.sin(this.t * 3 + x0) - (Math.sin(this.t * 0.6 + y0) > 0.96 ? 0.6 : 0);
    let x, y, rot = 0;
    if (s.side === 's') { x = s.at; y = y1 - sy * 0.25; }
    else if (s.side === 'e') { x = x1 + 0.35; y = s.at - sy * 0.6; rot = Math.PI / 2; }
    else { x = x0 - 0.35; y = s.at - sy * 0.6; rot = -Math.PI / 2; }
    const img = this.signImage(s);
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
    ctx.globalAlpha = Math.max(0.15, f);
    ctx.drawImage(img.c, -img.w / 2, -img.h / 2, img.w, img.h);
    ctx.restore(); ctx.globalAlpha = 1;
  }
}

export function cueColor(kind) {
  return { walker: '150,230,110', runner: '220,240,90', brute: '255,120,80', alarm: '255,200,80', breach: '255,80,60' }[kind] || null;
}

function roomWallRects(room) {
  const [x0, y0, x1, y1] = room.r, t = CELL, out = [];
  const segs = { n: [x0, y0, x1, y0 + t], s: [x0, y1 - t, x1, y1], w: [x0, y0, x0 + t, y1], e: [x1 - t, y0, x1, y1] };
  for (const side of ['n', 's', 'w', 'e']) {
    const r = segs[side], horiz = side === 'n' || side === 's';
    let a = horiz ? r[0] : r[1];
    const end = horiz ? r[2] : r[3];
    for (const [sd, d0, d1] of room.doors) if (sd === side) { if (d0 > a) out.push(horiz ? [a, r[1], d0, r[3]] : [r[0], a, r[2], d0]); a = d1; }
    if (end > a) out.push(horiz ? [a, r[1], end, r[3]] : [r[0], a, r[2], end]);
  }
  for (const w of room.inner || []) {
    // leave the office door gap visible
    if (w[0] === 32 && w[2] === 32.5) { out.push([32, 83, 32.5, 85], [32, 86.5, 32.5, 88]); continue; }
    out.push(w.slice(0, 4));
  }
  return out;
}

function overlaps(a, b) { return a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1]; }

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
}

function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  const f = (v) => Math.max(0, Math.min(255, Math.round(v + (k > 0 ? (255 - v) * k : v * k))));
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
}

export function drawItem(ctx, k, x, y, t = 0) {
  ctx.save(); ctx.translate(x, y);
  ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.beginPath(); ctx.ellipse(0.04, 0.06, 0.26, 0.18, 0, 0, TAU); ctx.fill();
  switch (k) {
    case 'ammo':
      ctx.fillStyle = '#5b5a35'; ctx.fillRect(-0.2, -0.13, 0.4, 0.26);
      ctx.fillStyle = '#c9a640'; for (let i = 0; i < 4; i++) ctx.fillRect(-0.16 + i * 0.09, -0.09, 0.05, 0.18);
      break;
    case 'shells':
      ctx.fillStyle = '#3a2a22'; ctx.fillRect(-0.2, -0.13, 0.4, 0.26);
      ctx.fillStyle = '#b32a22'; for (let i = 0; i < 3; i++) ctx.fillRect(-0.15 + i * 0.11, -0.09, 0.08, 0.18);
      ctx.fillStyle = '#c9a640'; for (let i = 0; i < 3; i++) ctx.fillRect(-0.15 + i * 0.11, 0.05, 0.08, 0.04);
      break;
    case 'bandage':
      ctx.fillStyle = '#e8e4d8'; ctx.beginPath(); ctx.arc(0, 0, 0.15, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#b9b3a3'; ctx.lineWidth = 0.03; ctx.beginPath(); ctx.arc(0, 0, 0.08, 0, TAU); ctx.stroke();
      break;
    case 'medkit':
      ctx.fillStyle = '#e8e4d8'; ctx.fillRect(-0.22, -0.16, 0.44, 0.32);
      ctx.fillStyle = '#c42a2a'; ctx.fillRect(-0.05, -0.12, 0.1, 0.24); ctx.fillRect(-0.12, -0.05, 0.24, 0.1);
      break;
    case 'pistol':
      ctx.fillStyle = '#16181b'; ctx.fillRect(-0.18, -0.05, 0.36, 0.1); ctx.fillRect(-0.18, -0.05, 0.1, 0.22);
      break;
    case 'shotgun':
      ctx.rotate(-0.4); ctx.fillStyle = '#4a3020'; ctx.fillRect(-0.5, -0.05, 0.35, 0.1); ctx.fillStyle = '#16181b'; ctx.fillRect(-0.15, -0.04, 0.65, 0.08);
      break;
    case 'scrap':
      ctx.fillStyle = '#7d7a72'; ctx.fillRect(-0.18, -0.06, 0.18, 0.12); ctx.fillStyle = '#8a5a3a'; ctx.fillRect(0, -0.12, 0.14, 0.1);
      ctx.fillStyle = '#9aa0a6'; ctx.beginPath(); ctx.arc(0.06, 0.08, 0.07, 0, TAU); ctx.fill(); ctx.fillStyle = '#3a3a3a'; ctx.beginPath(); ctx.arc(0.06, 0.08, 0.025, 0, TAU); ctx.fill();
      break;
    case 'key':
      ctx.strokeStyle = '#e0b73a'; ctx.lineWidth = 0.05; ctx.beginPath(); ctx.arc(-0.08, 0, 0.07, 0, TAU); ctx.stroke();
      ctx.fillStyle = '#e0b73a'; ctx.fillRect(-0.01, -0.02, 0.2, 0.04); ctx.fillRect(0.12, 0, 0.03, 0.06);
      ctx.fillStyle = '#c23a2a'; ctx.fillRect(-0.25, -0.05, 0.1, 0.1);
      break;
    case 'crate':
      ctx.fillStyle = '#3e4a2e'; ctx.fillRect(-0.45, -0.3, 0.9, 0.6);
      ctx.strokeStyle = '#2a321e'; ctx.lineWidth = 0.05; ctx.strokeRect(-0.4, -0.25, 0.8, 0.5);
      ctx.fillStyle = '#c9b47a'; ctx.font = 'bold 0.16px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('AMMO', 0, 0);
      break;
    case 'crowbar':
      ctx.rotate(0.6); ctx.strokeStyle = '#9aa2a8'; ctx.lineWidth = 0.06; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(-0.4, 0); ctx.lineTo(0.35, 0); ctx.lineTo(0.42, -0.1); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 0.02; ctx.beginPath(); ctx.moveTo(-0.3 + ((t * 0.6) % 1) * 0.6, -0.02); ctx.lineTo(-0.2 + ((t * 0.6) % 1) * 0.6, -0.02); ctx.stroke();
      break;
  }
  ctx.restore();
}

function drawCache(ctx, x, y, used) {
  ctx.save(); ctx.translate(x, y);
  ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(-0.4, -0.25, 0.85, 0.6);
  ctx.fillStyle = used ? '#4a3c2c' : '#6b5232'; ctx.fillRect(-0.45, -0.3, 0.8, 0.55);
  ctx.fillStyle = used ? '#2a2018' : '#2f4a5a'; ctx.fillRect(-0.45, -0.3, 0.8, used ? 0.1 : 0.3);
  if (!used) { ctx.fillStyle = '#d6c27a'; ctx.beginPath(); ctx.arc(-0.05, 0.08, 0.08, 0, TAU); ctx.fill(); }
  ctx.restore();
}
