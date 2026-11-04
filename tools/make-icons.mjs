// Draws the app icons with canvas in headless Chromium and saves PNGs to icons/.
// Usage: node tools/make-icons.mjs   (needs Playwright; set NODE_PATH to a global install if needed)
import { createRequire } from 'node:module';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'icons');
mkdirSync(out, { recursive: true });
const { chromium } = createRequire(import.meta.url)('playwright');

function draw(size, maskable) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const s = size / 512;
  g.scale(s, s);
  // night sky
  const bg = g.createRadialGradient(330, 150, 20, 256, 256, 420);
  bg.addColorStop(0, '#3a2a4a'); bg.addColorStop(0.45, '#151a2a'); bg.addColorStop(1, '#06080d');
  g.fillStyle = bg; g.fillRect(0, 0, 512, 512);
  const k = maskable ? 0.78 : 1;
  g.translate(256, 256); g.scale(k, k); g.translate(-256, -256);
  // moon
  const mg = g.createRadialGradient(350, 140, 10, 350, 140, 150);
  mg.addColorStop(0, 'rgba(255,190,110,0.9)'); mg.addColorStop(0.3, 'rgba(255,140,60,0.35)'); mg.addColorStop(1, 'rgba(255,120,40,0)');
  g.fillStyle = mg; g.beginPath(); g.arc(350, 140, 150, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#ffcf8a'; g.beginPath(); g.arc(350, 140, 52, 0, Math.PI * 2); g.fill();
  g.fillStyle = 'rgba(200,120,60,0.35)'; g.beginPath(); g.arc(335, 128, 12, 0, Math.PI * 2); g.arc(368, 158, 8, 0, Math.PI * 2); g.fill();
  // skyline
  g.fillStyle = '#0b0d14';
  const b = [[20, 330, 60], [80, 300, 50], [130, 340, 70], [200, 290, 40], [240, 320, 80], [320, 280, 50], [370, 330, 70], [440, 300, 72]];
  for (const [x, y, w] of b) g.fillRect(x, y, w, 512 - y);
  g.fillStyle = '#ffb347';
  for (const [x, y] of [[95, 320], [150, 360], [255, 340], [385, 350], [455, 330]]) g.fillRect(x, y, 8, 10);
  // the hand reaching up
  g.save(); g.translate(250, 520); g.rotate(-0.12);
  g.fillStyle = '#9fe07a'; g.strokeStyle = '#1d2a14'; g.lineWidth = 10; g.lineJoin = 'round';
  g.beginPath();
  g.moveTo(-70, 0); g.lineTo(-62, -170);
  g.quadraticCurveTo(-110, -215, -118, -250); g.quadraticCurveTo(-112, -270, -95, -255); g.lineTo(-58, -215);
  g.lineTo(-74, -330); g.quadraticCurveTo(-70, -352, -52, -340); g.lineTo(-30, -240);
  g.lineTo(-22, -362); g.quadraticCurveTo(-8, -384, 6, -362); g.lineTo(8, -240);
  g.lineTo(30, -350); g.quadraticCurveTo(48, -368, 58, -345); g.lineTo(44, -232);
  g.lineTo(78, -300); g.quadraticCurveTo(98, -310, 98, -288); g.lineTo(70, -170); g.lineTo(66, 0);
  g.closePath(); g.stroke(); g.fill();
  g.fillStyle = 'rgba(40,70,25,0.45)';
  g.beginPath(); g.ellipse(-10, -150, 26, 40, 0.2, 0, Math.PI * 2); g.fill();
  g.fillStyle = 'rgba(120,10,10,0.8)';
  g.beginPath(); g.ellipse(30, -110, 14, 22, 0.3, 0, Math.PI * 2); g.ellipse(-40, -60, 10, 16, -0.2, 0, Math.PI * 2); g.fill();
  g.strokeStyle = 'rgba(29,42,20,0.7)'; g.lineWidth = 5;
  g.beginPath(); g.moveTo(-50, -100); g.lineTo(-20, -90); g.moveTo(10, -60); g.lineTo(40, -70); g.stroke();
  g.restore();
  return c.toDataURL('image/png');
}

const browser = await chromium.launch();
const page = await browser.newPage();
const jobs = [['icon-192.png', 192, false], ['icon-512.png', 512, false], ['icon-maskable-512.png', 512, true], ['apple-touch-icon.png', 180, true]];
for (const [name, size, mask] of jobs) {
  const url = await page.evaluate(`(${draw.toString()})(${size}, ${mask})`);
  writeFileSync(join(out, name), Buffer.from(url.split(',')[1], 'base64'));
  console.log('wrote', name);
}
await browser.close();
