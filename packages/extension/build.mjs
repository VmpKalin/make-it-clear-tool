import { build, context } from 'esbuild';
import { cp, mkdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = __dirname;
const DIST = resolve(ROOT, 'dist');
const SRC = resolve(ROOT, 'src');
const SHARED_PROMPTS = resolve(ROOT, '..', 'shared', 'prompts.md');

const watch = process.argv.includes('--watch');

const ENTRY_POINTS = {
  background: resolve(SRC, 'background.ts'),
  content: resolve(SRC, 'content.ts'),
  'popup/popup': resolve(SRC, 'popup', 'popup.ts'),
  'options/options': resolve(SRC, 'options', 'options.ts'),
};

const baseOptions = {
  entryPoints: ENTRY_POINTS,
  outdir: DIST,
  bundle: true,
  format: 'esm',
  target: 'es2022',
  platform: 'browser',
  sourcemap: true,
  minify: !watch,
  logLevel: 'info',
};

async function copyStatic() {
  await mkdir(DIST, { recursive: true });
  await mkdir(resolve(DIST, 'popup'), { recursive: true });
  await mkdir(resolve(DIST, 'options'), { recursive: true });

  await cp(resolve(ROOT, 'manifest.json'), resolve(DIST, 'manifest.json'));
  await cp(resolve(SRC, 'popup', 'popup.html'), resolve(DIST, 'popup', 'popup.html'));
  await cp(resolve(SRC, 'popup', 'popup.css'), resolve(DIST, 'popup', 'popup.css'));
  await cp(resolve(SRC, 'options', 'options.html'), resolve(DIST, 'options', 'options.html'));
  await cp(SHARED_PROMPTS, resolve(DIST, 'prompts.md'));

  const iconsSrc = resolve(ROOT, 'icons');
  if (existsSync(iconsSrc)) {
    await cp(iconsSrc, resolve(DIST, 'icons'), { recursive: true });
  }
}

async function run() {
  if (existsSync(DIST)) {
    await rm(DIST, { recursive: true, force: true });
  }
  await copyStatic();

  if (watch) {
    const ctx = await context(baseOptions);
    await ctx.watch();
    console.log('[extension/build] Watching for changes...');
  } else {
    await build(baseOptions);
    console.log('[extension/build] Build complete.');
  }
}

run().catch((err) => {
  console.error('[extension/build] Build failed', err);
  process.exit(1);
});
