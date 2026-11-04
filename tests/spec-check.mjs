// Spec acceptance checks that can run headless: node tests/spec-check.mjs
// 1) static data (ammo economy, pickups, weapon stats)
// 2) a scripted "god mode" run through all seven beats that counts every enemy spawned
//    and checks the spawn rules (>= 18 m away and out of sight), the checkpoint and the hold-out.
import { Game } from '../js/game.js';
import { WEAPONS, ENEMIES, HOLDOUT, ITEMS, SPAWN, PLAYER } from '../js/config.js';
import * as L from '../js/level.js';

let failures = 0;
const ok = (cond, msg) => { console.log((cond ? '  ok   ' : '  FAIL ') + msg); if (!cond) failures++; };
const near = (a, b, pct = 0.05) => Math.abs(a - b) <= Math.abs(b) * pct;

console.log('Static data');
const count = (k) => L.PICKUPS.filter((p) => p.k === k).length;
const rounds = WEAPONS.pistol.mag + count('ammo') * ITEMS.ammoPack + count('crate') * ITEMS.crate.ammo;
const shells = WEAPONS.shotgun.mag + count('shells') * ITEMS.shellPack + count('crate') * ITEMS.crate.shells;
ok(rounds === 132, `pistol rounds in level = ${rounds} (spec 132)`);
ok(shells === 30, `shotgun shells in level = ${shells} (spec 30)`);
ok(count('medkit') === 4, `medkits = ${count('medkit')} (spec 4)`);
ok(count('bandage') === 2, `bandages = ${count('bandage')} (crash site + overpass)`);
ok(L.INTERACTS.filter((i) => i.k === 'cache').length === 3, '3 hidden supply caches');
ok(near(WEAPONS.crowbar.dmg, 25) && near(WEAPONS.crowbar.rate, 0.7), 'crowbar 25 dmg / 0.7 s');
ok(near(WEAPONS.pistol.dmg, 20) && near(1 / WEAPONS.pistol.rate, 3) && WEAPONS.pistol.mag === 12 && near(WEAPONS.pistol.reload, 1.2), 'pistol 20 dmg, 3/s, mag 12, 1.2 s reload');
ok(WEAPONS.shotgun.pellets === 8 && near(WEAPONS.shotgun.dmg, 10) && near(WEAPONS.shotgun.rate, 1) && WEAPONS.shotgun.mag === 6 && near(WEAPONS.shotgun.reloadPerShell, 0.6), 'shotgun 8x10, 1/s, mag 6, 0.6 s/shell');
ok(ENEMIES.walker.hp === 40 && ENEMIES.runner.hp === 20 && ENEMIES.brute.hp === 300, 'enemy HP 40 / 20 / 300');
ok(Math.ceil(ENEMIES.walker.hp / WEAPONS.crowbar.dmg) === 2 && Math.ceil(ENEMIES.walker.hp / WEAPONS.pistol.dmg) === 2, 'walker dies to 2 swings or 2 pistol hits');
ok(ENEMIES.walker.speed < PLAYER.walk && ENEMIES.runner.speed > PLAYER.walk && ENEMIES.runner.speed < PLAYER.sprint, 'player outwalks walkers; runners between walk and sprint');
ok(HOLDOUT.length === 90 && HOLDOUT.waves.reduce((a, w) => a + w.walkers, 0) === 17 && HOLDOUT.waves.reduce((a, w) => a + w.runners, 0) === 7, 'hold-out 90 s, 17 walkers + 7 runners');
ok(new Set(HOLDOUT.waves.flatMap((w) => w.breaches)).size === 3, 'all three breach points used');

console.log('Scripted run');
const audio = { listener: { x: 0, y: 0 }, play() {}, loop() { return { update() {}, rate() {}, stop() {} }; }, setMusic() {} };
const g = new Game({ audio });
const spawned = { walker: 0, runner: 0, brute: 0 };
let badSpawns = 0, maxAlive = 0;
const placedAtStart = g.enemies.length;
for (const e of g.enemies) spawned[e.type]++;
const origProcess = g.processSpawns.bind(g);
g.processSpawns = function () {
  const before = this.enemies.length;
  origProcess();
  for (const e of this.enemies.slice(before)) {
    spawned[e.type]++;
    const d = Math.hypot(e.x - this.player.x, e.y - this.player.y);
    if (d < SPAWN.minDist || (d <= SPAWN.sightRange && this.world.los(this.player.x, this.player.y, e.x, e.y))) badSpawns++;
  }
  maxAlive = Math.max(maxAlive, this.aliveCount());
};
g.damagePlayer = () => false; // god mode for the scripted run
const input = { mx: 0, my: 0, ax: 0, ay: 0 };
const run = (sec, inp = input) => { for (let i = 0; i < sec * 60; i++) g.update(1 / 60, inp); };
const tp = (x, y) => { g.player.x = x; g.player.y = y; g.cam.x = x; g.cam.y = y; };
const killAll = (filter = () => true) => { for (const e of g.enemies) if (e.alive && filter(e)) g.killEnemy(e, 1, 0); run(0.05); };
const interact = (id) => g.doInteract(L.INTERACTS.find((i) => i.id === id));

ok(placedAtStart === 12, `dormant enemies placed at level start = ${placedAtStart}`);
run(0.5);
ok(g.beat === 0 && g.objectiveText() === 'Get out of the bus', 'beat 1: Get out of the bus');
// walk out of the bus door using real input
run(0.3, { ...input, mx: 1 }); run(1.0, { ...input, mx: 1 });
tp(41.75, 117.2); run(0.6, { ...input, my: 1 }); run(1.6, { ...input, mx: 1 }); run(1.6, { ...input, my: -1 });
ok(g.prompts.move.cleared, 'tutorial "Move to leave the wreck" cleared after moving 3 m');
ok(g.beat === 1, `beat 2 reached by walking 10 m from the wreck (beat=${g.beat + 1})`);
tp(46.6, 111.6); run(0.2);
ok(g.interactable && g.interactable.id === 'crowbar', 'crowbar in interact range');
run(0.7, { ...input, interact: true });
ok(g.player.weapons.crowbar && g.player.cur === 'crowbar', 'hold interact 0.6 s equips the crowbar');
const crashW = g.enemies.find((e) => e.pid === 'w_crash');
ok(crashW && crashW.state !== 'dormant', 'crowbar pickup wakes the crash-site walker');
// two swings kill it
crashW.x = g.player.x + 1; crashW.y = g.player.y; crashW.wakeT = 0;
g.player.face = 0;
run(0.02, { ...input, fire: true, ax: 1, ay: 0 }); run(0.75, { ...input, ax: 1 }); crashW.x = g.player.x + 1; crashW.y = g.player.y;
run(0.02, { ...input, fire: true, ax: 1, ay: 0 }); run(0.2);
ok(!crashW.alive, 'walker dies to two crowbar swings');
ok(g.beat === 2, 'beat 3: Find a weapon at the gas station');
tp(40, 99); run(0.2);
ok(g.enemies.filter((e) => e.group === 'pumps' && e.state !== 'dormant').length === 3, 'entering the lot wakes the 3 pump walkers');
tp(35, 86.3); run(0.2);
ok(g.player.weapons.pistol && g.player.mag.pistol === 12, 'pistol collected with 12 rounds');
killAll((e) => e.zone === 'rest');
ok(g.flags.restKills >= 3 && g.beat === 3, 'pistol + 3 walker kills completes beat 3');
tp(33.3, 85.75); run(0.1);
interact('office');
ok(g.doorOpen && g.checkpoint && g.alarms.rest && g.alarms.rest.active, 'opening the back office door saves a checkpoint and starts the car alarm');
tp(30.6, 85.8); run(8);
ok(g.enemies.filter((e) => e.tag === 'pack').length === 3, 'alarm draws a pack of 3 walkers');
tp(29.5, 84.6); run(0.1);
ok(g.flags.key && g.beat === 4, 'key collected -> beat 5: Get through the underpass');
const cpHp = g.player.hp;
interact('office'); // close the door
ok(!g.doorOpen && g.flags.doorHealUsed, 'closing the door uses the one-time +20 health');
run(3);
killAll((e) => e.zone === 'rest');
tp(40, 81); run(0.2);
ok(g.flags.overpassReached, 'reached the overpass');
tp(40, 74); run(6);
ok(g.flags.mid, 'overpass midpoint trigger fired');
run(4);
killAll();
tp(40, 58); run(0.2);
tp(40, 62); run(4); killAll();
tp(40, 56); run(10); killAll(); run(12); killAll(); run(20); killAll();
tp(40, 50); run(12); killAll(); run(10); killAll();
tp(40, 40); run(15);
const brute = g.enemies.find((e) => e.type === 'brute');
ok(!!brute, 'car alarm in the square brings the Brute');
ok(g.alarms.square && g.alarms.square.active, 'square car alarm active');
killAll();
tp(40.25, 22); run(0.5);
ok(g.beat === 6, 'entering the courtyard completes beat 6 -> Power the gate');
tp(40.25, 15.2); run(0.2);
ok(g.interactable && g.interactable.id === 'generator', 'generator interactable');
run(0.7, { ...input, interact: true });
ok(g.holdout.active, 'hold-out started');
const breachUse = new Set();
let gateAt = null;
for (let s = 0; s < 92; s++) {
  run(1);
  if (g.flags.gateOpen && gateAt === null) gateAt = g.holdout.t;
  for (const e of g.enemies) if (e.alive && e.tag === 'hold') {
    let best = null, bd = 1e9;
    for (const k in L.BREACH) { const d = Math.hypot(L.BREACH[k].x - e.homeX, L.BREACH[k].y - e.homeY); if (d < bd) { bd = d; best = k; } }
    breachUse.add(best);
  }
  if (s % 3 === 2) killAll();
}
ok(gateAt !== null && gateAt >= 90 && gateAt < 91.1, `gate opens at 90 s (opened at ${gateAt && gateAt.toFixed(1)} s of hold-out time)`);
ok(g.holdout.wave === 3, 'three hold-out waves');
ok(breachUse.size === 3, `enemies arrived from ${breachUse.size} breach approaches`);
tp(40, 2.6); run(0.2); tp(40, 2.0); run(7);
ok(g.flags.won && g.state === 'win', 'walking through the gate wins');

const total = spawned.walker + spawned.runner + spawned.brute;
ok(spawned.walker === 44 && spawned.runner === 17 && spawned.brute === 1, `spawned ${spawned.walker} walkers, ${spawned.runner} runners, ${spawned.brute} brute (${total} total; spec 44/17/1)`);
ok(badSpawns === 0, `no enemy spawned within 18 m or in line of sight (${badSpawns} violations)`);
ok(maxAlive <= SPAWN.maxAliveHoldout, `max alive ${maxAlive} within caps`);
const r = g.results();
ok(r.stars[0], 'star 1 awarded on completion');

console.log('Checkpoint & fail handling');
{
  const c = new Game({ audio });
  const act = (id) => c.doInteract(L.INTERACTS.find((i) => i.id === id));
  const step = (sec) => { for (let i = 0; i < sec * 60; i++) c.update(1 / 60, input); };
  c.damagePlayer(200, c.player.x + 1, c.player.y);
  ok(c.state === 'dead', 'player dies at 0 health');
  c.respawn();
  ok(c.state === 'play' && c.beat === 0 && c.player.y > 114, 'death before the checkpoint restarts from the crash site');
  act('crowbar'); c.collect(L.PICKUPS.find((p) => p.k === 'pistol'));
  c.player.x = 33.3; c.player.y = 85.75; act('office');
  c.player.x = 29.5; c.player.y = 84.6; step(0.1);
  ok(c.flags.key && c.checkpoint, 'checkpoint saved with the key');
  const saved = JSON.stringify({ r: c.checkpoint.player.reserve, m: c.checkpoint.player.mag, b: c.checkpoint.player.bandages, w: c.checkpoint.player.weapons, k: c.checkpoint.flags.key });
  c.player.reserve.pistol = 999; c.player.mag.pistol = 1; c.player.hp = 5;
  c.damagePlayer(50, c.player.x + 1, c.player.y);
  c.respawn();
  const now = JSON.stringify({ r: c.player.reserve, m: c.player.mag, b: c.player.bandages, w: c.player.weapons, k: c.flags.key });
  ok(now === saved && c.player.hp === 100 && Math.hypot(c.player.x - L.CHECKPOINT_POS.x, c.player.y - L.CHECKPOINT_POS.y) < 0.1, 'checkpoint respawn restores ammo and inventory exactly, with full health');
  for (let i = 0; i < 3; i++) { c.player.invuln = 0; c.damagePlayer(500, c.player.x + 1, c.player.y); var offer = c.respawn(); }
  ok(offer, 'after 3 deaths in the same encounter an assist is offered');
  c.applyAssist();
  ok(c.player.hp === 125 && c.extraPickups.some((p) => p.k === 'medkit'), 'assist: +25 health and a free medkit nearby');
}

console.log('Hold-out restart');
{
  const h = new Game({ audio });
  const step = (sec) => { for (let i = 0; i < sec * 60; i++) h.update(1 / 60, input); };
  h.player.weapons.pistol = true; h.player.cur = 'pistol'; h.player.reserve.pistol = 40;
  h.enemies = []; h.beat = 5; h.player.x = 40.25; h.player.y = 22; step(0.1);
  ok(h.beat === 6 && h.holdSnap, 'courtyard entry stores a hold-out restart point');
  h.player.x = 40.25; h.player.y = 15.2; step(0.05);
  for (let i = 0; i < 40; i++) h.update(1 / 60, { ...input, interact: true });
  ok(h.holdout.active, 'generator started');
  h.player.reserve.pistol = 3; h.damagePlayer = Game.prototype.damagePlayer;
  step(35);
  ok(h.holdout.wave === 2 && h.aliveCount() + h.queue.length > 0, 'waves 1 and 2 under way');
  h.player.invuln = 0; h.damagePlayer(500, h.player.x + 1, h.player.y);
  h.respawn();
  ok(!h.holdout.active && h.holdout.t === 0 && h.beat === 6 && h.player.hp === 100, 'death in the hold-out restarts the hold-out with generator and timer reset');
  ok(h.player.reserve.pistol === 40 && !h.enemies.some((e) => e.tag === 'hold') && !h.queue.some((q) => q.tag === 'hold'), 'hold-out restart restores ammo and clears its waves');
}

console.log(failures ? `\n${failures} check(s) failed` : '\nAll checks passed');
process.exit(failures ? 1 : 0);
