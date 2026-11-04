// config.js — tuning values from the Level 1 specification (starting points for playtests).
export const DT = 1 / 60; // fixed simulation step

export const PLAYER = {
  hp: 100, radius: 0.35,
  walk: 4.0, sprint: 6.0,
  stamina: 100, staminaDrain: 20, staminaRegen: 15, staminaDelay: 1.0,
  rollDist: 3, rollTime: 0.4, rollInvuln: 0.25, rollCooldown: 3,
  hitGrace: 0.5,
  interactTime: 0.6, interactRange: 1.5,
  aimAssistDeg: 15, // cone half-angle used to snap touch aim to the nearest enemy
  flashRange: 8, flashFov: 70,
};

export const WEAPONS = {
  crowbar: { name: 'Crowbar', dmg: 25, rate: 0.7, range: 1.7, arc: 110, noise: 6 },
  pistol: { name: 'Pistol', dmg: 20, rate: 1 / 3, mag: 12, reload: 1.2, accurate: 15, spreadDeg: 1.2, range: 30, noise: 20 },
  shotgun: { name: 'Shotgun', pellets: 8, dmg: 10, rate: 1.0, mag: 6, reloadPerShell: 0.6, spreadDeg: 10, range: 14, full: 4, half: 10, noise: 20 },
};

export const ENEMIES = {
  walker: { hp: 40, speed: 1.5, dmg: 10, windup: 1.0, cooldown: 1.5, reach: 1.2, radius: 0.36 },
  runner: { hp: 20, speed: 4.5, dmg: 8, windup: 0.4, cooldown: 1.0, reach: 1.1, circle: 3, radius: 0.33 },
  brute: { hp: 300, speed: 2.0, dmg: 30, charge: 5.0, chargeDmg: 40, telegraph: 1.0, stun: 2.0, windup: 0.9, cooldown: 1.6, reach: 1.7, radius: 0.8, chargeCooldown: 4 },
};

export const AWARE = { sight: 10, sightCone: 120, chaseSight: 16, gunshot: 20, melee: 6, alarm: 30, leash: 8 };

export const SPAWN = { maxAlive: 14, maxAliveHoldout: 18, minDist: 18, sightRange: 30 };

export const ITEMS = {
  ammoPack: 12, shellPack: 6,
  bandage: { heal: 20, time: 3 },
  medkit: { heal: 50, time: 1.5 },
  scrapPile: 5, scrapCache: 15, silentStepBonus: 10,
  crate: { ammo: 48, shells: 12 },
};

export const HOLDOUT = {
  length: 90,
  waves: [
    { at: 0, walkers: 6, runners: 0, breaches: ['east', 'south'] },
    { at: 30, walkers: 5, runners: 3, breaches: ['east', 'south', 'north'] },
    { at: 60, walkers: 6, runners: 4, breaches: ['east', 'south', 'north'] },
  ],
};

export const STARS = { timeLimit: 12 * 60, maxMedkits: 2, minCaches: 2 };
export const CHECKPOINT_HEAL = 20;
export const ASSIST = { deaths: 3, bonusHp: 25 };
