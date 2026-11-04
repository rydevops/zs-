// input.js — multi-touch twin sticks, keyboard + mouse, and the gamepad API.
import { THUMB_ZONE } from './hud.js';

const newStick = () => ({ active: false, id: null, ox: 0, oy: 0, dx: 0, dy: 0, mag: 0, t0: 0 });

export class Input {
  constructor(el, hud, getGame) {
    this.el = el; this.hud = hud; this.getGame = getGame;
    this.sticks = { left: newStick(), right: newStick() };
    this.stickR = 56;
    this.keys = new Set();
    this.mouse = { x: 0, y: 0, down: false, active: false };
    this.edges = {};
    this.interactPtr = null;
    this.lastLeftUp = -1; this.lastLeftDur = 1;
    this.device = 'kb';
    this.padPrev = [];
    this.padSprint = false;
    this.enabled = true;
    this.onPause = null;

    const opt = { passive: false };
    el.addEventListener('pointerdown', (e) => this.down(e), opt);
    window.addEventListener('pointermove', (e) => this.move(e), opt);
    window.addEventListener('pointerup', (e) => this.up(e), opt);
    window.addEventListener('pointercancel', (e) => this.up(e), opt);
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    el.addEventListener('wheel', (e) => { e.preventDefault(); this.edges.swap = e.deltaY > 0 ? 1 : -1; this.device = 'kb'; }, opt);
    window.addEventListener('keydown', (e) => this.key(e, true));
    window.addEventListener('keyup', (e) => this.key(e, false));
    window.addEventListener('blur', () => { this.keys.clear(); this.mouse.down = false; this.resetSticks(); });
  }

  local(e) {
    const r = this.el.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top, w: r.width, h: r.height };
  }

  down(e) {
    e.preventDefault();
    const p = this.local(e);
    if (e.pointerType === 'mouse') {
      this.device = 'kb'; this.hud.touchMode = false;
      this.mouse.x = p.x; this.mouse.y = p.y; this.mouse.active = true;
      const hit = this.hud.hit(p.x, p.y, this.getGame());
      if (hit) { this.button(hit, e.pointerId); return; }
      if (e.button === 0) this.mouse.down = true;
      return;
    }
    this.device = 'touch'; this.hud.touchMode = true;
    try { this.el.setPointerCapture && this.el.setPointerCapture(e.pointerId); } catch (_) {}
    const zoneTop = p.h * (1 - THUMB_ZONE);
    if (p.y >= zoneTop) {
      const side = p.x < p.w / 2 ? 'left' : 'right';
      const st = this.sticks[side];
      if (st.active) return;
      Object.assign(st, { active: true, id: e.pointerId, ox: p.x, oy: p.y, dx: 0, dy: 0, mag: 0, t0: performance.now() });
      if (side === 'left') {
        const now = performance.now();
        if (now - this.lastLeftUp < 320 && this.lastLeftDur < 260) this.edges.dodge = true; // double-tap = dodge roll
      }
      return;
    }
    const hit = this.hud.hit(p.x, p.y, this.getGame());
    if (hit) this.button(hit, e.pointerId);
  }

  button(hit, id) {
    if (hit === 'pause') this.edges.pause = true;
    else if (hit === 'weapon') this.edges.swap = 1;
    else if (hit === 'ammo') this.edges.reload = true;
    else if (hit === 'bandage') this.edges.bandage = true;
    else if (hit === 'medkit') this.edges.medkit = true;
    else if (hit === 'objective') this.edges.objective = true;
    else if (hit === 'interact') this.interactPtr = id;
  }

  move(e) {
    if (e.pointerType === 'mouse') {
      const p = this.local(e);
      this.mouse.x = p.x; this.mouse.y = p.y; this.mouse.active = true;
      if (this.device !== 'pad') this.device = 'kb';
      return;
    }
    for (const side of ['left', 'right']) {
      const st = this.sticks[side];
      if (!st.active || st.id !== e.pointerId) continue;
      e.preventDefault();
      const p = this.local(e), R = this.stickR;
      let dx = (p.x - st.ox) / R, dy = (p.y - st.oy) / R;
      let m = Math.hypot(dx, dy);
      if (m > 1.6) { // drag the base along so reversing is quick
        st.ox = p.x - (dx / m) * 1.6 * R; st.oy = p.y - (dy / m) * 1.6 * R;
        dx = (dx / m) * 1.6; dy = (dy / m) * 1.6; m = 1.6;
      }
      if (m > 1) { dx /= m; dy /= m; m = 1; }
      st.dx = dx; st.dy = dy; st.mag = m;
    }
  }

  up(e) {
    if (e.pointerType === 'mouse') { if (e.button === 0) this.mouse.down = false; return; }
    if (this.interactPtr === e.pointerId) this.interactPtr = null;
    for (const side of ['left', 'right']) {
      const st = this.sticks[side];
      if (st.active && st.id === e.pointerId) {
        if (side === 'left') { this.lastLeftUp = performance.now(); this.lastLeftDur = this.lastLeftUp - st.t0; }
        Object.assign(st, newStick());
      }
    }
  }

  resetSticks() { this.sticks.left = newStick(); this.sticks.right = newStick(); this.interactPtr = null; }

  key(e, down) {
    const c = e.code;
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(c)) e.preventDefault();
    if (down && !this.keys.has(c)) {
      this.device = 'kb'; this.hud.touchMode = false;
      if (c === 'Space') this.edges.dodge = true;
      if (c === 'KeyR') this.edges.reload = true;
      if (c === 'Digit1') this.edges.swapTo = 'crowbar';
      if (c === 'Digit2') this.edges.swapTo = 'pistol';
      if (c === 'Digit3') this.edges.swapTo = 'shotgun';
      if (c === 'KeyQ') this.edges.bandage = true;
      if (c === 'KeyC') this.edges.medkit = true;
      if (c === 'Escape' || c === 'KeyP') this.edges.pause = true;
      if (c === 'Tab') this.edges.objective = true;
    }
    if (down) this.keys.add(c); else this.keys.delete(c);
  }

  pollPad() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const gp = [...pads].find((g) => g && g.connected);
    if (!gp) return null;
    const b = (i) => !!(gp.buttons[i] && gp.buttons[i].pressed);
    const v = (i) => (gp.buttons[i] ? gp.buttons[i].value : 0);
    const edge = (i) => b(i) && !this.padPrev[i];
    const dz = (x, y, d = 0.2) => { const m = Math.hypot(x, y); return m < d ? [0, 0] : [x, y]; };
    const [lx, ly] = dz(gp.axes[0] || 0, gp.axes[1] || 0);
    const [rx, ry] = dz(gp.axes[2] || 0, gp.axes[3] || 0, 0.25);
    const any = lx || ly || rx || ry || gp.buttons.some((x) => x.pressed);
    if (any) { this.device = 'pad'; this.hud.touchMode = false; }
    if (edge(1)) this.edges.dodge = true;
    if (edge(2)) this.edges.reload = true;
    if (edge(14)) this.edges.swap = -1;
    if (edge(15) || edge(12)) this.edges.swap = 1;
    if (edge(4)) this.edges.bandage = true;
    if (edge(5)) this.edges.medkit = true;
    if (edge(9)) this.edges.pause = true;
    if (edge(8) || edge(13)) this.edges.objective = true;
    if (edge(10)) this.padSprint = true;
    if (!lx && !ly) this.padSprint = false;
    this.padPrev = gp.buttons.map((x) => x.pressed);
    return { lx, ly, rx, ry, fire: v(7) > 0.3, interact: b(3), sprint: this.padSprint };
  }

  // Snapshot for one simulation frame; clears edge-triggered actions.
  frame() {
    const k = this.keys, pad = this.pollPad();
    const s = { mx: 0, my: 0, ax: 0, ay: 0, sprint: false, fire: false, touchAim: false, interact: false, aimScreen: null };
    // keyboard
    s.mx = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0);
    s.my = (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0) - (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0);
    s.sprint = k.has('ShiftLeft') || k.has('ShiftRight');
    s.interact = k.has('KeyE') || this.interactPtr !== null;
    if (this.device === 'kb' && this.mouse.active) { s.aimScreen = { x: this.mouse.x, y: this.mouse.y }; s.fire = this.mouse.down; }
    // touch
    const L = this.sticks.left, R = this.sticks.right;
    if (L.active && L.mag > 0.12) { s.mx = L.dx; s.my = L.dy; s.sprint = L.mag > 0.95; }
    if (R.active && R.mag > 0.1) { s.ax = R.dx; s.ay = R.dy; s.fire = R.mag > 0.3; s.touchAim = true; s.aimScreen = null; }
    // gamepad
    if (pad) {
      if (pad.lx || pad.ly) { s.mx = pad.lx; s.my = pad.ly; s.sprint = s.sprint || pad.sprint; }
      if (pad.rx || pad.ry) { s.ax = pad.rx; s.ay = pad.ry; s.aimScreen = null; }
      if (pad.fire) s.fire = true;
      if (pad.interact) s.interact = true;
    }
    Object.assign(s, this.edges);
    this.edges = {};
    return s;
  }
}
