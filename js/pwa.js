// pwa.js — service worker registration, "Update ready" handling and the screen wake lock.

let reg = null;

// Registers the service worker and checks for a new version every time the app is
// opened or brought back to the foreground (when online).
// onUpdateReady(): a new version is installed and waiting.
// canApplyNow(): true when reloading would not interrupt play (e.g. on the title screen).
export function registerSW(onUpdateReady, canApplyNow = () => false) {
  if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
  const waitingFound = () => {
    if (!reg || !reg.waiting || !navigator.serviceWorker.controller) return;
    if (canApplyNow()) applyUpdate(); else onUpdateReady();
  };
  window.addEventListener('load', async () => {
    try {
      // updateViaCache 'none': always ask the server for sw.js, never the HTTP cache
      reg = await navigator.serviceWorker.register('./sw.js', { scope: './', updateViaCache: 'none' });
      // A version downloaded during an earlier session is waiting: apply it now, at launch.
      if (reg.waiting && navigator.serviceWorker.controller && !recentlyApplied()) {
        applyUpdate();
        return;
      }
      const watch = (w) => w && w.addEventListener('statechange', () => { if (w.state === 'installed') waitingFound(); });
      watch(reg.installing);
      reg.addEventListener('updatefound', () => watch(reg.installing));
      checkForUpdate();
    } catch (e) { console.warn('SW registration failed', e); }
  });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') checkForUpdate(); });
  window.addEventListener('online', checkForUpdate);
}

// guards against a reload loop if a waiting worker fails to activate
function recentlyApplied() {
  try { return Date.now() - Number(sessionStorage.getItem('zs-applied-at') || 0) < 15000; } catch (e) { return false; }
}

let lastCheck = 0;
export function checkForUpdate() {
  if (!reg || !navigator.onLine) return;
  const now = Date.now();
  if (now - lastCheck < 2000) return; // debounce rapid focus changes
  lastCheck = now;
  reg.update().catch(() => {});
}

export const updateWaiting = () => !!(reg && reg.waiting && navigator.serviceWorker.controller);

// Activates the waiting version and reloads into it.
export function applyUpdate() {
  if (!reg || !reg.waiting) return false;
  try { sessionStorage.setItem('zs-applied-at', String(Date.now())); } catch (e) {}
  navigator.serviceWorker.addEventListener('controllerchange', () => location.reload(), { once: true });
  reg.waiting.postMessage({ type: 'SKIP_WAITING' });
  return true;
}

let lock = null;
export async function requestWakeLock() {
  try {
    if ('wakeLock' in navigator && document.visibilityState === 'visible' && !lock) {
      lock = await navigator.wakeLock.request('screen');
      lock.addEventListener('release', () => { lock = null; });
    }
  } catch (e) { lock = null; }
}
export function releaseWakeLock() { if (lock) { lock.release().catch(() => {}); lock = null; } }

export const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
export const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
