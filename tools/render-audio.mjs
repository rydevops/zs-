// Renders the music stems composed in src/js/music.js to looping MP3 files.
// Usage: node tools/render-audio.mjs [stemName...]   (requires ffmpeg with libmp3lame)
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { STEMS, PAD } from '../src/js/music.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'src', 'audio');
const SR = 44100;
mkdirSync(outDir, { recursive: true });
const tmp = join(tmpdir(), 'zs-audio-' + process.pid);
mkdirSync(tmp, { recursive: true });

function wav(L, R) {
  const n = L.length, buf = Buffer.alloc(44 + n * 4);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 4, 4); buf.write('WAVE', 8);
  buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22);
  buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34);
  buf.write('data', 36); buf.writeUInt32LE(n * 4, 40);
  for (let i = 0; i < n; i++) {
    buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, L[i])) * 32767), 44 + i * 4);
    buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, R[i])) * 32767), 46 + i * 4);
  }
  return buf;
}

const names = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(STEMS);
for (const name of names) {
  const t0 = Date.now();
  const m = STEMS[name].render(SR);
  const n = m.L.length, p = Math.round(PAD * SR);
  // periodic padding: [tail of loop][loop][head of loop]
  const pad = (ch) => {
    const o = new Float32Array(n + 2 * p);
    o.set(ch.subarray(n - p), 0); o.set(ch, p); o.set(ch.subarray(0, p), p + n);
    return o;
  };
  const L = pad(m.L), R = pad(m.R);
  let peak = 0, rms = 0;
  for (let i = 0; i < L.length; i++) { peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i])); rms += L[i] * L[i]; }
  const wavPath = join(tmp, name + '.wav');
  writeFileSync(wavPath, wav(L, R));
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', wavPath, '-codec:a', 'libmp3lame', '-b:a', '112k', join(outDir, name + '.mp3')]);
  console.log(`${name}: ${(n / SR).toFixed(2)}s loop, peak ${peak.toFixed(2)}, rms ${Math.sqrt(rms / L.length).toFixed(3)} (${Date.now() - t0} ms)`);
}
rmSync(tmp, { recursive: true, force: true });
