// hud.js — screen-space HUD: drawn on the game canvas, plus touch hit regions.
import { WEAPONS, HOLDOUT, PLAYER } from './config.js';
import { PROMPTS } from './game.js';
import { drawItem, cueColor } from './render.js';

const TAU = Math.PI * 2;
export const THUMB_ZONE = 0.35; // bottom 35% of the screen is reserved for the sticks

export class HUD {
  constructor() {
    this.regions = {};
    this.touchMode = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;
  }

  layout(W, H, ins) {
    const top = ins.t + 8, l = ins.l + 12, r = W - ins.r - 12;
    const zoneTop = H * (1 - THUMB_ZONE);
    const R = this.regions = {};
    R.pause = { x: r - 42, y: top, w: 42, h: 42 };
    R.health = { x: l, y: top + 4, w: Math.min(170, W * 0.38), h: 16 };
    R.objective = { x: W * 0.12, y: top + 48, w: W * 0.76, h: 26 };
    R.weapon = { x: r - 64, y: zoneTop - 62, w: 64, h: 50 };
    R.ammo = { x: r - 64 - 92, y: zoneTop - 62, w: 88, h: 50 };
    R.bandage = { x: l, y: zoneTop - 58, w: 50, h: 46 };
    R.medkit = { x: l + 56, y: zoneTop - 58, w: 50, h: 46 };
    R.interact = { x: W / 2 - 40, y: zoneTop - 150, w: 80, h: 80 };
    this.W = W; this.H = H; this.ins = ins; this.zoneTop = zoneTop;
  }

  hit(x, y, game) {
    for (const k of ['pause', 'weapon', 'ammo', 'bandage', 'medkit', 'interact', 'objective']) {
      const r = this.regions[k];
      if (!r) continue;
      if (k === 'interact' && !game.interactable) continue;
      if (x >= r.x - 6 && x <= r.x + r.w + 6 && y >= r.y - 6 && y <= r.y + r.h + 6) return k;
    }
    return null;
  }

  draw(ctx, game, input, renderer, t) {
    const W = this.W, H = this.H, R = this.regions, p = game.player;
    ctx.save();
    ctx.textBaseline = 'middle';

    // low-health vignette + damage direction flashes
    if (p.hp < 25 && game.state === 'play') {
      const a = 0.25 + 0.15 * Math.sin(t * 6);
      const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.7);
      g.addColorStop(0, 'rgba(120,0,0,0)'); g.addColorStop(1, `rgba(140,0,0,${a})`);
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    }
    for (const d of game.dmgDir) {
      const a = 1 - d.t / 0.8;
      const sp = renderer.w2s(p.x, p.y);
      const ex = sp.x + Math.cos(d.a) * W, ey = sp.y + Math.sin(d.a) * W;
      const g = ctx.createRadialGradient(ex, ey, 0, ex, ey, W * 0.95);
      g.addColorStop(0, `rgba(255,20,20,${0.6 * a})`); g.addColorStop(0.75, `rgba(255,0,0,${0.15 * a})`); g.addColorStop(1, 'rgba(255,0,0,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    }

    // sound cues that happen off-screen: edge markers
    for (const c of game.cues) {
      const col = cueColor(c.kind);
      if (!col || c.kind === 'breach') continue;
      const s = renderer.w2s(c.x, c.y);
      if (s.x > 0 && s.x < W && s.y > 0 && s.y < H) continue;
      const e = edgePoint(W, H, renderer.w2s(p.x, p.y), s, 18, this.ins);
      ctx.fillStyle = `rgba(${col},${0.85 * (1 - c.t / 1.2)})`;
      ctx.beginPath(); ctx.arc(e.x, e.y, 7, 0, TAU); ctx.fill();
      ctx.strokeStyle = `rgba(${col},${0.5 * (1 - c.t / 1.2)})`; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(e.x, e.y, 10 + c.t * 10, 0, TAU); ctx.stroke();
    }

    // waypoint arrow at the screen edge
    const tg = renderer.target;
    if (tg && game.state === 'play' && Math.hypot(tg.x - p.x, tg.y - p.y) > 8) {
      const s = renderer.w2s(tg.x, tg.y);
      if (!(s.x > 20 && s.x < W - 20 && s.y > 20 && s.y < H - 20)) {
        const ps = renderer.w2s(p.x, p.y);
        const e = edgePoint(W, H, ps, s, 30, this.ins, true);
        const a = Math.atan2(s.y - e.y, s.x - e.x);
        ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(a);
        ctx.fillStyle = 'rgba(255,214,90,0.95)'; ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(-8, -11); ctx.lineTo(-3, 0); ctx.lineTo(-8, 11); ctx.closePath(); ctx.stroke(); ctx.fill();
        ctx.restore();
      }
    }

    // tutorial prompt near the player
    if (game.prompt && game.prompt.alpha > 0) {
      const pr = PROMPTS[game.prompt.id];
      const text = !this.touchMode && pr.key ? pr.key : pr.text;
      const s = renderer.w2s(p.x, p.y);
      ctx.globalAlpha = Math.max(0, Math.min(1, game.prompt.alpha));
      pill(ctx, text, s.x, Math.max(this.ins.t + 120, Math.min(s.y - 80, this.zoneTop - 150)), 16, 'rgba(10,12,16,0.78)', '#fff3c4', W);
      ctx.globalAlpha = 1;
    }

    // toast
    if (game.toast) {
      const a = Math.min(1, game.toast.t * 5, (3 - game.toast.t) * 2);
      ctx.globalAlpha = Math.max(0, a);
      pill(ctx, game.toast.text, W / 2, R.objective.y + 52, 14, 'rgba(20,24,30,0.85)', '#e8eef2', W);
      ctx.globalAlpha = 1;
    }

    // ---- top bar: health
    const hb = R.health;
    const pulse = p.hp < 25 ? 0.6 + 0.4 * Math.abs(Math.sin(t * 5)) : 1;
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; roundRect(ctx, hb.x - 3, hb.y - 3, hb.w + 6, hb.h + 6, 6); ctx.fill();
    ctx.fillStyle = '#3a0e0e'; roundRect(ctx, hb.x, hb.y, hb.w, hb.h, 4); ctx.fill();
    const frac = Math.max(0, Math.min(1, p.hp / p.maxHp));
    ctx.fillStyle = `rgba(214,48,40,${pulse})`; roundRect(ctx, hb.x, hb.y, hb.w * frac, hb.h, 4); ctx.fill();
    if (p.hp > p.maxHp) { ctx.fillStyle = '#ffb347'; roundRect(ctx, hb.x, hb.y + hb.h - 4, hb.w * Math.min(1, (p.hp - p.maxHp) / 25), 4, 2); ctx.fill(); }
    if (p.healing && p.healing.k === 'bandage') { ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(hb.x + hb.w * frac, hb.y, Math.min(hb.w * (1 - frac), hb.w * 0.2 * (p.healing.t / 3)), hb.h); }
    ctx.font = 'bold 12px system-ui, sans-serif'; ctx.fillStyle = '#fff'; ctx.textAlign = 'left';
    ctx.fillText(Math.ceil(p.hp) + '', hb.x + 6, hb.y + hb.h / 2 + 1);
    ctx.font = '600 12px system-ui, sans-serif'; ctx.fillStyle = '#c9c2a8';
    ctx.fillText('⚙ ' + p.scrap + ' scrap', hb.x, hb.y + hb.h + 14);
    if (p.healing && p.healing.k === 'medkit') {
      ctx.fillStyle = '#fff'; ctx.fillText('Using medkit… ' + Math.max(0, p.healing.t).toFixed(1) + 's', hb.x, hb.y + hb.h + 30);
    }

    // pause button
    const pb = R.pause;
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.beginPath(); ctx.arc(pb.x + pb.w / 2, pb.y + pb.h / 2, 20, 0, TAU); ctx.fill();
    ctx.fillStyle = '#e8e8e8'; ctx.fillRect(pb.x + 15, pb.y + 13, 4, 16); ctx.fillRect(pb.x + 23, pb.y + 13, 4, 16);

    // hold-out timer (final beat)
    if (game.holdout.active || game.flags.gateOpen) {
      const left = Math.max(0, 90 - game.holdout.t);
      const txt = game.flags.gateOpen ? 'GATE OPEN' : `${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, '0')}`;
      ctx.textAlign = 'center';
      ctx.font = 'bold 22px system-ui, sans-serif';
      const cx = (hb.x + hb.w + pb.x) / 2;
      ctx.fillStyle = 'rgba(0,0,0,0.55)'; roundRect(ctx, cx - 50, pb.y, 100, 44, 8); ctx.fill();
      ctx.fillStyle = game.flags.gateOpen ? '#8dffb0' : left < 10 ? '#ffb347' : '#fff';
      ctx.fillText(txt, cx, pb.y + 16);
      ctx.font = '600 11px system-ui, sans-serif'; ctx.fillStyle = '#c9c2a8';
      ctx.fillText(`WAVE ${game.holdout.wave}/${HOLDOUT.waves.length}`, cx, pb.y + 34);
    }

    // objective (fades after 5 s; tap to bring back)
    const ot = game.t - game.objShow;
    const oa = game.state === 'play' ? (ot < 5 ? 1 : Math.max(0, 1 - (ot - 5))) : 0;
    const otext = game.objectiveText();
    if (otext && oa > 0) {
      ctx.globalAlpha = oa;
      pill(ctx, otext, W / 2, R.objective.y + R.objective.h / 2, 15, 'rgba(0,0,0,0.55)', '#ffe08a', W, true);
      ctx.globalAlpha = 1;
    } else if (otext && game.state === 'play') {
      ctx.globalAlpha = 0.5; ctx.font = '600 11px system-ui'; ctx.textAlign = 'center'; ctx.fillStyle = '#ffe08a';
      ctx.fillText('▾ objective', W / 2, R.objective.y + 10); ctx.globalAlpha = 1;
    }

    // ---- bottom panels
    if (game.state === 'play') {
      // healing items
      for (const k of ['bandage', 'medkit']) {
        const r = R[k], n = k === 'bandage' ? p.bandages : p.medkits;
        ctx.globalAlpha = n > 0 ? 1 : 0.45;
        ctx.fillStyle = 'rgba(0,0,0,0.55)'; roundRect(ctx, r.x, r.y, r.w, r.h, 10); ctx.fill();
        ctx.save(); ctx.translate(r.x + r.w / 2, r.y + r.h / 2 - 4); ctx.scale(42, 42); drawItem(ctx, k, 0, 0); ctx.restore();
        ctx.font = 'bold 12px system-ui'; ctx.textAlign = 'right'; ctx.fillStyle = '#fff'; ctx.fillText('×' + n, r.x + r.w - 5, r.y + r.h - 9);
        ctx.globalAlpha = 1;
      }
      // weapon + ammo
      const wr = R.weapon;
      if (p.cur) {
        ctx.fillStyle = 'rgba(0,0,0,0.55)'; roundRect(ctx, wr.x, wr.y, wr.w, wr.h, 10); ctx.fill();
        ctx.save(); ctx.translate(wr.x + wr.w / 2, wr.y + wr.h / 2 - 5); ctx.scale(48, 48); drawItem(ctx, p.cur, 0, 0); ctx.restore();
        const owned = ['crowbar', 'pistol', 'shotgun'].filter((w) => p.weapons[w]);
        ctx.font = '600 10px system-ui'; ctx.textAlign = 'center'; ctx.fillStyle = '#ddd';
        ctx.fillText(WEAPONS[p.cur].name + (owned.length > 1 ? ' ⇄' : ''), wr.x + wr.w / 2, wr.y + wr.h - 8);
        if (p.cur !== 'crowbar') {
          const ar = R.ammo, mag = p.mag[p.cur], res = p.reserve[p.cur];
          ctx.fillStyle = 'rgba(0,0,0,0.55)'; roundRect(ctx, ar.x, ar.y, ar.w, ar.h, 10); ctx.fill();
          ctx.textAlign = 'center';
          ctx.font = 'bold 22px system-ui'; ctx.fillStyle = mag === 0 ? '#ff6a5a' : '#fff';
          ctx.fillText(mag + '', ar.x + ar.w * 0.36, ar.y + 20);
          ctx.font = '600 14px system-ui'; ctx.fillStyle = res === 0 ? '#ff6a5a' : '#bbb';
          ctx.fillText('/ ' + res, ar.x + ar.w * 0.72, ar.y + 22);
          if (p.reloadT > 0) {
            const total = p.cur === 'pistol' ? WEAPONS.pistol.reload : WEAPONS.shotgun.reloadPerShell;
            ctx.fillStyle = '#ffd25a'; ctx.fillRect(ar.x + 8, ar.y + ar.h - 10, (ar.w - 16) * (1 - p.reloadT / total), 4);
            ctx.font = '600 10px system-ui'; ctx.fillStyle = '#ffd25a'; ctx.fillText('RELOADING', ar.x + ar.w / 2, ar.y + ar.h - 18);
          } else {
            ctx.font = '600 10px system-ui'; ctx.fillStyle = mag === 0 && res > 0 ? '#ffd25a' : '#999';
            ctx.fillText(this.touchMode ? 'TAP TO RELOAD' : 'R  RELOAD', ar.x + ar.w / 2, ar.y + ar.h - 11);
          }
        }
      }
      // interact button
      const it = game.interactable;
      if (it) {
        const r = R.interact, cx = r.x + r.w / 2, cy = r.y + r.h / 2;
        ctx.fillStyle = 'rgba(10,30,45,0.75)'; ctx.beginPath(); ctx.arc(cx, cy, 34, 0, TAU); ctx.fill();
        ctx.strokeStyle = 'rgba(140,210,255,0.9)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(cx, cy, 34, 0, TAU); ctx.stroke();
        if (game.interactT > 0) { ctx.strokeStyle = '#8fd8ff'; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(cx, cy, 34, -Math.PI / 2, -Math.PI / 2 + TAU * Math.min(1, game.interactT / PLAYER.interactTime)); ctx.stroke(); }
        ctx.fillStyle = '#e6f6ff'; ctx.font = 'bold 13px system-ui'; ctx.textAlign = 'center';
        ctx.fillText(this.touchMode ? 'HOLD' : 'HOLD E', cx, cy);
        pill(ctx, game.interactLabel(it), cx, r.y - 14, 13, 'rgba(0,0,0,0.6)', '#cfeeff', W);
      }
    }

    // thumb sticks
    if (this.touchMode && game.state === 'play') {
      const zt = this.zoneTop;
      const g = ctx.createLinearGradient(0, zt - 10, 0, H);
      g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.25)');
      ctx.fillStyle = g; ctx.fillRect(0, zt - 10, W, H - zt + 10);
      for (const side of ['left', 'right']) {
        const st = input.sticks[side];
        if (st.active) {
          ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 2; ctx.fillStyle = 'rgba(255,255,255,0.08)';
          ctx.beginPath(); ctx.arc(st.ox, st.oy, input.stickR, 0, TAU); ctx.fill(); ctx.stroke();
          const fire = side === 'right' && st.mag > 0.3;
          const sprint = side === 'left' && st.mag > 0.95;
          ctx.fillStyle = fire ? 'rgba(255,120,90,0.7)' : sprint ? 'rgba(150,220,255,0.7)' : 'rgba(255,255,255,0.5)';
          ctx.beginPath(); ctx.arc(st.ox + st.dx * input.stickR, st.oy + st.dy * input.stickR, 24, 0, TAU); ctx.fill();
          if (side === 'right') { ctx.strokeStyle = 'rgba(255,120,90,0.35)'; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.arc(st.ox, st.oy, input.stickR * 0.3, 0, TAU); ctx.stroke(); ctx.setLineDash([]); }
        } else {
          const cx = side === 'left' ? W * 0.25 : W * 0.75, cy = zt + (H - zt) * 0.5 - this.ins.b * 0.3;
          ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(cx, cy, input.stickR * 0.8, 0, TAU); ctx.stroke();
          ctx.font = '600 11px system-ui'; ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(255,255,255,0.22)';
          ctx.fillText(side === 'left' ? 'MOVE' : 'AIM / FIRE', cx, cy);
          if (side === 'left') ctx.fillText('double-tap: roll', cx, cy + 16);
        }
      }
    }
    ctx.restore();
  }
}

function edgePoint(W, H, _from, to, pad, ins, avoidZone = false) {
  const x0 = pad + ins.l, x1 = W - pad - ins.r, y0 = pad + ins.t + 90, y1 = (avoidZone ? H * (1 - THUMB_ZONE) - 70 : H - pad - ins.b);
  const from = { x: (x0 + x1) / 2, y: (y0 + y1) / 2 };
  const dx = to.x - from.x, dy = to.y - from.y;
  let t = Infinity;
  if (dx > 0) t = Math.min(t, (x1 - from.x) / dx); if (dx < 0) t = Math.min(t, (x0 - from.x) / dx);
  if (dy > 0) t = Math.min(t, (y1 - from.y) / dy); if (dy < 0) t = Math.min(t, (y0 - from.y) / dy);
  t = Math.max(0, t);
  return { x: Math.max(x0, Math.min(x1, from.x + dx * t)), y: Math.max(y0, Math.min(y1, from.y + dy * t)) };
}

function pill(ctx, text, x, y, size, bg, fg, W, bold = true) {
  ctx.font = `${bold ? 'bold' : '600'} ${size}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  const w = Math.min(W - 24, ctx.measureText(text).width + 24), h = size + 14;
  const cx = Math.max(w / 2 + 12, Math.min(W - w / 2 - 12, x));
  ctx.fillStyle = bg; roundRect(ctx, cx - w / 2, y - h / 2, w, h, h / 2); ctx.fill();
  ctx.fillStyle = fg; ctx.fillText(text, cx, y + 1, W - 40);
}

function roundRect(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
