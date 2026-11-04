// Service worker: pre-caches every file on first visit so the game plays fully offline.
// tools/stamp-sw.mjs stamps VERSION and ASSETS; a new VERSION means a new cache and an update.
const VERSION = '1.0.1-8c48447fa2';
const ASSETS = ["./","index.html","styles.css","manifest.webmanifest","js/audio.js","js/config.js","js/game.js","js/hud.js","js/input.js","js/level.js","js/main.js","js/music.js","js/pwa.js","js/render.js","js/save.js","js/sfx.js","js/synth.js","js/world.js","audio/ambience.mp3","audio/boss.mp3","audio/combat.mp3","audio/hold0.mp3","audio/hold1.mp3","audio/hold2.mp3","audio/hold3.mp3","audio/tension.mp3","icons/apple-touch-icon.png","icons/icon-192.png","icons/icon-512.png","icons/icon-maskable-512.png"];
const CACHE = 'zs-level1-' + VERSION;

self.addEventListener('install', (event) => {
  // cache: 'reload' bypasses the browser HTTP cache so a new version never pre-caches stale files
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS.map((u) => new Request(u, { cache: 'reload' })))));
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k.startsWith('zs-level1-') && k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(req, { ignoreSearch: true });
    if (hit) return hit;
    if (req.mode === 'navigate') {
      const shell = await cache.match('index.html');
      if (shell) return shell;
    }
    try {
      const res = await fetch(req);
      if (res.ok && VERSION === 'dev') cache.put(req, res.clone());
      return res;
    } catch (e) {
      return new Response('Offline', { status: 503, statusText: 'Offline' });
    }
  })());
});
