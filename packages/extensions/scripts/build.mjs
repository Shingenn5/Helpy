import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');
const distDir = join(rootDir, 'dist');
const outputFile = join(distDir, 'cli.js');

// Ensure dist directory exists
if (!existsSync(distDir)) {
  mkdirSync(distDir, { recursive: true });
}

// Build CLI with esbuild
console.log('Building CLI with esbuild...');
await build({
  entryPoints: [join(rootDir, 'src', 'cli.ts')],
  bundle: true,
  platform: 'node',
  outfile: join(distDir, 'cli.js'),
  format: 'esm',
  packages: 'external',
  logLevel: 'info'
});

// Build runtime module with esbuild
console.log('Building runtime module with esbuild...');
await build({
  entryPoints: [join(rootDir, 'src', 'runtime.ts')],
  bundle: true,
  platform: 'node',
  outfile: join(distDir, 'runtime.js'),
  format: 'esm',
  logLevel: 'info'
});

// Build index module with esbuild (unified entry point)
console.log('Building index module with esbuild...');
await build({
  entryPoints: [join(rootDir, 'src', 'index.ts')],
  bundle: true,
  platform: 'node',
  outfile: join(distDir, 'index.js'),
  format: 'esm',
  logLevel: 'info'
});

// Copy extensions.d.ts to dist/index.d.ts for type definitions
console.log('Copying type definitions...');
const extensionsDts = readFileSync(join(rootDir, 'extensions.d.ts'), 'utf-8');
writeFileSync(join(distDir, 'index.d.ts'), extensionsDts);

// Read the built file
const content = readFileSync(outputFile, 'utf-8');

// Prepend shebang
const withShebang = '#!/usr/bin/env node\n' + content;

// Write back
writeFileSync(outputFile, withShebang, { mode: 0o755 });

console.log('✓ CLI built successfully with shebang');
