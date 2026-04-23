import { cpSync, existsSync, mkdirSync, renameSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const root = resolve(scriptDir, '..');
const landingDist = resolve(root, 'landing', 'dist');
const appDist = resolve(root, 'dist');

if (!existsSync(landingDist)) {
  throw new Error(`Landing build not found at: ${landingDist}\nRun: npm --prefix landing run build:embed`);
}

// 1. Rename LMS index.html → app.html so nginx can serve them independently
const appIndex = resolve(appDist, 'index.html');
const appHtml  = resolve(appDist, 'app.html');
if (!existsSync(appIndex)) throw new Error(`LMS build not found at: ${appIndex}`);
renameSync(appIndex, appHtml);
console.log('✓ Renamed dist/index.html → dist/app.html (LMS entry point)');

// 2. Merge landing assets into dist/assets/ (hashed filenames never collide)
const landingAssets = resolve(landingDist, 'assets');
if (existsSync(landingAssets)) {
  const dest = resolve(appDist, 'assets');
  mkdirSync(dest, { recursive: true });
  cpSync(landingAssets, dest, { recursive: true });
  console.log('✓ Merged landing assets → dist/assets/');
}

// 3. Copy landing index.html → dist/index.html (served at /)
const landingIndex = resolve(landingDist, 'index.html');
const destIndex    = resolve(appDist, 'index.html');
writeFileSync(destIndex, readFileSync(landingIndex, 'utf-8'));
console.log('✓ Copied landing index.html → dist/index.html');

// 4. Copy public files (favicon etc.) next to landing index
const publicDir = resolve(root, 'public');
for (const file of ['favicon.ico', 'robots.txt', 'icons.svg', 'placeholder.svg']) {
  const src = resolve(publicDir, file);
  if (existsSync(src)) cpSync(src, resolve(appDist, file));
}
console.log('✓ Synced public files to dist/');

console.log('\nBuild complete:');
console.log('  /             → dist/index.html  (landing site)');
console.log('  /login, etc.  → dist/app.html    (LMS SPA)');
