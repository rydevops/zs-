// save.js — on-device save data only (checkpoint, scrap, stars, settings). No network.
const KEY = 'zs.level1.save.v1';

export const defaults = () => ({
  settings: { aimAssist: true, music: 0.8, sfx: 1 },
  checkpoint: null,
  bestStars: [false, false, false],
  scrap: 0,
  level2Unlocked: false,
  shotgunStart: false,
  cosmetics: [],
});

export function loadSave() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaults();
    const d = JSON.parse(raw), base = defaults();
    return { ...base, ...d, settings: { ...base.settings, ...(d.settings || {}) } };
  } catch (e) {
    return defaults();
  }
}

export function writeSave(s) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* storage full or blocked: keep playing */ }
}
