#!/usr/bin/env node
// Copy frontend/assets/bunnies/** into dist/assets/bunnies/** after vite build.
// Vite only bundles assets it sees from JS imports; the bunny SVGs are loaded
// at runtime by Phaser via absolute URLs like `/assets/bunnies/adult/1.svg`,
// so they must be present in the served `dist/` tree.
//
// Uses only Node built-ins so no extra devDependency is added.

import { cp, rm, stat, readdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const frontendRoot = resolve(__dirname, '..');
const src = resolve(frontendRoot, 'assets', 'bunnies');
const dest = resolve(frontendRoot, 'dist', 'assets', 'bunnies');

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
  if (!(await exists(src))) {
    console.error(`[copy-bunny-assets] source not found: ${src}`);
    process.exit(1);
  }
  if (await exists(dest)) {
    await rm(dest, { recursive: true, force: true });
  }
  await cp(src, dest, { recursive: true });
  const copied = await countFiles(dest);
  console.log(`[copy-bunny-assets] copied ${copied} file(s) -> ${dest}`);
}

main().catch((err) => {
  console.error('[copy-bunny-assets] failed:', err);
  process.exit(1);
});
