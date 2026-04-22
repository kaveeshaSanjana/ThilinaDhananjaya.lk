import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptPath = fileURLToPath(import.meta.url);
const scriptDir = dirname(scriptPath);
const frontendRoot = resolve(scriptDir, '..');
const landingDist = resolve(frontendRoot, 'landing', 'dist');
const targetDir = resolve(frontendRoot, 'dist');
const landingFolder = resolve(targetDir, 'landing');
const landingSiteFolder = resolve(targetDir, 'landing-site');

function normalizeToRelativeAssets(htmlContent) {
  return htmlContent
    .replace(/<base[^>]*>/gi, '')
    .replace(/src="\/(landing-site|landing)\/assets\//g, 'src="./assets/')
    .replace(/href="\/(landing-site|landing)\/assets\//g, 'href="./assets/')
    .replace(/src="\/assets\//g, 'src="./assets/')
    .replace(/href="\/assets\//g, 'href="./assets/')
    .replace(/src="assets\//g, 'src="./assets/')
    .replace(/href="assets\//g, 'href="./assets/');
}

function normalizeToRootAssets(htmlContent) {
  return htmlContent
    .replace(/<base[^>]*>/gi, '')
    .replace(/src="\.(\/)?assets\//g, 'src="/assets/')
    .replace(/href="\.(\/)?assets\//g, 'href="/assets/')
    .replace(/src="\/(landing-site|landing)\/assets\//g, 'src="/assets/')
    .replace(/href="\/(landing-site|landing)\/assets\//g, 'href="/assets/')
    .replace(/src="assets\//g, 'src="/assets/')
    .replace(/href="assets\//g, 'href="/assets/');
}

if (!existsSync(landingDist)) {
  throw new Error(`Standalone landing build not found at: ${landingDist}`);
}

console.log('Landing dist path:', landingDist);
console.log('Target dir path:', targetDir);
console.log('Landing folder path:', landingFolder);
console.log('Landing site folder path:', landingSiteFolder);

// Create landing folder structures for compatibility URLs
mkdirSync(landingFolder, { recursive: true });
mkdirSync(landingSiteFolder, { recursive: true });

// Copy landing assets to /dist/landing/assets
const landingAssets = resolve(landingDist, 'assets');
const landingTargetAssets = resolve(landingFolder, 'assets');
const landingSiteTargetAssets = resolve(landingSiteFolder, 'assets');
if (existsSync(landingAssets)) {
  mkdirSync(landingTargetAssets, { recursive: true });
  mkdirSync(landingSiteTargetAssets, { recursive: true });
  cpSync(landingAssets, landingTargetAssets, { recursive: true });
  cpSync(landingAssets, landingSiteTargetAssets, { recursive: true });
  console.log('✓ Copied landing assets to /dist/landing/assets');
  console.log('✓ Copied landing assets to /dist/landing-site/assets');
}

// Also merge landing assets to /dist/assets for app
const targetAssets = resolve(targetDir, 'assets');
if (existsSync(landingAssets)) {
  mkdirSync(targetAssets, { recursive: true });
  cpSync(landingAssets, targetAssets, { recursive: true });
  console.log('✓ Merged landing assets to /dist/assets');
}

// Copy landing index.html to /dist/landing/index.html
const landingIndex = resolve(landingDist, 'index.html');
const landingIndexDest = resolve(landingFolder, 'index.html');
const landingSiteIndexDest = resolve(landingSiteFolder, 'index.html');
if (existsSync(landingIndex)) {
  const htmlContent = normalizeToRelativeAssets(readFileSync(landingIndex, 'utf-8'))
    .replace(/href="\/favicon/g, 'href="/favicon');
  
  writeFileSync(landingIndexDest, htmlContent);
  writeFileSync(landingSiteIndexDest, htmlContent);
  console.log('✓ Copied and updated landing index.html to /dist/landing/');
  console.log('✓ Copied and updated landing index.html to /dist/landing-site/');
}

// Also keep a copy as landing-page.html at root for iframe
const targetLandingPage = resolve(targetDir, 'landing-page.html');
if (existsSync(landingIndex)) {
  const htmlContent = normalizeToRootAssets(readFileSync(landingIndex, 'utf-8'));
  
  writeFileSync(targetLandingPage, htmlContent);
  console.log('✓ Created landing-page.html with /assets/ paths');
}

// Copy public files to landing folder
const publicDir = resolve(frontendRoot, 'public');
if (existsSync(publicDir)) {
  const publicFiles = ['favicon.ico', 'robots.txt', 'icons.svg', 'placeholder.svg'];
  for (const file of publicFiles) {
    const srcFile = resolve(publicDir, file);
    if (existsSync(srcFile)) {
      cpSync(srcFile, resolve(landingFolder, file));
      cpSync(srcFile, resolve(landingSiteFolder, file));
    }
  }
  console.log('✓ Synced public files to /dist/landing/ and /dist/landing-site/');
}

console.log(`✓ Build complete! Landing accessible at:`)
console.log(`  - / (through app route rendering /landing-page.html)`)
console.log(`  - /landing-page.html (root static landing HTML)`)
console.log(`  - /landing/ and /landing-site/ (compatibility paths)`)
console.log(`  - /assets/ (merged assets for main app)`);
