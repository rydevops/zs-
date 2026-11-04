// Stamps sw.js (at the repository root) with a content-hashed cache version and the
// full pre-cache list. Run it after changing any game file, then commit sw.js:
//   node tools/stamp-sw.mjs          update sw.js in place
//   node tools/stamp-sw.mjs --check  exit 1 if sw.js is out of date (used by CI)
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
// Only the files the game needs are pre-cached (not README, tools or tests).
const ROOT_FILES = ['index.html', 'styles.css', 'manifest.webmanifest'];
const DIRS = ['js', 'audio', 'icons'];

const files = [...ROOT_FILES];
for (const d of DIRS) (function walk(dir) {
  for (const name of readdirSync(dir).sort()) {
    if (name.startsWith('.')) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p); else files.push(relative(root, p).split('\\').join('/'));
  }
})(join(root, d));

const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const hash = createHash('sha256');
let bytes = 0;
for (const f of files) { const b = readFileSync(join(root, f)); hash.update(f); hash.update(b); bytes += b.length; }
const version = `${pkg.version}-${hash.digest('hex').slice(0, 10)}`;
const assets = ['./', ...files];

const swPath = join(root, 'sw.js');
const current = readFileSync(swPath, 'utf8');
const next = current
  .replace(/const VERSION = '[^']*';/, `const VERSION = '${version}';`)
  .replace(/const ASSETS = \[[^\]]*\];/, `const ASSETS = ${JSON.stringify(assets)};`);

if (process.argv.includes('--check')) {
  if (next !== current) { console.error('sw.js is out of date. Run: node tools/stamp-sw.mjs and commit sw.js'); process.exit(1); }
  console.log(`sw.js is up to date (${version})`);
} else {
  writeFileSync(swPath, next);
  console.log(`Stamped sw.js: ${files.length} files (${(bytes / 1024 / 1024).toFixed(2)} MB), cache version ${version}`);
}
