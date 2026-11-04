// game.js — the Level 1 simulation: player, enemies, weapons, objectives, spawning,
// checkpoint/hold-out restore and win/lose. No DOM or canvas access in here.
import { DT, PLAYER, WEAPONS, ENEMIES, AWARE, SPAWN, ITEMS, HOLDOUT, STARS, CHECKPOINT_HEAL, ASSIST } from './config.js';
import { World, SOLID, BULLET, OPAQUE } from './world.js';
import * as L from './level.js';

const TAU = Math.PI * 2;
const angDiff = (a, b) => { let d = (b - a) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; };
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const inRect = (x, y, r) => x >= r[0] && x <= r[2] && y >= r[1] && y <= r[3];
const rand = (a = 0, b = 1) => a + Math.random() * (b - a);

export const BEATS = [
  { id: 'wake', text: 'Get out of the bus' },
  { id: 'crowbar', text: 'Pick up the crowbar' },
  { id: 'rest', text: 'Find a weapon at the gas station' },
  { id: 'key', text: 'Find the key in the back office' },
  { id: 'overpass', text: 'Get through the underpass' },
  { id: 'maple', text: 'Reach the clinic' },
  { id: 'hold', text: 'Power the gate' },
];

export const PROMPTS = {
  move: { text: 'Move to leave the wreck', key: '' },
  pickup: { text: 'Hold to pick up', key: 'Hold E to pick up' },
  swing: { text: 'Aim and swing', key: 'Aim and swing (click)' },
  pistol: { text: 'Use the pistol at range', key: '' },
  reload: { text: 'Reload', key: 'Reload (R)' },
  runner: { text: 'Runners are fast. Use the roll', key: 'Runners are fast. Use the roll (Space)' },
  heal: { text: 'Use a bandage or medkit', key: 'Use a bandage (Q) or medkit (C)' },
  brute: { text: 'Dodge sideways', key: '' },
  hold: { text: 'Hold the generator', key: '' },
};

const ALARM_CARS = { rest: { x: 62, y: 87.5, r: [60, 86.5, 64, 88.5] }, square: { x: 45, y: 39.5, r: [44, 37.5, 46, 41.5] } };

export class Game {
  constructor({ audio, onEvent = () => {} }) {
    this.audio = audio;
    this.emit = onEvent;
    this.world = new World();
    this.deaths = {};
    this.settings = { aimAssist: true };
    this.checkpoint = null;
    this.reset();
  }

  // ---------------------------------------------------------------- setup
  reset() {
    this.world.build();
    this.t = 0; this.levelTime = 0;
    this.eid = 0;
    this.enemies = []; this.queue = []; this.particles = []; this.decals = []; this.cues = []; this.tracers = []; this.flashes = [];
    this.consumed = new Set(); this.used = new Set(); this.extraPickups = [];
    this.flags = { restKills: 0, kills: 0 };
    this.stats = { shots: 0, hits: 0, medkitsUsed: 0, caches: 0, kills: 0 };
    this.beat = 0; this.objT = 0; this.objShow = 0;
    this.prompts = {}; for (const k in PROMPTS) this.prompts[k] = { shows: 0, cleared: false, cool: 0 };
    this.prompt = null;
    this.holdout = { active: false, t: 0, wave: 0, done: false };
    this.alarms = {}; this.loops = {};
    this.lastHit = -99; this.dmgDir = []; this.shake = 0;
    this.combatT = 0;
    this.state = 'play'; this.deadT = 0; this.winT = 0;
    this.doorOpen = false;
    this.floods = false;
    this.flowT = 0;
    this.holdSnap = null;
    this.interactT = 0; this.interactId = null;
    this.toast = null;
    const p = this.player = {
      x: L.START.x, y: L.START.y, r: PLAYER.radius, face: L.START.face, hp: PLAYER.hp, maxHp: PLAYER.hp,
      stamina: PLAYER.stamina, stamDelay: 0, sprinting: false, moving: false,
      rollT: 0, rollCD: 0, rollDx: 0, rollDy: 0, invuln: 0,
      weapons: { crowbar: false, pistol: false, shotgun: false }, cur: null,
      mag: { pistol: 0, shotgun: 0 }, reserve: { pistol: 0, shotgun: 0 },
      reloadT: 0, fireCD: 0, swingT: 0, recoil: 0,
      bandages: 0, medkits: 0, healing: null, scrap: 0, cosmetic: null,
      walk: 0, lastMoveX: 0, lastMoveY: -1, stepT: 0,
    };
    this.startPos = { x: p.x, y: p.y };
    this.cam = { x: p.x, y: p.y };
    for (const pl of L.PLACED) if (pl.at === 'start') this.placeDormant(pl);
    this.setObjective(0);
  }

  newGame() { this.deaths = {}; this.checkpoint = null; this.reset(); this.emit('newgame'); }

  // ---------------------------------------------------------------- enemies
  spawnEnemy(type, x, y, o = {}) {
    const c = ENEMIES[type];
    const e = {
      id: ++this.eid, type, c, x, y, r: c.radius, hp: c.hp, maxHp: c.hp, alive: true,
      face: o.face ?? rand(0, TAU), state: o.state || 'chase', pose: o.pose || 'stand',
      homeX: x, homeY: y, pid: o.pid || null, zone: o.zone || null, group: o.group || null, tag: o.tag || null,
      noLeash: !!o.noLeash, target: o.target || null, mode: o.state || 'chase',
      act: null, actT: 0, cd: 0, chargeCD: 1.5, lastSeen: o.state === 'chase' ? this.t : -99,
      groanT: rand(1, 4), hitT: 0, anim: rand(0, 10), wakeT: 0, stuckT: 0, px: x, py: y, jitT: 0, jx: 0, jy: 0,
      circleDir: Math.random() < 0.5 ? -1 : 1, vx: 0, vy: 0, kx: 0, ky: 0, seen: false,
    };
    this.enemies.push(e);
    return e;
  }

  placeDormant(pl) {
    return this.spawnEnemy(pl.t, pl.x, pl.y, { state: 'dormant', pose: pl.pose, face: pl.face, pid: pl.id, zone: pl.zone, group: pl.group });
  }

  queueSpawn(type, opts) { this.queue.push({ type, ...opts }); }

  aliveCount() { let n = 0; for (const e of this.enemies) if (e.alive) n++; return n; }

  validSpawn(x, y) {
    const p = this.player, d = Math.hypot(x - p.x, y - p.y);
    if (d < SPAWN.minDist) return false;
    if (this.world.solidAt(x, y)) return false;
    if (d <= SPAWN.sightRange && this.world.los(p.x, p.y, x, y)) return false;
    for (const e of this.enemies) if (e.alive && Math.hypot(e.x - x, e.y - y) < 1.2) return false;
    return true;
  }

  processSpawns() {
    const cap = this.holdout.active ? SPAWN.maxAliveHoldout : SPAWN.maxAlive;
    let alive = this.aliveCount();
    for (let i = 0; i < this.queue.length && alive < cap; i++) {
      const q = this.queue[i];
      if (q.after && this.t < q.after) continue;
      let pts = q.point ? [q.point] : q.pools.flatMap((k) => L.SPAWNS[k]);
      pts = pts.filter(([x, y]) => this.validSpawn(x, y));
      if (!pts.length) continue;
      const [x, y] = pts[Math.floor(Math.random() * pts.length)];
      const e = this.spawnEnemy(q.type, x, y, { state: q.state || 'chase', pose: q.pose, face: q.face, pid: q.pid, zone: q.zone, group: q.group, tag: q.tag, noLeash: q.noLeash, target: q.target });
      if (q.state === 'chase') { e.lastSeen = this.t; }
      this.queue.splice(i, 1); i--; alive++;
    }
  }

  wake(e, how = 'chase', target = null) {
    if (!e.alive) return;
    if (e.state === 'dormant') {
      e.wakeT = e.pose === 'sit' ? 0.9 : 0.4;
      e.pose = 'stand';
      if (e.pid === 'w_crash') this.flags.crashAwake = true;
      this.audio.play(e.type === 'runner' ? 'runner0' : e.type === 'brute' ? 'brute' : 'walker' + (e.id % 3), { x: e.x, y: e.y, throttle: 0.3 });
      this.cue(e.x, e.y, e.type);
    }
    if (how === 'investigate' && e.state !== 'chase') { e.state = 'investigate'; e.target = target; }
    else if (how === 'chase') { e.state = 'chase'; e.lastSeen = this.t; }
  }

  noise(x, y, radius, kind = 'chase', target = null) {
    for (const e of this.enemies) {
      if (!e.alive) continue;
      if (Math.hypot(e.x - x, e.y - y) > radius) continue;
      if (kind === 'alarm') { if (e.state !== 'dormant') this.wake(e, 'investigate', target); }
      else if (e.state !== 'chase') this.wake(e, 'chase');
      else e.lastSeen = this.t;
    }
  }

  cue(x, y, kind) { this.cues.push({ x, y, kind, t: 0 }); if (this.cues.length > 30) this.cues.shift(); }

  // ---------------------------------------------------------------- objectives
  setObjective(i) {
    this.beat = i; this.objT = 0; this.objShow = this.t;
    if (i > 0) { this.audio.play('objective'); this.emit('objective', BEATS[i]); }
  }
  objectiveText() {
    if (this.beat >= BEATS.length) return '';
    if (this.beat === 6 && this.flags.gateOpen) return 'Get through the gate';
    return BEATS[this.beat].text;
  }
  objectiveTarget() {
    const p = this.player, f = this.flags;
    switch (this.beat) {
      case 0: return { x: 46, y: 119.5 };
      case 1: {
        if (!f.crowbar) return { x: 47, y: 111.2 };
        const w = this.enemies.find((e) => e.alive && e.pid === 'w_crash');
        return w ? { x: w.x, y: w.y } : null;
      }
      case 2: {
        if (!f.pistol) return { x: 35, y: 86.3 };
        let best = null, bd = 1e9;
        for (const e of this.enemies) if (e.alive && e.zone === 'rest' && e.type === 'walker') {
          const d = Math.hypot(e.x - p.x, e.y - p.y); if (d < bd) { bd = d; best = e; }
        }
        return best ? { x: best.x, y: best.y } : null;
      }
      case 3: return this.doorOpen || f.doorOpened ? { x: 29.5, y: 84.6 } : { x: 33.2, y: 85.75 };
      case 4: return { x: 40, y: 62 };
      case 5: return { x: 40.25, y: 25 };
      case 6: return f.gateOpen ? { x: 40, y: 1.5 } : this.holdout.active ? null : { x: 40.25, y: 15.2 };
    }
    return null;
  }
  checkBeats() {
    const p = this.player, f = this.flags;
    const done = [
      () => Math.hypot(p.x - this.startPos.x, p.y - this.startPos.y) >= 10,
      () => f.crowbar && f.crashKill,
      () => f.pistol && f.restKills >= 3,
      () => f.key && f.checkpointSaved,
      () => p.y < 63 && p.x > 30 && p.x < 50,
      () => inRect(p.x, p.y, L.COURTYARD),
      () => f.won,
    ];
    while (this.beat < BEATS.length && done[this.beat]()) {
      if (this.beat === 5) this.enterCourtyard();
      if (this.beat === 6) { this.beat = BEATS.length; break; }
      this.setObjective(this.beat + 1);
    }
  }

  // ---------------------------------------------------------------- prompts
  promptWanted(id) {
    const p = this.player, f = this.flags;
    switch (id) {
      case 'move': return this.beat === 0;
      case 'pickup': return !f.crowbar && Math.hypot(p.x - 47, p.y - 111.2) < 2.6;
      case 'swing': return f.crashAwake && !f.crashHit;
      case 'pistol': return p.cur === 'pistol' && f.pistolShots < 3;
      case 'reload': { const w = p.cur; return (w === 'pistol' || w === 'shotgun') && p.mag[w] === 0 && p.reserve[w] > 0 && p.reloadT <= 0; }
      case 'runner': return !!f.runnerSeen;
      case 'heal': return p.hp < 40 && p.hp > 0;
      case 'brute': return !!f.bruteTelegraph;
      case 'hold': return this.holdout.active && this.holdout.t < 5;
    }
    return false;
  }
  clearPrompt(id) {
    const s = this.prompts[id];
    if (s.cleared) return;
    s.cleared = true;
    if (this.prompt && this.prompt.id === id) this.prompt.fade = true;
  }
  updatePrompts(dt) {
    const pr = this.prompt;
    if (pr) {
      pr.t += dt;
      if (pr.fade) pr.alpha -= dt * 3; else pr.alpha = Math.min(1, pr.alpha + dt * 4);
      if (!pr.fade && !this.promptWanted(pr.id) && pr.id !== 'hold') pr.fade = true;
      if (!pr.fade && pr.t > 7) { pr.fade = true; this.prompts[pr.id].cool = 6; } // ignored
      if (pr.alpha <= 0 && pr.fade) this.prompt = null;
    }
    for (const id in this.prompts) {
      const s = this.prompts[id];
      if (s.cool > 0) s.cool -= dt;
      if (this.prompt || s.cleared || s.shows >= 3 || s.cool > 0) continue;
      if (this.promptWanted(id)) { s.shows++; this.prompt = { id, t: 0, alpha: 0, fade: false }; break; }
    }
    // clear conditions that are measured rather than evented
    const p = this.player;
    if (Math.hypot(p.x - this.startPos.x, p.y - this.startPos.y) >= 3) this.clearPrompt('move');
    if (this.holdout.active && this.holdout.t >= 5) this.clearPrompt('hold');
  }

  // ---------------------------------------------------------------- update
  update(dt, input) {
    this.t += dt;
    if (this.state === 'play') this.levelTime += dt;
    const p = this.player;
    if (this.toast) { this.toast.t += dt; if (this.toast.t > 3) this.toast = null; }
    this.shake = Math.max(0, this.shake - dt * 3);
    for (const d of this.dmgDir) d.t += dt;
    this.dmgDir = this.dmgDir.filter((d) => d.t < 0.8);

    if (this.state === 'play') this.updatePlayer(dt, input);
    else if (this.state === 'dead') { this.deadT += dt; if (this.deadT > 1.8 && !this.deathSent) { this.deathSent = true; this.emit('death'); } }
    else if (this.state === 'win') this.updateWin(dt);

    if (this.state !== 'win') {
      this.flowT -= dt;
      if (this.flowT <= 0) { this.world.updateFlow(p.x, p.y); this.flowT = 0.15; }
      this.processSpawns();
      for (const e of this.enemies) if (e.alive) this.updateEnemy(e, dt);
      if (this.enemies.some((e) => !e.alive)) this.enemies = this.enemies.filter((e) => e.alive);
      this.separate();
    }
    this.updateTriggers(dt);
    this.updateHoldout(dt);
    this.updateAlarms(dt);
    if (this.state === 'play') { this.checkBeats(); this.updatePrompts(dt); }
    this.updateFx(dt);
    this.updateMusic(dt);

    // camera: player sits in the lower part of the screen, leaning toward the aim
    const lead = this.state === 'play' ? 1.2 : 0;
    const tx = p.x + Math.cos(p.face) * lead, ty = p.y + Math.sin(p.face) * lead;
    const k = 1 - Math.exp(-dt * 6);
    this.cam.x += (tx - this.cam.x) * k; this.cam.y += (ty - this.cam.y) * k;
    this.audio.listener.x = p.x; this.audio.listener.y = p.y;
  }

  updatePlayer(dt, inp) {
    const p = this.player, f = this.flags;
    p.fireCD -= dt; p.rollCD -= dt; p.invuln -= dt; p.swingT -= dt; p.recoil = Math.max(0, p.recoil - dt * 6);

    // --- movement
    let mx = inp.mx, my = inp.my;
    const ml = Math.hypot(mx, my);
    if (ml > 1) { mx /= ml; my /= ml; }
    p.moving = ml > 0.12;
    if (p.moving) { p.lastMoveX = mx / (ml || 1); p.lastMoveY = my / (ml || 1); }
    if (inp.dodge && p.rollCD <= 0 && p.rollT <= 0) {
      const dx = p.moving ? p.lastMoveX : Math.cos(p.face), dy = p.moving ? p.lastMoveY : Math.sin(p.face);
      p.rollT = PLAYER.rollTime; p.rollDx = dx; p.rollDy = dy; p.invuln = Math.max(p.invuln, PLAYER.rollInvuln); p.rollCD = PLAYER.rollCooldown;
      this.audio.play('roll', { vol: 0.8 });
      this.clearPrompt('runner');
      for (let i = 0; i < 6; i++) this.particles.push({ k: 'dust', x: p.x, y: p.y, vx: rand(-1, 1), vy: rand(-1, 1), t: 0, life: 0.5 });
    }
    let vx, vy;
    if (p.rollT > 0) {
      p.rollT -= dt;
      const sp = PLAYER.rollDist / PLAYER.rollTime;
      vx = p.rollDx * sp; vy = p.rollDy * sp;
      p.sprinting = false;
    } else {
      let speed = PLAYER.walk;
      p.sprinting = inp.sprint && p.moving && p.stamina > 0 && !(p.healing && p.healing.k === 'medkit');
      if (p.sprinting) { speed = PLAYER.sprint; p.stamina = Math.max(0, p.stamina - PLAYER.staminaDrain * dt); p.stamDelay = PLAYER.staminaDelay; }
      else { p.stamDelay -= dt; if (p.stamDelay <= 0) p.stamina = Math.min(PLAYER.stamina, p.stamina + PLAYER.staminaRegen * dt); }
      if (p.healing && p.healing.k === 'medkit') speed *= 0.5;
      const mag = p.sprinting ? 1 : Math.min(1, ml / 0.9);
      vx = p.moving ? (mx / (ml || 1)) * speed * mag : 0;
      vy = p.moving ? (my / (ml || 1)) * speed * mag : 0;
    }
    p.x += vx * dt; p.y += vy * dt;
    this.world.collide(p);
    const sp = Math.hypot(vx, vy);
    p.walk += sp * dt;
    p.stepT -= sp * dt;
    if (p.stepT <= 0 && sp > 0.5) { p.stepT = 1.4; this.audio.play('step', { vol: 0.25 + sp * 0.03, vary: 0.15 }); }

    // --- aim & facing
    let aiming = false;
    if (inp.aimWorld) { p.face = Math.atan2(inp.aimWorld.y - p.y, inp.aimWorld.x - p.x); aiming = true; }
    else if (Math.hypot(inp.ax, inp.ay) > 0.1) { p.face = Math.atan2(inp.ay, inp.ax); aiming = true; }
    else if (p.moving && p.rollT <= 0) { p.face += angDiff(p.face, Math.atan2(my, mx)) * Math.min(1, dt * 12); }
    p.aiming = aiming;

    // --- weapons
    if (inp.swapTo && p.weapons[inp.swapTo]) this.equip(inp.swapTo);
    if (inp.swap) this.cycleWeapon(inp.swap);
    if (inp.reload) this.startReload();
    this.updateReload(dt);
    if (inp.fire && p.rollT <= 0 && p.fireCD <= 0 && p.cur && !(p.healing && p.healing.k === 'medkit')) {
      if (inp.touchAim && this.settings.aimAssist) this.aimAssist();
      this.fire();
    }

    // --- healing
    if (inp.bandage) this.useItem('bandage');
    if (inp.medkit) this.useItem('medkit');
    if (p.healing) {
      const h = p.healing;
      h.t -= dt;
      if (h.k === 'bandage') p.hp = Math.min(p.maxHp, p.hp + (ITEMS.bandage.heal / ITEMS.bandage.time) * dt);
      if (h.t <= 0) {
        if (h.k === 'medkit') { p.hp = Math.min(p.maxHp, p.hp + ITEMS.medkit.heal); p.medkits--; this.stats.medkitsUsed++; this.audio.play('heal'); }
        p.healing = null;
      }
    }

    // --- interact
    const it = this.nearInteract();
    this.interactable = it;
    if (it && inp.interact && !this.interactLock) {
      if (this.interactId !== it.id) { this.interactId = it.id; this.interactT = 0; }
      this.interactT += dt;
      if (this.interactT >= PLAYER.interactTime) { this.doInteract(it); this.interactT = 0; this.interactId = null; this.interactLock = true; }
    } else { this.interactT = 0; this.interactId = null; }
    if (!inp.interact) this.interactLock = false;

    // --- pickups
    for (const pk of this.allPickups()) {
      if (this.consumed.has(pk.id)) continue;
      if (Math.hypot(pk.x - p.x, pk.y - p.y) < 0.75) this.collect(pk);
    }
  }

  allPickups() { return this.extraPickups.length ? L.PICKUPS.concat(this.extraPickups) : L.PICKUPS; }

  equip(w) {
    const p = this.player;
    if (!p.weapons[w] || p.cur === w) return;
    p.cur = w; p.reloadT = 0; p.fireCD = Math.max(p.fireCD, 0.25);
    this.audio.play('click', { vol: 0.6 });
  }
  cycleWeapon(dir) {
    const p = this.player, order = ['crowbar', 'pistol', 'shotgun'].filter((w) => p.weapons[w]);
    if (order.length < 2) return;
    const i = order.indexOf(p.cur);
    this.equip(order[(i + (dir > 0 ? 1 : order.length - 1)) % order.length]);
  }
  startReload() {
    const p = this.player, w = p.cur;
    if (w !== 'pistol' && w !== 'shotgun') return;
    const cfg = WEAPONS[w];
    if (p.reloadT > 0 || p.mag[w] >= cfg.mag || p.reserve[w] <= 0) return;
    p.reloadT = w === 'pistol' ? cfg.reload : cfg.reloadPerShell;
    p.reloadW = w;
    this.audio.play(w === 'pistol' ? 'reload' : 'shell');
    this.clearPrompt('reload');
  }
  updateReload(dt) {
    const p = this.player;
    if (p.reloadT <= 0) return;
    if (p.cur !== p.reloadW) { p.reloadT = 0; return; }
    p.reloadT -= dt;
    if (p.reloadT > 0) return;
    const w = p.reloadW, cfg = WEAPONS[w];
    if (w === 'pistol') {
      const n = Math.min(cfg.mag - p.mag[w], p.reserve[w]);
      p.mag[w] += n; p.reserve[w] -= n; p.reloadT = 0;
    } else {
      p.mag[w]++; p.reserve[w]--;
      if (p.mag[w] < cfg.mag && p.reserve[w] > 0) { p.reloadT = cfg.reloadPerShell; this.audio.play('shell'); }
      else { p.reloadT = 0; this.audio.play('pump'); }
    }
  }

  aimAssist() {
    const p = this.player, max = (PLAYER.aimAssistDeg * Math.PI) / 180;
    const range = p.cur === 'crowbar' ? 3 : p.cur === 'shotgun' ? WEAPONS.shotgun.range : WEAPONS.pistol.range;
    let best = null, bd = 1e9;
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const dx = e.x - p.x, dy = e.y - p.y, d = Math.hypot(dx, dy);
      if (d > range || Math.abs(angDiff(p.face, Math.atan2(dy, dx))) > max) continue;
      if (!this.world.los(p.x, p.y, e.x, e.y, BULLET)) continue;
      if (d < bd) { bd = d; best = e; }
    }
    if (best) p.face = Math.atan2(best.y - p.y, best.x - p.x);
  }

  fire() {
    const p = this.player, w = p.cur, f = this.flags;
    if (w === 'crowbar') {
      const cfg = WEAPONS.crowbar;
      p.fireCD = cfg.rate; p.swingT = 0.28;
      this.audio.play('swing');
      const half = (cfg.arc / 2) * Math.PI / 180;
      const hits = this.enemies.filter((e) => e.alive && Math.hypot(e.x - p.x, e.y - p.y) < cfg.range + e.r &&
        Math.abs(angDiff(p.face, Math.atan2(e.y - p.y, e.x - p.x))) < half && this.world.los(p.x, p.y, e.x, e.y, SOLID))
        .sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y)).slice(0, 2);
      for (const e of hits) { this.damageEnemy(e, cfg.dmg, Math.cos(p.face), Math.sin(p.face), 0.5); this.audio.play('thud', { x: e.x, y: e.y }); }
      this.noise(p.x, p.y, cfg.noise);
      return;
    }
    const cfg = WEAPONS[w];
    if (p.reloadT > 0 && w === 'shotgun' && p.mag.shotgun > 0) p.reloadT = 0; // firing interrupts shell loading
    if (p.reloadT > 0) return;
    if (p.mag[w] <= 0) {
      p.fireCD = 0.3;
      this.audio.play('click');
      if (p.reserve[w] <= 0) {
        const other = w === 'shotgun' && (p.mag.pistol + p.reserve.pistol > 0) ? 'pistol' : 'crowbar';
        this.showToast('Out of ammo');
        this.equip(other);
      }
      return;
    }
    p.mag[w]--; p.fireCD = cfg.rate; p.recoil = 1;
    this.stats.shots++;
    if (w === 'pistol') { f.pistolFired = true; f.pistolShots = (f.pistolShots || 0) + 1; if (f.pistolShots >= 3) this.clearPrompt('pistol'); }
    const mx = p.x + Math.cos(p.face) * 0.7, my = p.y + Math.sin(p.face) * 0.7;
    this.flashes.push({ x: mx, y: my, t: 0 });
    this.particles.push({ k: 'casing', x: p.x, y: p.y, vx: Math.cos(p.face + 1.6) * 2.5, vy: Math.sin(p.face + 1.6) * 2.5, t: 0, life: 0.6 });
    this.audio.play(w, { vol: 1, vary: 0.04 });
    this.noise(p.x, p.y, cfg.noise);
    this.cue(p.x, p.y, 'shot');
    const pellets = w === 'shotgun' ? cfg.pellets : 1;
    let anyHit = false;
    for (let k = 0; k < pellets; k++) {
      const spread = (cfg.spreadDeg * Math.PI) / 180;
      const a = p.face + (w === 'shotgun' ? (k / (pellets - 1) - 0.5) * 2 * spread + rand(-0.03, 0.03) : rand(-spread, spread));
      if (this.shoot(p.x, p.y, a, w)) anyHit = true;
    }
    if (anyHit) this.stats.hits++;
    if (w === 'shotgun') this.shake = Math.min(1, this.shake + 0.35);
    if (p.mag[w] === 0 && p.reserve[w] > 0) this.prompts.reload.cool = 0;
  }

  shoot(x0, y0, a, w) {
    const cfg = WEAPONS[w], dx = Math.cos(a), dy = Math.sin(a);
    let wall = this.world.cast(x0, y0, dx, dy, cfg.range, BULLET);
    let hit = null, hd = wall;
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const ex = e.x - x0, ey = e.y - y0, t = ex * dx + ey * dy;
      if (t < 0 || t > hd) continue;
      const px = ex - t * dx, py = ey - t * dy, d2 = px * px + py * py, rr = (e.r + 0.08) ** 2;
      if (d2 < rr) { const tt = t - Math.sqrt(rr - d2); if (tt < hd) { hd = Math.max(0, tt); hit = e; } }
    }
    this.tracers.push({ x0: x0 + dx * 0.6, y0: y0 + dy * 0.6, x1: x0 + dx * hd, y1: y0 + dy * hd, t: 0, w });
    const hx = x0 + dx * hd, hy = y0 + dy * hd;
    if (hit) {
      let dmg = cfg.dmg;
      if (w === 'shotgun') dmg *= hd <= cfg.full ? 1 : hd >= cfg.half ? 0.5 : 1 - 0.5 * (hd - cfg.full) / (cfg.half - cfg.full);
      if (w === 'pistol' && hd > cfg.accurate && Math.random() < (hd - cfg.accurate) / 15) { hit = null; }
      else { this.damageEnemy(hit, dmg, dx, dy, w === 'shotgun' ? 0.25 : 0.15); return true; }
    }
    if (hd < cfg.range - 0.01) {
      for (let i = 0; i < 4; i++) this.particles.push({ k: 'spark', x: hx - dx * 0.1, y: hy - dy * 0.1, vx: -dx * rand(1, 4) + rand(-2, 2), vy: -dy * rand(1, 4) + rand(-2, 2), t: 0, life: 0.25 });
      this.audio.play('ricochet', { x: hx, y: hy, vol: 0.35, throttle: 0.05 });
      for (const k in ALARM_CARS) { const c = ALARM_CARS[k]; if (this.alarms[k] && this.alarms[k].active && inRect(hx + dx * 0.3, hy + dy * 0.3, c.r)) this.stopAlarm(k, true); }
    }
    return false;
  }

  damageEnemy(e, dmg, dx, dy, knock) {
    if (!e.alive) return;
    e.hp -= dmg; e.hitT = 0.12;
    if (e.type !== 'brute') { e.kx += dx * knock * 8; e.ky += dy * knock * 8; }
    if (e.state !== 'chase') this.wake(e, 'chase');
    e.lastSeen = this.t;
    if (e.pid === 'w_crash') { this.flags.crashHit = true; this.clearPrompt('swing'); }
    this.audio.play('wet', { x: e.x, y: e.y, vol: 0.9, throttle: 0.03 });
    for (let i = 0; i < 5; i++) this.particles.push({ k: 'blood', x: e.x, y: e.y, vx: dx * rand(1, 4) + rand(-1.5, 1.5), vy: dy * rand(1, 4) + rand(-1.5, 1.5), t: 0, life: rand(0.3, 0.6) });
    if (Math.random() < 0.5) this.addDecal({ k: 'splat', x: e.x + dx * rand(0.3, 1), y: e.y + dy * rand(0.3, 1), s: rand(0.3, 0.6), a: rand(0, TAU) });
    if (e.hp <= 0) this.killEnemy(e, dx, dy);
  }

  killEnemy(e, dx, dy) {
    e.alive = false;
    this.stats.kills++;
    this.audio.play(e.type === 'brute' ? 'brute' : 'zdeath', { x: e.x, y: e.y, rate: e.type === 'brute' ? 0.7 : e.type === 'runner' ? 1.3 : 1 });
    this.addDecal({ k: 'corpse', x: e.x, y: e.y, a: Math.atan2(dy, dx), type: e.type, s: e.r });
    this.addDecal({ k: 'pool', x: e.x + dx * 0.3, y: e.y + dy * 0.3, s: e.r * 1.4, a: rand(0, TAU) });
    if (e.pid === 'w_crash' || this.beat === 1) this.flags.crashKill = true;
    if (e.zone === 'rest' && e.type === 'walker') this.flags.restKills++;
    if (e.type === 'brute') { this.flags.bruteDead = true; this.flags.bruteTelegraph = false; this.stopAlarm('square'); }
  }

  addDecal(d) {
    this.decals.push(d);
    if (this.decals.length > 90) { const i = this.decals.findIndex((x) => x.k !== 'corpse'); this.decals.splice(i >= 0 ? i : 0, 1); }
  }

  damagePlayer(dmg, fromX, fromY, knock = 0) {
    const p = this.player;
    if (this.state !== 'play' || p.invuln > 0) return false;
    p.hp -= dmg; p.invuln = PLAYER.hitGrace;
    this.lastHit = this.t;
    this.dmgDir.push({ a: Math.atan2(fromY - p.y, fromX - p.x), t: 0 });
    this.shake = Math.min(1, this.shake + 0.3 + dmg / 60);
    if (p.healing) p.healing = null;
    this.audio.play('hurt', { vol: 0.9 });
    if (knock) { const a = Math.atan2(p.y - fromY, p.x - fromX); p.x += Math.cos(a) * knock; p.y += Math.sin(a) * knock; this.world.collide(p); }
    for (let i = 0; i < 6; i++) this.particles.push({ k: 'blood', x: p.x, y: p.y, vx: rand(-3, 3), vy: rand(-3, 3), t: 0, life: 0.4 });
    if (p.hp <= 0) {
      p.hp = 0; this.state = 'dead'; this.deadT = 0; this.deathSent = false;
      const key = this.encounterKey();
      this.deaths[key] = (this.deaths[key] || 0) + 1;
      this.audio.play('death');
    }
    return true;
  }

  encounterKey() { return this.holdout.active ? 'holdout' : 'beat' + this.beat; }

  useItem(k) {
    const p = this.player;
    if (p.healing || p.hp >= p.maxHp) return;
    if (k === 'bandage' && p.bandages > 0) { p.bandages--; p.healing = { k, t: ITEMS.bandage.time, start: p.hp }; this.audio.play('heal'); }
    else if (k === 'medkit' && p.medkits > 0) { p.healing = { k, t: ITEMS.medkit.time }; this.audio.play('heal', { rate: 0.8 }); }
    else return;
    this.clearPrompt('heal');
  }

  // ---------------------------------------------------------------- interactions & pickups
  nearInteract() {
    const p = this.player;
    let best = null, bd = PLAYER.interactRange;
    for (const it of L.INTERACTS) {
      if (!this.interactAvailable(it)) continue;
      const d = Math.hypot(it.x - p.x, it.y - p.y);
      if (d < bd) { bd = d; best = it; }
    }
    return best && !this.interactLock ? best : best ? { ...best, locked: true } : null;
  }
  interactAvailable(it) {
    if (it.k === 'crowbar') return !this.flags.crowbar;
    if (it.k === 'cache') return !this.used.has(it.id);
    if (it.k === 'door') return true;
    if (it.k === 'generator') return this.beat === 6 && !this.holdout.active && !this.flags.gateOpen;
    return false;
  }
  interactLabel(it) {
    if (it.k === 'door') return this.doorOpen ? 'Close door' : 'Open door';
    return it.label;
  }
  doInteract(it) {
    if (it.locked) return;
    const p = this.player, f = this.flags;
    if (it.k === 'crowbar') {
      f.crowbar = true; p.weapons.crowbar = true; p.cur = 'crowbar';
      this.audio.play('pickup'); this.clearPrompt('pickup');
      const w = this.enemies.find((e) => e.pid === 'w_crash');
      if (w) this.wake(w, 'chase');
    } else if (it.k === 'door') {
      if (this.doorOpen) {
        // can't close on someone standing in the doorway
        const blocked = [p, ...this.enemies.filter((e) => e.alive)].some((e) => e.x > 31.4 && e.x < 33.1 && e.y > 84.6 && e.y < 86.9);
        if (blocked) return;
        this.doorOpen = false; this.world.setDoor('office', false);
        this.audio.play('door', { rate: 0.9 });
        if (!f.doorHealUsed) { f.doorHealUsed = true; p.hp = Math.min(Math.max(p.hp, p.maxHp), p.hp + CHECKPOINT_HEAL); this.showToast('+20 health'); this.audio.play('heal'); }
      } else {
        this.doorOpen = true; this.world.setDoor('office', true);
        this.audio.play('door');
        if (!f.doorOpened) {
          f.doorOpened = true;
          this.startAlarm('rest');
          for (let i = 0; i < 3; i++) this.queueSpawn('walker', { pools: ['restWest', 'restEast'], state: 'investigate', target: { x: 50, y: 87 }, zone: 'rest', tag: 'pack', after: this.t + 2 + i * 1.5 });
          this.saveCheckpoint();
        }
      }
    } else if (it.k === 'cache') {
      this.used.add(it.id); this.stats.caches++; p.scrap += ITEMS.scrapCache;
      this.audio.play('cache'); this.showToast('Supply cache  +' + ITEMS.scrapCache + ' scrap');
    } else if (it.k === 'generator') {
      this.startHoldout();
    }
  }

  collect(pk) {
    const p = this.player, f = this.flags;
    this.consumed.add(pk.id);
    switch (pk.k) {
      case 'pistol': p.weapons.pistol = true; p.mag.pistol = WEAPONS.pistol.mag; f.pistol = true; this.equip('pistol'); this.audio.play('reload'); this.showToast('Pistol'); break;
      case 'shotgun': p.weapons.shotgun = true; p.mag.shotgun = WEAPONS.shotgun.mag; f.shotgun = true; this.equip('shotgun'); this.audio.play('pump'); this.showToast('Shotgun'); break;
      case 'ammo': p.reserve.pistol += ITEMS.ammoPack; this.audio.play('ammo'); this.showToast('+' + ITEMS.ammoPack + ' pistol rounds'); break;
      case 'shells': p.reserve.shotgun += ITEMS.shellPack; this.audio.play('ammo'); this.showToast('+' + ITEMS.shellPack + ' shells'); break;
      case 'bandage': p.bandages++; this.audio.play('pickup'); this.showToast('Bandage'); break;
      case 'medkit': p.medkits++; this.audio.play('pickup'); this.showToast('Medkit'); break;
      case 'scrap': p.scrap += ITEMS.scrapPile; this.audio.play('pickup', { rate: 1.3 }); this.showToast('+' + ITEMS.scrapPile + ' scrap'); break;
      case 'key':
        f.key = true; this.audio.play('pickup', { rate: 0.8 }); this.showToast('Generator key');
        for (const pl of L.PLACED) if (pl.at === 'key') this.queueSpawn(pl.t, { point: [pl.x, pl.y], state: 'dormant', pose: pl.pose, face: pl.face, pid: pl.id, zone: pl.zone });
        this.saveCheckpoint();
        break;
      case 'crate': p.reserve.pistol += ITEMS.crate.ammo; p.reserve.shotgun += ITEMS.crate.shells; this.audio.play('ammo'); this.showToast('Ammo crate: +' + ITEMS.crate.ammo + ' rounds, +' + ITEMS.crate.shells + ' shells'); break;
    }
  }

  showToast(text) { this.toast = { text, t: 0 }; }

  // ---------------------------------------------------------------- triggers
  updateTriggers(dt) {
    const p = this.player, f = this.flags;
    if (this.state !== 'play') return;
    if (!f.lot && inRect(p.x, p.y, [27.5, 82, 52.5, 100])) {
      f.lot = true;
      for (const e of this.enemies) if (e.group === 'pumps') this.wake(e, 'chase');
    }
    if (!f.overpassReached && p.y < 82) {
      f.overpassReached = true;
      if (f.pistol && !f.pistolFired) {
        f.silentStep = true; p.scrap += ITEMS.silentStepBonus; p.cosmetic = 'bandana';
        this.showToast('Silent Step: bandana unlocked, +' + ITEMS.silentStepBonus + ' scrap'); this.audio.play('cache');
      }
    }
    if (!f.mid && inRect(p.x, p.y, [37, 72, 43, 75.5])) {
      f.mid = true;
      for (let i = 0; i < 2; i++) this.queueSpawn('runner', { pools: ['restWest', 'restEast'], state: 'chase', noLeash: true, zone: 'overpass' });
      for (let i = 0; i < 2; i++) this.queueSpawn('runner', { pools: ['mapleWestMid', 'mapleEastMid'], state: 'chase', noLeash: true, zone: 'overpass' });
    }
    if (!f.runnerSeen) for (const e of this.enemies) {
      if (e.alive && e.type === 'runner' && Math.hypot(e.x - p.x, e.y - p.y) < 13 && this.world.los(p.x, p.y, e.x, e.y)) { f.runnerSeen = true; break; }
    }
    if (!f.fightA && p.y < 57 && p.y > 44 && p.x > 30 && p.x < 50) {
      f.fightA = true; f.fightAT = this.t;
      for (let i = 0; i < 3; i++) this.queueSpawn('walker', { pools: ['squareWest', 'squareEast', 'mapleWestMid'], state: 'chase', noLeash: true, zone: 'maple', tag: 'fightA' });
      for (let i = 0; i < 3; i++) this.queueSpawn('runner', { pools: ['mapleEastMid', 'squareEast', 'mapleWestMid'], state: 'chase', noLeash: true, zone: 'maple', tag: 'fightA', after: this.t + 4 + i });
    }
    if (f.fightA && !f.fightB) {
      const left = this.enemies.filter((e) => e.alive && e.tag === 'fightA').length + this.queue.filter((q) => q.tag === 'fightA').length;
      if (this.t - f.fightAT > 28 || (left <= 2 && this.t - f.fightAT > 10) || (p.y < 44)) {
        f.fightB = true;
        for (let i = 0; i < 3; i++) this.queueSpawn('walker', { pools: ['squareWest', 'squareEast', 'mapleEastMid'], state: 'chase', noLeash: true, zone: 'maple', tag: 'fightB' });
        for (let i = 0; i < 3; i++) this.queueSpawn('runner', { pools: ['mapleWestMid', 'squareWest', 'mapleEastMid'], state: 'chase', noLeash: true, zone: 'maple', tag: 'fightB', after: this.t + 3 + i });
      }
    }
    if (!f.square && p.y < 43.5 && p.y > 27 && p.x > 25 && p.x < 55) {
      f.square = true;
      this.startAlarm('square');
      const runnersPending = () => this.queue.some((q) => q.type === 'runner');
      this.queueSpawn('brute', { pools: ['squareWest', 'squareEast', 'westLane'], state: 'investigate', target: { x: 43, y: 39.5 }, zone: 'maple', tag: 'brute', after: this.t + (runnersPending() ? 10 : 3) });
    }
    if (f.square && !f.bruteSeen) {
      const b = this.enemies.find((e) => e.alive && e.type === 'brute');
      if (b) { f.bruteSeen = true; this.audio.play('bruteRoar', { x: b.x, y: b.y, range: 45 }); this.cue(b.x, b.y, 'brute'); }
    }
  }

  enterCourtyard() {
    this.holdSnap = this.snapshot();
  }

  // ---------------------------------------------------------------- alarms
  startAlarm(k) {
    const c = ALARM_CARS[k];
    this.alarms[k] = { active: true, t: 0 };
    this.noise(c.x, c.y, 30, 'alarm', { x: c.x - 2, y: c.y });
    const h = this.audio.loop('alarm', { x: c.x, y: c.y, range: 50, vol: 0.55 });
    if (h) this.loops['alarm_' + k] = h;
    this.cue(c.x, c.y, 'alarm');
  }
  stopAlarm(k, shot = false) {
    const a = this.alarms[k];
    if (!a || !a.active) return;
    a.active = false;
    const h = this.loops['alarm_' + k]; if (h) { h.stop(); delete this.loops['alarm_' + k]; }
    if (shot) this.showToast('Alarm silenced');
  }
  updateAlarms(dt) {
    for (const k in this.alarms) {
      const a = this.alarms[k];
      if (!a.active) continue;
      a.t += dt;
      if (Math.floor(a.t * 2) !== Math.floor((a.t - dt) * 2)) this.cue(ALARM_CARS[k].x, ALARM_CARS[k].y, 'alarm');
      if (a.t > 25) this.stopAlarm(k);
    }
    for (const k in this.loops) { const h = this.loops[k]; if (h && h.update) h.update(); }
  }

  // ---------------------------------------------------------------- hold-out
  startHoldout() {
    this.holdSnap = this.snapshot();
    const h = this.holdout;
    h.active = true; h.t = 0; h.wave = 0;
    this.floods = true;
    this.audio.play('genStart');
    const g = this.audio.loop('generator', { x: 40.25, y: 13.75, range: 35, vol: 0.5 });
    if (g) this.loops.generator = g;
    this.showToast('Generator running');
  }
  updateHoldout(dt) {
    const h = this.holdout;
    if (!h.active || this.state === 'win') return;
    if (this.state === 'play') h.t += dt;
    if (this.loops.generator) this.loops.generator.rate(1 + Math.min(1, h.t / HOLDOUT.length) * 0.9);
    while (h.wave < HOLDOUT.waves.length && h.t >= HOLDOUT.waves[h.wave].at) {
      const w = HOLDOUT.waves[h.wave];
      const list = [];
      for (let i = 0; i < w.walkers; i++) list.push('walker');
      for (let i = 0; i < w.runners; i++) list.push('runner');
      list.forEach((type, i) => {
        const breach = w.breaches[i % w.breaches.length];
        this.queueSpawn(type, { pools: L.BREACH[breach].pools, state: 'chase', noLeash: true, tag: 'hold', breach });
      });
      h.wave++;
      this.audio.play('wave');
      this.showToast('Wave ' + h.wave + ' of ' + HOLDOUT.waves.length);
      for (const b of w.breaches) this.cue(L.BREACH[b].x, L.BREACH[b].y, 'breach');
    }
    if (h.t >= HOLDOUT.length && !this.flags.gateOpen) {
      this.flags.gateOpen = true; h.done = true;
      this.world.setDoor('gate', true);
      this.audio.play('gate');
      this.showToast('The gate is open!');
      this.objShow = this.t;
    }
    if (this.flags.gateOpen && this.state === 'play' && this.player.y < L.GATE_EXIT_Y + 0.6 && this.player.x > 38 && this.player.x < 42) this.beginWin();
  }

  beginWin() {
    this.state = 'win'; this.winT = 0; this.flags.won = true;
    this.checkpoint = null;
    this.emit('winstart');
  }
  updateWin(dt) {
    const p = this.player;
    this.winT += dt;
    if (p.y > 1.2) { p.y -= dt * 1.6; p.face = -Math.PI / 2; p.walk += dt * 1.6; }
    if (this.winT > 1.8 && this.flags.gateOpen) {
      this.flags.gateOpen = false; this.world.setDoor('gate', false);
      this.audio.play('gate', { rate: 0.85 }); this.shake = 0.6;
      if (this.loops.generator) { this.loops.generator.stop(); delete this.loops.generator; }
    }
    // enemies outside pile against the gate
    for (const e of this.enemies) if (e.alive) {
      const dx = 40 - e.x, dy = 4.5 - e.y, d = Math.hypot(dx, dy);
      if (d > 0.8) { e.x += (dx / d) * e.c.speed * 0.6 * dt; e.y += (dy / d) * e.c.speed * 0.6 * dt; this.world.collide(e); e.face = Math.atan2(dy, dx); }
      e.anim += dt * 3;
    }
    if (this.winT > 6 && !this.winSent) { this.winSent = true; this.emit('win', this.results()); }
  }

  results() {
    const s = this.stats, p = this.player;
    const stars = [true, s.caches >= STARS.minCaches, this.levelTime < STARS.timeLimit && s.medkitsUsed <= STARS.maxMedkits];
    return {
      stars, time: this.levelTime, scrap: p.scrap, caches: s.caches, kills: s.kills,
      accuracy: s.shots ? s.hits / s.shots : 0, medkitsUsed: s.medkitsUsed, silentStep: !!this.flags.silentStep,
      deaths: Object.values(this.deaths).reduce((a, b) => a + b, 0),
    };
  }

  // ---------------------------------------------------------------- enemy AI
  updateEnemy(e, dt) {
    const p = this.player, c = e.c;
    e.anim += dt * (e.state === 'dormant' ? 0.5 : 1);
    e.hitT -= dt; e.cd -= dt; e.chargeCD -= dt;
    // knockback decay
    if (e.kx || e.ky) { e.x += e.kx * dt; e.y += e.ky * dt; e.kx *= 0.82; e.ky *= 0.82; if (Math.abs(e.kx) + Math.abs(e.ky) < 0.05) e.kx = e.ky = 0; this.world.collide(e); }
    const dx = p.x - e.x, dy = p.y - e.y, dist = Math.hypot(dx, dy), ang = Math.atan2(dy, dx);
    const playerAlive = this.state === 'play';

    // groans identify each type before it is seen
    e.groanT -= dt;
    if (e.groanT <= 0) {
      e.groanT = e.state === 'dormant' ? rand(7, 14) : rand(3, 7);
      if (dist < 26) {
        const name = e.type === 'walker' ? 'walker' + (e.id % 3) : e.type === 'runner' ? 'runner' + (e.id % 2) : 'brute';
        this.audio.play(name, { x: e.x, y: e.y, vol: e.state === 'dormant' ? 0.5 : 0.8, range: 26 });
        this.cue(e.x, e.y, e.type);
      }
    }

    // perception
    let canSee = false;
    if (playerAlive) {
      const range = e.state === 'chase' ? AWARE.chaseSight : AWARE.sight;
      if (dist < range) {
        const inCone = e.state === 'chase' || Math.abs(angDiff(e.face, ang)) < ((AWARE.sightCone / 2) * Math.PI) / 180;
        if ((inCone || dist < 1.8) && this.world.los(e.x, e.y, p.x, p.y)) canSee = true;
      }
    }

    if (e.state === 'dormant') {
      if (canSee) this.wake(e, 'chase');
      return;
    }
    if (e.wakeT > 0) { e.wakeT -= dt; return; }
    if (canSee) { e.lastSeen = this.t; if (e.state !== 'chase') { e.state = 'chase'; } }
    if (!playerAlive && e.state === 'chase') { e.state = 'idle'; e.act = null; }

    // brute charge prompt bookkeeping
    if (e.type === 'brute' && e.act !== 'telegraph' && e.act !== 'charge' && this.flags.bruteTelegraph) { this.flags.bruteTelegraph = false; this.clearPrompt('brute'); }

    if (e.act) { this.updateAttack(e, dt, dist, ang, canSee); return; }

    let speed = c.speed, tx = null, ty = null, useFlow = false;
    if (e.state === 'chase') {
      if (!e.noLeash && this.t - e.lastSeen > AWARE.leash) { e.state = 'return'; }
      else {
        // attack decisions
        if (e.type === 'walker' && canSee && dist < c.reach + p.r) { e.act = 'windup'; e.actT = c.windup; return; }
        if (e.type === 'runner' && canSee && dist < c.circle + 0.6) { e.act = 'circle'; e.actT = rand(0.7, 1.4); return; }
        if (e.type === 'brute') {
          if (canSee && dist < c.reach + p.r) { e.act = 'windup'; e.actT = c.windup; this.audio.play('bruteRoar', { x: e.x, y: e.y, vol: 0.6 }); return; }
          if (canSee && e.chargeCD <= 0 && dist > 4 && dist < 14) {
            e.act = 'telegraph'; e.actT = c.telegraph; this.flags.bruteTelegraph = true;
            this.audio.play('bruteRoar', { x: e.x, y: e.y, range: 40 }); this.cue(e.x, e.y, 'brute');
            return;
          }
        }
        tx = p.x; ty = p.y;
        useFlow = !(canSee && dist < 7 && this.world.los(e.x, e.y, p.x, p.y, SOLID));
      }
    }
    if (e.state === 'investigate') {
      const tg = e.target || { x: e.homeX, y: e.homeY };
      tx = tg.x; ty = tg.y;
      if (Math.hypot(tx - e.x, ty - e.y) < 2.5) { e.state = 'chase'; e.lastSeen = this.t; e.noLeash = e.tag === 'pack' ? false : e.noLeash; }
    }
    if (e.state === 'return') {
      tx = e.homeX; ty = e.homeY; speed *= 0.6;
      if (Math.hypot(tx - e.x, ty - e.y) < 1) { e.state = 'idle'; }
    }
    if (e.state === 'idle') {
      // shamble in place
      if (Math.random() < dt * 0.3) e.face += rand(-1, 1);
      return;
    }
    if (tx === null) return;

    let mx, my;
    if (useFlow) {
      const fd = this.world.flowDir(e.x, e.y);
      if (fd) { mx = fd.x; my = fd.y; } else { const d = Math.hypot(tx - e.x, ty - e.y) || 1; mx = (tx - e.x) / d; my = (ty - e.y) / d; }
    } else { const d = Math.hypot(tx - e.x, ty - e.y) || 1; mx = (tx - e.x) / d; my = (ty - e.y) / d; }
    // unstick
    if (e.jitT > 0) { e.jitT -= dt; mx = mx * 0.3 + e.jx; my = my * 0.3 + e.jy; const l = Math.hypot(mx, my) || 1; mx /= l; my /= l; }
    e.stuckT += dt;
    if (e.stuckT > 1.5) {
      if (Math.hypot(e.x - e.px, e.y - e.py) < 0.4) { const a = rand(0, TAU); e.jx = Math.cos(a); e.jy = Math.sin(a); e.jitT = 0.6; }
      e.stuckT = 0; e.px = e.x; e.py = e.y;
    }
    const sp = e.type === 'walker' ? speed * (0.85 + 0.15 * Math.sin(e.anim * 4)) : speed;
    e.x += mx * sp * dt; e.y += my * sp * dt;
    this.world.collide(e);
    e.face += angDiff(e.face, Math.atan2(my, mx)) * Math.min(1, dt * 8);
    e.moving = true;
  }

  updateAttack(e, dt, dist, ang, canSee) {
    const p = this.player, c = e.c;
    e.actT -= dt;
    const turn = (rate) => (e.face += angDiff(e.face, ang) * Math.min(1, dt * rate));
    const step = (sx, sy, sp) => { e.x += sx * sp * dt; e.y += sy * sp * dt; return this.world.collide(e); };
    switch (e.act) {
      case 'windup':
        turn(e.type === 'brute' ? 3 : 6);
        if (e.type !== 'brute') step(Math.cos(e.face), Math.sin(e.face), 0.4);
        if (e.actT <= 0) {
          const reach = c.reach + p.r + 0.35;
          if (dist < reach && Math.abs(angDiff(e.face, ang)) < 1.2) {
            if (this.damagePlayer(c.dmg, e.x, e.y, e.type === 'brute' ? 1.2 : 0.3)) this.audio.play('thud', { x: p.x, y: p.y, vol: 0.7 });
          }
          e.act = 'recover'; e.actT = c.cooldown;
        }
        break;
      case 'recover':
        if (e.type === 'runner') step(-Math.cos(ang), -Math.sin(ang), 1.5);
        else { turn(3); if (dist > c.reach) step(Math.cos(ang), Math.sin(ang), c.speed * 0.4); }
        if (e.actT <= 0) e.act = null;
        break;
      case 'circle': {
        // orbit at ~3 m, then dash in
        const want = c.circle, radial = (dist - want) * 1.5;
        const tx = -Math.sin(ang) * e.circleDir, ty = Math.cos(ang) * e.circleDir;
        let mx = tx * 3.6 + Math.cos(ang) * radial, my = ty * 3.6 + Math.sin(ang) * radial;
        const l = Math.hypot(mx, my) || 1;
        if (step(mx / l, my / l, Math.min(c.speed, l))) e.circleDir *= -1;
        turn(10);
        if (e.actT <= 0 || dist > want + 3) e.act = canSee && dist <= want + 3 ? 'dash' : null;
        break;
      }
      case 'dash':
        turn(12);
        step(Math.cos(ang), Math.sin(ang), c.speed * 1.25);
        if (dist < c.reach + p.r) { e.act = 'windup'; e.actT = c.windup; }
        if (dist > 8) e.act = null;
        break;
      case 'telegraph':
        if (e.actT > 0.35) { turn(5); e.chargeA = e.face; }
        if (e.actT <= 0) { e.act = 'charge'; e.chargeDist = 0; e.chargeHit = false; this.shake = Math.min(1, this.shake + 0.2); }
        break;
      case 'charge': {
        const cx = Math.cos(e.chargeA), cy = Math.sin(e.chargeA);
        const bx = e.x, by = e.y;
        const hit = step(cx, cy, c.charge);
        const moved = Math.hypot(e.x - bx, e.y - by);
        e.chargeDist += moved;
        e.face = e.chargeA;
        if (Math.random() < 0.5) this.particles.push({ k: 'dust', x: e.x, y: e.y, vx: rand(-1, 1), vy: rand(-1, 1), t: 0, life: 0.5 });
        if (!e.chargeHit && dist < e.r + p.r + 0.15) {
          e.chargeHit = true;
          this.damagePlayer(c.chargeDmg, e.x, e.y, 2.2);
          this.audio.play('slam', { x: p.x, y: p.y, vol: 0.7 });
          e.act = 'recover'; e.actT = 1.0; e.chargeCD = c.chargeCooldown;
          this.flags.bruteTelegraph = false; this.clearPrompt('brute');
        } else if (hit && moved < c.charge * dt * 0.6) {
          e.act = 'stun'; e.actT = c.stun; e.chargeCD = c.chargeCooldown + c.stun;
          this.audio.play('slam', { x: e.x, y: e.y }); this.shake = Math.min(1, this.shake + 0.5);
          for (let i = 0; i < 10; i++) this.particles.push({ k: 'dust', x: e.x + cx * 0.8, y: e.y + cy * 0.8, vx: rand(-3, 3), vy: rand(-3, 3), t: 0, life: 0.8 });
          this.flags.bruteTelegraph = false; this.clearPrompt('brute');
        } else if (e.chargeDist > 18) {
          e.act = 'recover'; e.actT = 0.8; e.chargeCD = c.chargeCooldown;
          this.flags.bruteTelegraph = false; this.clearPrompt('brute');
        }
        break;
      }
      case 'stun':
        if (e.actT <= 0) e.act = null;
        break;
      default: e.act = null;
    }
  }

  separate() {
    const es = this.enemies, p = this.player;
    for (let i = 0; i < es.length; i++) {
      const a = es[i]; if (!a.alive) continue;
      for (let j = i + 1; j < es.length; j++) {
        const b = es[j]; if (!b.alive) continue;
        const dx = b.x - a.x, dy = b.y - a.y, rr = a.r + b.r, d2 = dx * dx + dy * dy;
        if (d2 < rr * rr && d2 > 1e-6) {
          const d = Math.sqrt(d2), push = (rr - d) / 2, nx = dx / d, ny = dy / d;
          const wa = a.type === 'brute' ? 0.1 : b.type === 'brute' ? 0.9 : 0.5;
          a.x -= nx * push * 2 * wa; a.y -= ny * push * 2 * wa; b.x += nx * push * 2 * (1 - wa); b.y += ny * push * 2 * (1 - wa);
        }
      }
      if (this.state === 'play' && p.rollT <= 0) {
        const dx = a.x - p.x, dy = a.y - p.y, rr = a.r + p.r, d2 = dx * dx + dy * dy;
        if (d2 < rr * rr && d2 > 1e-6) {
          const d = Math.sqrt(d2), push = rr - d;
          a.x += (dx / d) * push * 0.7; a.y += (dy / d) * push * 0.7; p.x -= (dx / d) * push * 0.3; p.y -= (dy / d) * push * 0.3;
          this.world.collide(p);
        }
      }
      this.world.collide(a);
    }
  }

  // ---------------------------------------------------------------- fx & music
  updateFx(dt) {
    for (const q of this.particles) {
      q.t += dt; q.x += q.vx * dt; q.y += q.vy * dt;
      const drag = q.k === 'dust' ? 0.9 : q.k === 'ember' ? 0.98 : 0.86;
      q.vx *= drag; q.vy *= drag;
      if (q.k === 'blood' && q.t >= q.life && Math.random() < 0.3) this.addDecal({ k: 'drop', x: q.x, y: q.y, s: rand(0.06, 0.14) });
    }
    this.particles = this.particles.filter((q) => q.t < q.life);
    if (this.particles.length > 350) this.particles.splice(0, this.particles.length - 350);
    for (const t of this.tracers) t.t += dt;
    this.tracers = this.tracers.filter((t) => t.t < 0.08);
    for (const f of this.flashes) f.t += dt;
    this.flashes = this.flashes.filter((f) => f.t < 0.06);
    for (const c of this.cues) c.t += dt;
    this.cues = this.cues.filter((c) => c.t < 1.2);
  }

  updateMusic(dt) {
    const p = this.player;
    let near20 = false, near8 = false, boss = false;
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const d = Math.hypot(e.x - p.x, e.y - p.y);
      if (d < 20) near20 = true;
      if (d < 8 && e.state !== 'dormant') near8 = true;
      if (e.type === 'brute' && (e.state === 'chase' || e.state === 'investigate')) boss = true;
    }
    if (near8 || this.t - this.lastHit < 0.5) this.combatT = 4;
    else this.combatT -= dt;
    const m = { ambience: 1 };
    if (this.state === 'win') { m.ambience = 0.6; m.hold0 = 0.5; }
    else if (this.beat === 6 || this.holdout.active) {
      m.ambience = 0.5; m.hold0 = 1;
      const w = this.holdout.active ? this.holdout.wave : 0;
      if (w >= 1) m.hold1 = 1; if (w >= 2) m.hold2 = 1; if (w >= 3) m.hold3 = 1;
      if (this.flags.gateOpen) { m.hold3 = 0.7; }
    } else if (boss) { m.boss = 1; m.ambience = 0.4; }
    else {
      if (near20) m.tension = 1;
      if (this.combatT > 0) { m.combat = 1; m.tension = 0.6; }
    }
    if (this.state === 'dead') { for (const k in m) m[k] *= 0.3; }
    this.audio.setMusic(m);
  }

  // ---------------------------------------------------------------- save / restore
  snapshot() {
    const p = this.player;
    return JSON.parse(JSON.stringify({
      player: { hp: p.hp, weapons: p.weapons, cur: p.cur, mag: p.mag, reserve: p.reserve, bandages: p.bandages, medkits: p.medkits, scrap: p.scrap, cosmetic: p.cosmetic, x: p.x, y: p.y },
      flags: this.flags, consumed: [...this.consumed], used: [...this.used], beat: this.beat, stats: this.stats, levelTime: this.levelTime,
      doorOpen: this.doorOpen, extra: this.extraPickups,
      prompts: this.prompts,
      enemies: this.enemies.filter((e) => e.alive).map((e) => ({ t: e.type, x: e.homeX, y: e.homeY, pid: e.pid, zone: e.zone, group: e.group, tag: e.tag, noLeash: e.noLeash, face: e.face, pose: e.pose, dormant: e.state === 'dormant', target: e.target })),
      queue: this.queue.map((q) => ({ ...q, after: q.after ? 0 : undefined })),
      alarms: Object.fromEntries(Object.entries(this.alarms).map(([k, v]) => [k, { done: true }])),
    }));
  }

  restore(s, { pos, fullHealth }) {
    this.reset();
    const p = this.player;
    Object.assign(p, { weapons: s.player.weapons, cur: s.player.cur, mag: s.player.mag, reserve: s.player.reserve, bandages: s.player.bandages, medkits: s.player.medkits, scrap: s.player.scrap, cosmetic: s.player.cosmetic });
    p.hp = fullHealth ? PLAYER.hp : s.player.hp;
    p.x = pos.x; p.y = pos.y; p.face = -Math.PI / 2;
    this.cam.x = p.x; this.cam.y = p.y;
    this.flags = s.flags; this.consumed = new Set(s.consumed); this.used = new Set(s.used); this.stats = s.stats; this.levelTime = s.levelTime;
    this.extraPickups = s.extra || [];
    this.prompts = s.prompts;
    for (const k in this.prompts) this.prompts[k].cool = 0;
    this.doorOpen = s.doorOpen; this.world.setDoor('office', s.doorOpen);
    this.enemies = [];
    for (const d of s.enemies) {
      this.spawnEnemy(d.t, d.x, d.y, { state: d.dormant ? 'dormant' : d.tag === 'pack' ? 'investigate' : d.noLeash ? 'chase' : 'idle', pose: d.dormant ? d.pose : 'stand', face: d.face, pid: d.pid, zone: d.zone, group: d.group, tag: d.tag, noLeash: d.noLeash, target: d.target });
    }
    this.queue = s.queue.map((q) => ({ ...q, after: q.after !== undefined ? this.t + 3 : undefined }));
    for (const k in s.alarms) this.alarms[k] = { active: false, t: 99 };
    this.flags.bruteTelegraph = false;
    this.beat = s.beat; this.objShow = this.t;
    if (this.beat === 6) this.holdSnap = s;
    this.setObjective(this.beat);
  }

  saveCheckpoint() {
    this.flags.checkpointSaved = true;
    this.checkpoint = this.snapshot();
    this.audio.play('checkpoint');
    this.emit('checkpoint', this.checkpoint);
  }

  // Called after the death screen. Returns true if an assist should be offered.
  respawn() {
    const key = this.lastDeathKey = this.encounterKey();
    const holdSnap = this.holdSnap && this.beat === 6 ? this.holdSnap : null;
    for (const k in this.loops) { this.loops[k] && this.loops[k].stop(); }
    this.loops = {};
    if (holdSnap) this.restore(holdSnap, { pos: L.HOLDOUT_POS, fullHealth: true });
    else if (this.checkpoint) this.restore(this.checkpoint, { pos: L.CHECKPOINT_POS, fullHealth: true });
    else { const d = this.deaths; this.reset(); this.deaths = d; }
    if (holdSnap) this.holdSnap = holdSnap;
    return (this.deaths[key] || 0) >= ASSIST.deaths;
  }

  applyAssist() {
    const p = this.player;
    p.hp = PLAYER.hp + ASSIST.bonusHp;
    // a free medkit in a walkable spot near the player
    for (let a = 0; a < TAU; a += 0.5) {
      const x = p.x + Math.cos(a) * 1.4, y = p.y + Math.sin(a) * 1.4;
      if (!this.world.solidAt(x, y)) { this.extraPickups.push({ id: 'assist_' + Math.floor(this.t * 1000) + '_' + a.toFixed(1), k: 'medkit', x, y }); break; }
    }
  }

  continueFrom(cp) {
    this.checkpoint = cp;
    this.restore(cp, { pos: L.CHECKPOINT_POS, fullHealth: false });
  }

  stopLoops() { for (const k in this.loops) this.loops[k] && this.loops[k].stop(); this.loops = {}; }
}
