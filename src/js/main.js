// main.js — boot, screens, fixed-step loop and lifecycle (pause on background, wake lock).
import { DT, STARS } from './config.js';
import { Game } from './game.js';
import { Renderer } from './render.js';
import { HUD } from './hud.js';
import { Input } from './input.js';
import { AudioEngine, nullAudio } from './audio.js';
import { loadSave, writeSave } from './save.js';
import { registerSW, requestWakeLock, releaseWakeLock, isStandalone, isIOS } from './pwa.js';

const $ = (id) => document.getElementById(id);
const canvas = $('game');
const save = loadSave();
const audio = new AudioEngine('audio/');
audio.setVolumes(save.settings.music, save.settings.sfx);

let mode = 'title'; // title | play | paused | countdown | dead | assist | results
const renderer = new Renderer(canvas);
const hud = new HUD();
let game = new Game({ audio, onEvent });
game.settings.aimAssist = save.settings.aimAssist;
const attract = new Game({ audio: nullAudio });
attract.player.x = 40.5; attract.player.y = 111.5; attract.player.face = -1.75; attract.cam = { x: 40.5, y: 111.5 };
const input = new Input(canvas, hud, () => game);
let shown = 'title';

// ------------------------------------------------------------------ layout
function insets() {
  const cs = getComputedStyle($('safe-probe'));
  const app = $('app').getBoundingClientRect();
  const full = Math.abs(app.width - innerWidth) < 2;
  return {
    t: parseFloat(cs.paddingTop) || 0, b: parseFloat(cs.paddingBottom) || 0,
    l: full ? parseFloat(cs.paddingLeft) || 0 : 0, r: full ? parseFloat(cs.paddingRight) || 0 : 0,
  };
}
function resize() {
  const r = $('app').getBoundingClientRect();
  renderer.resize(r.width, r.height, Math.min(window.devicePixelRatio || 1, 3));
  hud.layout(r.width, r.height, insets());
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 200));

// block page scroll, pinch zoom and pull-to-refresh during play
document.addEventListener('touchmove', (e) => { if (mode === 'play' || mode === 'countdown' || !e.target.closest('.panel')) e.preventDefault(); }, { passive: false });
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('dblclick', (e) => e.preventDefault());

// ------------------------------------------------------------------ screens
function show(id) {
  for (const s of ['title', 'pause', 'settings', 'howto', 'countdown', 'death', 'assist', 'results']) $(s).hidden = s !== id;
  shown = id;
}

function controlsHTML() {
  const rows = [
    ['Move', 'Left stick (thumb, bottom-left)', 'WASD', 'Left stick'],
    ['Aim / fire', 'Right stick — fires past 30% push', 'Mouse / left click', 'Right stick / RT'],
    ['Reload', 'Tap ammo counter', 'R', 'X'],
    ['Dodge roll', 'Double-tap left stick', 'Space', 'B'],
    ['Sprint', 'Push left stick to edge', 'Shift (hold)', 'LS click'],
    ['Interact', 'Hold the button near an object', 'E (hold)', 'Y (hold)'],
    ['Swap weapon', 'Tap weapon icon', '1 / 2 / 3 or wheel', 'D-pad'],
    ['Heal', 'Tap bandage / medkit', 'Q / C', 'LB / RB'],
  ];
  const col = input.device === 'touch' || (input.device !== 'pad' && matchMedia('(pointer: coarse)').matches) ? 1 : input.device === 'pad' ? 3 : 2;
  return '<table>' + rows.map((r) => `<tr><td>${r[0]}</td><td>${r[col]}</td></tr>`).join('') + '</table>';
}

function settingsHTML() {
  const s = save.settings;
  return `<label>Aim assist (touch)<input type="checkbox" data-k="aimAssist" ${s.aimAssist ? 'checked' : ''}></label>
    <label>Music<input type="range" min="0" max="1" step="0.05" data-k="music" value="${s.music}"></label>
    <label>Sound effects<input type="range" min="0" max="1" step="0.05" data-k="sfx" value="${s.sfx}"></label>`;
}
function bindSettings(el) {
  el.innerHTML = settingsHTML();
  el.querySelectorAll('input').forEach((inp) => inp.addEventListener('input', () => {
    const k = inp.dataset.k;
    save.settings[k] = inp.type === 'checkbox' ? inp.checked : parseFloat(inp.value);
    game.settings.aimAssist = save.settings.aimAssist;
    audio.setVolumes(save.settings.music, save.settings.sfx);
    writeSave(save);
  }));
}

function refreshTitle() {
  $('btn-continue').hidden = !save.checkpoint;
  const stars = save.bestStars.map((s) => (s ? '★' : '☆')).join('');
  $('best').innerHTML = `Best: <b>${stars}</b> &nbsp;·&nbsp; Scrap banked: <b>${save.scrap}</b>${save.level2Unlocked ? ' &nbsp;·&nbsp; Level 2 unlocked' : ''}`;
  $('install-hint').hidden = !(isIOS() && !isStandalone());
}

function toTitle() {
  game.stopLoops();
  mode = 'title'; show('title'); refreshTitle();
  releaseWakeLock();
  audio.setMusic({ ambience: 1 });
}

function startPlay(fn) {
  audio.unlock();
  game.stopLoops();
  game = new Game({ audio, onEvent });
  game.settings.aimAssist = save.settings.aimAssist;
  fn(game);
  input.resetSticks();
  mode = 'play'; show(null);
  requestWakeLock();
}

function pause() {
  if (mode !== 'play' && mode !== 'countdown') return;
  mode = 'paused';
  $('controls-pause').innerHTML = controlsHTML();
  bindSettings($('settings-pause'));
  $('btn-restart').hidden = !game.checkpoint && !game.holdSnap;
  show('pause');
  input.resetSticks();
  releaseWakeLock();
}

let countT = 0;
function resumeWithCountdown() {
  audio.unlock(); audio.resume();
  mode = 'countdown'; countT = 3; show('countdown');
  $('count-num').textContent = '3';
  requestWakeLock();
}

function onEvent(type, data) {
  if (type === 'checkpoint') { save.checkpoint = data; writeSave(save); }
  if (type === 'death') {
    const tips = ['Walkers die to two crowbar swings — save your bullets.', 'Double-tap the left stick to roll through an attack.', 'Runners circle before they strike. Roll, then hit them.', 'When the Brute roars, dodge sideways — it can\'t turn mid-charge.', 'Ammo is placed near the fights that need it.'];
    $('death-msg').textContent = tips[Math.floor(Math.random() * tips.length)];
    mode = 'dead'; show('death');
  }
  if (type === 'win') {
    const r = data;
    save.checkpoint = null;
    save.bestStars = save.bestStars.map((s, i) => s || r.stars[i]);
    save.scrap = Math.max(save.scrap, r.scrap);
    save.level2Unlocked = true; save.shotgunStart = true;
    if (r.silentStep && !save.cosmetics.includes('bandana')) save.cosmetics.push('bandana');
    writeSave(save);
    showResults(r);
  }
}

function showResults(r) {
  mode = 'results'; show('results');
  releaseWakeLock();
  $('stars').innerHTML = r.stars.map((s) => `<span class="${s ? 'on' : 'off'}">★</span>`).join('');
  const conds = ['Complete the level', `Find ${STARS.minCaches}+ supply caches (${r.caches}/3)`, `Under 12:00 using ≤ ${STARS.maxMedkits} medkits`];
  $('star-list').innerHTML = conds.map((c, i) => `<div class="${r.stars[i] ? 'ok' : ''}">${r.stars[i] ? '★' : '☆'} ${c}</div>`).join('');
  const mm = Math.floor(r.time / 60), ss = String(Math.floor(r.time % 60)).padStart(2, '0');
  const stats = [['Time', `${mm}:${ss}`], ['Scrap', r.scrap], ['Kills', r.kills], ['Accuracy', Math.round(r.accuracy * 100) + '%'], ['Medkits used', r.medkitsUsed], ['Deaths', r.deaths]];
  $('stats').innerHTML = stats.map(([a, b]) => `<div>${a}</div><div>${b}</div>`).join('');
  $('unlocks').innerHTML = `Level 2 unlocked<br>Shotgun available from the start of Level 2<br>${r.scrap} scrap carried to Level 2${r.silentStep ? '<br>Silent Step: bandana cosmetic' : ''}`;
}

// ------------------------------------------------------------------ buttons
const tap = (id, fn) => $(id).addEventListener('click', (e) => { e.preventDefault(); audio.unlock(); audio.play('ui'); fn(); });
tap('btn-new', () => { save.checkpoint = null; writeSave(save); startPlay((g) => g.newGame()); });
tap('btn-continue', () => startPlay((g) => g.continueFrom(save.checkpoint)));
tap('btn-howto', () => { $('controls-howto').innerHTML = controlsHTML(); show('howto'); });
tap('btn-howto-back', () => show('title'));
tap('btn-settings', () => { bindSettings($('settings-title')); show('settings'); });
tap('btn-settings-back', () => show('title'));
tap('btn-resume', resumeWithCountdown);
tap('btn-restart', () => { game.respawn(); resumeWithCountdown(); });
tap('btn-quit', toTitle);
tap('btn-retry', () => {
  const offer = game.respawn();
  if (offer) { mode = 'assist'; show('assist'); } else resumeWithCountdown();
});
tap('btn-assist-yes', () => { game.applyAssist(); resumeWithCountdown(); });
tap('btn-assist-no', resumeWithCountdown);
tap('btn-again', () => startPlay((g) => g.newGame()));
tap('btn-title', toTitle);
$('title').addEventListener('pointerdown', () => { audio.unlock(); audio.setMusic({ ambience: 1 }); });

// ------------------------------------------------------------------ lifecycle
function backgrounded() {
  if (mode === 'play' || mode === 'countdown') pause();
  audio.suspend();
  releaseWakeLock();
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') backgrounded();
  else if (mode === 'paused' || mode === 'title' || mode === 'results' || mode === 'dead' || mode === 'assist') { audio.resume(); }
});
window.addEventListener('blur', () => { if (mode === 'play' || mode === 'countdown') pause(); });
window.addEventListener('pagehide', backgrounded);

registerSW(() => {
  const t = $('update-toast');
  t.hidden = false;
  setTimeout(() => (t.hidden = true), 7000);
});

// ------------------------------------------------------------------ loop
let last = performance.now(), acc = 0, slowT = 0;
const empty = { mx: 0, my: 0, ax: 0, ay: 0 };

function frameInput() {
  const s = input.frame();
  if (s.pause) pause();
  if (s.objective) game.objShow = game.t;
  if (s.aimScreen) {
    const v = renderer.view;
    if (v) s.aimWorld = { x: v.x0 + s.aimScreen.x / renderer.ppm, y: v.y0 + s.aimScreen.y / renderer.ppm };
  }
  return s;
}

function tick(now) {
  requestAnimationFrame(tick);
  let dt = (now - last) / 1000; last = now;
  if (dt > 0.25) dt = 0.25;

  // adaptive resolution if the device can't hold the frame rate
  if (mode === 'play') {
    if (dt > 1 / 40) slowT += dt; else slowT = Math.max(0, slowT - dt * 0.5);
    if (slowT > 3 && renderer.scale > 0.55) { renderer.scale -= 0.15; slowT = 0; resize(); }
  }

  if (mode === 'play' || mode === 'dead') {
    acc += dt;
    let steps = 0;
    while (acc >= DT && steps < 5) {
      const inp = mode === 'play' ? frameInput() : { ...empty };
      if (mode === 'play' || mode === 'dead') game.update(DT, inp);
      acc -= DT; steps++;
    }
    if (steps === 5) acc = 0;
  } else if (mode === 'countdown') {
    countT -= dt;
    $('count-num').textContent = String(Math.max(1, Math.ceil(countT)));
    input.frame();
    if (countT <= 0) { mode = 'play'; show(null); acc = 0; }
  } else if (mode === 'title') {
    acc += dt;
    while (acc >= DT) { attract.update(DT, { ...empty }); acc -= DT; }
  } else if (mode === 'results') {
    acc += dt;
    while (acc >= DT) { game.update(DT, { ...empty }); acc -= DT; }
  } else { acc = 0; input.frame(); }

  const g = mode === 'title' ? attract : game;
  renderer.draw(g, g.t);
  if (mode !== 'title') {
    const ctx = renderer.ctx;
    ctx.setTransform(renderer.dpr, 0, 0, renderer.dpr, 0, 0);
    hud.draw(ctx, g, input, renderer, g.t);
  }
}

resize();
show('title'); refreshTitle();
requestAnimationFrame((t) => { last = t; tick(t); });

// test hook for automated checks
window.__zs = { get game() { return game; }, get mode() { return mode; }, startPlay, input, renderer, audio };
