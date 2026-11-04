// Build: copies src/ to dist/ and stamps the service worker with a content-hashed
// cache version and the full pre-cache list. dist/ is what GitHub Pages serves.
import { readFileSync, writeFileSync, mkdirSync, rmSync, readdirSync, statSync, copyFileSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const src = join(root, 'src'), out = join(root, 'dist');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));

rmSync(out, { recursive: true, force: true });
const files = [];
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    if (name.startsWith('.')) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p); else files.push(relative(src, p).split('\\').join('/'));
  }
})(src);
files.sort();

const hash = createHash('sha256');
for (const f of files) {
  if (f === 'sw.js') continue;
  hash.update(f); hash.update(readFileSync(join(src, f)));
}
const version = `${pkg.version}-${hash.digest('hex').slice(0, 10)}`;

let bytes = 0;
for (const f of files) {
  const dest = join(out, f);
  mkdirSync(dirname(dest), { recursive: true });
  if (f === 'sw.js') continue;
  copyFileSync(join(src, f), dest);
  bytes += statSync(dest).size;
}
// every asset path is relative so the site works from a repository subpath
const assets = ['./', ...files.filter((f) => f !== 'sw.js')];
const sw = readFileSync(join(src, 'sw.js'), 'utf8')
  .replace(/const VERSION = '[^']*';/, `const VERSION = '${version}';`)
  .replace(/const ASSETS = \[[^\]]*\];/, `const ASSETS = ${JSON.stringify(assets)};`);
writeFileSync(join(out, 'sw.js'), sw);
writeFileSync(join(out, '.nojekyll'), '');
console.log(`Built ${files.length} files (${(bytes / 1024 / 1024).toFixed(2)} MB) to dist/ — cache version ${version}`);
