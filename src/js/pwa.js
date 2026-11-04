// pwa.js — service worker registration, "Update ready" handling and the screen wake lock.

export function registerSW(onUpdateReady) {
  if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
  window.addEventListener('load', async () => {
    try {
      const reg = await navigator.serviceWorker.register('./sw.js', { scope: './' });
      // A version installed during an earlier session is waiting: apply it now, at launch.
      if (reg.waiting && navigator.serviceWorker.controller && !sessionStorage.getItem('zs-updated')) {
        sessionStorage.setItem('zs-updated', '1');
        navigator.serviceWorker.addEventListener('controllerchange', () => location.reload(), { once: true });
        reg.waiting.postMessage({ type: 'SKIP_WAITING' });
        return;
      }
      const watch = (w) => w && w.addEventListener('statechange', () => {
        if (w.state === 'installed' && navigator.serviceWorker.controller) onUpdateReady();
      });
      watch(reg.installing);
      reg.addEventListener('updatefound', () => watch(reg.installing));
      setInterval(() => reg.update().catch(() => {}), 30 * 60 * 1000);
    } catch (e) { console.warn('SW registration failed', e); }
  });
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
