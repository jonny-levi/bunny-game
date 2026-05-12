#!/usr/bin/env node
// Copy runtime-loaded frontend assets into dist/assets/** after vite build.
// Vite only bundles assets it sees from JS imports; Phaser loads several
// assets at runtime via absolute URLs such as `/assets/bunnies/adult/1.svg`
// and `/assets/branding/login-hero.svg`, so they must be present in the
// served `dist/` tree.
//
// Uses only Node built-ins so no extra devDependency is added.

import { cp, rm, stat, readdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const frontendRoot = resolve(__dirname, '..');
const assetGroups = [
  ['bunnies', resolve(frontendRoot, 'assets', 'bunnies'), resolve(frontendRoot, 'dist', 'assets', 'bunnies')],
  ['branding', resolve(frontendRoot, 'assets', 'branding'), resolve(frontendRoot, 'dist', 'assets', 'branding')],
];

async function exists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function countFiles(root) {
  let count = 0;
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const child = resolve(root, entry.name);
    if (entry.isDirectory()) count += await countFiles(child);
    else if (entry.isFile()) count += 1;
  }
  return count;
}

async function main() {
  for (const [label, src, dest] of assetGroups) {
    if (!(await exists(src))) {
      console.error(`[copy-bunny-assets] source not found for ${label}: ${src}`);
      process.exit(1);
    }
    if (await exists(dest)) {
      await rm(dest, { recursive: true, force: true });
    }
    await cp(src, dest, { recursive: true });
    const copied = await countFiles(dest);
    console.log(`[copy-bunny-assets] copied ${copied} ${label} file(s) -> ${dest}`);
  }
}

main().catch((err) => {
  console.error('[copy-bunny-assets] failed:', err);
  process.exit(1);
});
