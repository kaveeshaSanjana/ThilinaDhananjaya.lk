import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptPath = fileURLToPath(import.meta.url);
const scriptDir = dirname(scriptPath);
const frontendRoot = resolve(scriptDir, '..');
const landingDist = resolve(frontendRoot, 'landing', 'dist');
const targetDir = resolve(frontendRoot, 'dist');

if (!existsSync(landingDist)) {
  throw new Error(`Standalone landing build not found at: ${landingDist}`);
}

console.log('Landing dist path:', landingDist);
console.log('Target dir path:', targetDir);

// Copy landing files to root dist, merging assets
const landingAssets = resolve(landingDist, 'assets');
const targetAssets = resolve(targetDir, 'assets');
if (existsSync(landingAssets)) {
  mkdirSync(targetAssets, { recursive: true });
  cpSync(landingAssets, targetAssets, { recursive: true });
  console.log('✓ Copied landing assets');
}

// Copy landing index.html as landing-page.html (for use in iframe)
const landingIndex = resolve(landingDist, 'index.html');
const targetLandingPage = resolve(targetDir, 'landing-page.html');
if (existsSync(landingIndex)) {
  cpSync(landingIndex, targetLandingPage);
  console.log('✓ Copied landing index.html to landing-page.html');
} else {
  console.error('❌ Landing index.html not found at:', landingIndex);
}

// Verify the file was copied
if (existsSync(targetLandingPage)) {
  console.log('✓ Verified landing-page.html exists in dist');
} else {
  console.error('❌ landing-page.html not found in dist after copy');
}

console.log(`Merged landing dist to root at: ${targetDir}`);
