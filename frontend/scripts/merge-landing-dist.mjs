import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptPath = fileURLToPath(import.meta.url);
const scriptDir = dirname(scriptPath);
const frontendRoot = resolve(scriptDir, '..');
const landingDist = resolve(frontendRoot, 'landing', 'dist');
const targetDir = resolve(frontendRoot, 'dist', 'landing-site');

if (!existsSync(landingDist)) {
  throw new Error(`Standalone landing build not found at: ${landingDist}`);
}

rmSync(targetDir, { recursive: true, force: true });
mkdirSync(targetDir, { recursive: true });
cpSync(landingDist, targetDir, { recursive: true });

console.log(`Merged landing dist into: ${targetDir}`);
