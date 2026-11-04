// world.js — the collision grid, line of sight, ray casts and the enemy flow field.
import { MAP_W, MAP_H, CARVE, BUILDINGS, ROOMS, WALLS, PROPS, DOORS, GROUND } from './level.js';

export const CELL = 0.5;
export const GW = MAP_W / CELL, GH = MAP_H / CELL;
export const SOLID = 1, OPAQUE = 2, BULLET = 4, ALL = 7;
export const GROUND_IDS = { grass: 0, asphalt: 1, concrete: 2, dirt: 3, tile: 4, bus: 5 };

function cellsOf(r, fn) {
  const i0 = Math.max(0, Math.ceil(r[0] / CELL - 0.5)), i1 = Math.min(GW - 1, Math.floor(r[2] / CELL - 0.5));
  const j0 = Math.max(0, Math.ceil(r[1] / CELL - 0.5)), j1 = Math.min(GH - 1, Math.floor(r[3] / CELL - 0.5));
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) fn(j * GW + i, i, j);
}

export function roomWalls(room) {
  const [x0, y0, x1, y1] = room.r, t = CELL;
  const segs = { n: [x0, y0, x1, y0 + t], s: [x0, y1 - t, x1, y1], w: [x0, y0, x0 + t, y1], e: [x1 - t, y0, x1, y1] };
  const out = [];
  for (const side of ['n', 's', 'w', 'e']) {
    const r = segs[side];
    const doors = room.doors.filter((d) => d[0] === side);
    const horiz = side === 'n' || side === 's';
    let a = horiz ? r[0] : r[1];
    const end = horiz ? r[2] : r[3];
    for (const [, d0, d1] of doors.sort((p, q) => p[1] - q[1])) {
      if (d0 > a) out.push(horiz ? [a, r[1], d0, r[3]] : [r[0], a, r[2], d0]);
      a = d1;
    }
    if (end > a) out.push(horiz ? [a, r[1], end, r[3]] : [r[0], a, r[2], end]);
  }
  for (const w of room.inner || []) out.push(w.slice(0, 4));
  return out;
}

export class World {
  constructor() {
    this.g = new Uint8Array(GW * GH);
    this.cover = new Uint8Array(GW * GH); // 1 = covered by a man-made structure (not woods)
    this.ground = new Uint8Array(GW * GH);
    this.dist = new Float32Array(GW * GH);
    this.queue = new Int32Array(GW * GH);
    this.flowCell = -1;
    this.build();
  }

  build() {
    const g = this.g, cover = this.cover;
    g.fill(ALL); cover.fill(0);
    for (const [k, r] of GROUND) { const id = GROUND_IDS[k]; cellsOf(r, (c) => (this.ground[c] = id)); }
    for (const r of CARVE) cellsOf(r, (c) => (g[c] = 0));
    for (const b of BUILDINGS) cellsOf(b.r, (c) => { g[c] = ALL; cover[c] = 1; });
    for (const room of ROOMS) {
      cellsOf(room.r, (c) => (cover[c] = 1));
      const [x0, y0, x1, y1] = room.r;
      cellsOf([x0 + CELL, y0 + CELL, x1 - CELL, y1 - CELL], (c) => (g[c] = 0));
      for (const w of roomWalls(room)) cellsOf(w, (c) => (g[c] = ALL));
      for (const [side, a, b] of room.doors) {
        const r = side === 'w' ? [x0, a, x0 + CELL, b] : side === 'e' ? [x1 - CELL, a, x1, b] : side === 'n' ? [a, y0, b, y0 + CELL] : [a, y1 - CELL, b, y1];
        cellsOf(r, (c) => (g[c] = 0));
      }
    }
    for (const w of WALLS) cellsOf(w, (c) => { g[c] = w[4] === 'rail' ? SOLID : ALL; cover[c] = 1; });
    for (const p of PROPS) {
      if (p.k === 'jersey') { cellsOf(p.r, (c) => (cover[c] = 1)); continue; }
      if (p.noSolid) continue;
      cellsOf(p.r, (c) => { g[c] = SOLID | BULLET | (p.see ? OPAQUE : 0); cover[c] = 1; });
    }
    for (const d of DOORS) cellsOf(d.r, (c) => { g[c] = ALL; cover[c] = 1; });
    this.flowCell = -1;
  }

  setDoor(id, open) {
    const d = DOORS.find((x) => x.id === id);
    cellsOf(d.r, (c) => (this.g[c] = open ? 0 : ALL));
    this.flowCell = -1;
  }

  at(x, y) {
    const i = Math.floor(x / CELL), j = Math.floor(y / CELL);
    if (i < 0 || j < 0 || i >= GW || j >= GH) return ALL;
    return this.g[j * GW + i];
  }
  solidAt(x, y) { return (this.at(x, y) & SOLID) !== 0; }

  // Push a circle out of solid cells. Returns true if it collided.
  collide(e, r = e.r) {
    let hit = false;
    for (let pass = 0; pass < 2; pass++) {
      const i0 = Math.floor((e.x - r) / CELL), i1 = Math.floor((e.x + r) / CELL);
      const j0 = Math.floor((e.y - r) / CELL), j1 = Math.floor((e.y + r) / CELL);
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
        if (i >= 0 && j >= 0 && i < GW && j < GH && !(this.g[j * GW + i] & SOLID)) continue;
        const cx0 = i * CELL, cy0 = j * CELL;
        const nx = Math.max(cx0, Math.min(e.x, cx0 + CELL)), ny = Math.max(cy0, Math.min(e.y, cy0 + CELL));
        let dx = e.x - nx, dy = e.y - ny;
        const d2 = dx * dx + dy * dy;
        if (d2 >= r * r) continue;
        hit = true;
        if (d2 > 1e-9) {
          const d = Math.sqrt(d2), push = r - d;
          e.x += (dx / d) * push; e.y += (dy / d) * push;
        } else {
          // centre inside the cell: push out along the shallowest axis
          const l = e.x - cx0, rr = cx0 + CELL - e.x, t = e.y - cy0, b = cy0 + CELL - e.y;
          const m = Math.min(l, rr, t, b);
          if (m === l) e.x = cx0 - r; else if (m === rr) e.x = cx0 + CELL + r; else if (m === t) e.y = cy0 - r; else e.y = cy0 + CELL + r;
        }
      }
    }
    return hit;
  }

  // Grid DDA; returns distance to the first cell with `mask`, or `max`.
  cast(x0, y0, dx, dy, max, mask) {
    let i = Math.floor(x0 / CELL), j = Math.floor(y0 / CELL);
    const stepI = dx > 0 ? 1 : -1, stepJ = dy > 0 ? 1 : -1;
    const tdx = dx !== 0 ? Math.abs(CELL / dx) : Infinity, tdy = dy !== 0 ? Math.abs(CELL / dy) : Infinity;
    let tx = dx !== 0 ? ((dx > 0 ? (i + 1) * CELL - x0 : x0 - i * CELL) / Math.abs(dx)) : Infinity;
    let ty = dy !== 0 ? ((dy > 0 ? (j + 1) * CELL - y0 : y0 - j * CELL) / Math.abs(dy)) : Infinity;
    let t = 0;
    while (t < max) {
      if (tx < ty) { t = tx; tx += tdx; i += stepI; } else { t = ty; ty += tdy; j += stepJ; }
      if (t >= max) break;
      if (i < 0 || j < 0 || i >= GW || j >= GH) return t;
      if (this.g[j * GW + i] & mask) return t;
    }
    return max;
  }

  los(x0, y0, x1, y1, mask = OPAQUE) {
    const dx = x1 - x0, dy = y1 - y0, d = Math.hypot(dx, dy);
    if (d < 1e-6) return true;
    return this.cast(x0, y0, dx / d, dy / d, d, mask) >= d - 1e-6;
  }

  // Breadth-first distance field from the target over walkable cells (4-neighbour, bounded).
  updateFlow(x, y, maxSteps = 140) {
    const i = Math.floor(x / CELL), j = Math.floor(y / CELL), c0 = j * GW + i;
    if (c0 === this.flowCell) return;
    this.flowCell = c0;
    const dist = this.dist, g = this.g, q = this.queue;
    dist.fill(1e9);
    if (i < 0 || j < 0 || i >= GW || j >= GH) return;
    let head = 0, tail = 0;
    dist[c0] = 0; q[tail++] = c0;
    while (head < tail) {
      const c = q[head++], d = dist[c] + 1;
      if (d > maxSteps) continue;
      const ci = c % GW;
      if (ci > 0 && !(g[c - 1] & SOLID) && dist[c - 1] > d) { dist[c - 1] = d; q[tail++] = c - 1; }
      if (ci < GW - 1 && !(g[c + 1] & SOLID) && dist[c + 1] > d) { dist[c + 1] = d; q[tail++] = c + 1; }
      if (c >= GW && !(g[c - GW] & SOLID) && dist[c - GW] > d) { dist[c - GW] = d; q[tail++] = c - GW; }
      if (c < GW * (GH - 1) && !(g[c + GW] & SOLID) && dist[c + GW] > d) { dist[c + GW] = d; q[tail++] = c + GW; }
    }
  }

  // Direction (unit vector) down the flow field from a position, or null if unreachable.
  flowDir(x, y) {
    const i = Math.floor(x / CELL), j = Math.floor(y / CELL);
    if (i < 1 || j < 1 || i >= GW - 1 || j >= GH - 1) return null;
    const c = j * GW + i, g = this.g, dist = this.dist;
    let best = dist[c], bx = 0, by = 0;
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      if (!di && !dj) continue;
      const n = c + dj * GW + di;
      if (g[n] & SOLID) continue;
      if (di && dj && ((g[c + di] & SOLID) || (g[c + dj * GW] & SOLID))) continue;
      const d = dist[n] + (di && dj ? 0.41 : 0);
      if (d < best) { best = d; bx = di; by = dj; }
    }
    if (!bx && !by) return null;
    // steer toward the centre of the chosen neighbour cell
    const tx = (i + bx + 0.5) * CELL - x, ty = (j + by + 0.5) * CELL - y, l = Math.hypot(tx, ty) || 1;
    return { x: tx / l, y: ty / l, d: best };
  }
  flowDist(x, y) {
    const i = Math.floor(x / CELL), j = Math.floor(y / CELL);
    if (i < 0 || j < 0 || i >= GW || j >= GH) return 1e9;
    return this.dist[j * GW + i];
  }
}
