#!/usr/bin/env node
/**
 * Build the extension for Chrome and Firefox from one source tree.
 *
 *   node scripts/build.mjs                 → dist/chrome, dist/firefox (minified)
 *   node scripts/build.mjs --dev --watch   → unminified + sourcemaps, rebuild on change
 *   node scripts/build.mjs --target=firefox
 *   node scripts/build.mjs --e2e           → dist/chrome-e2e (test-only: adds host access + test hook)
 */
import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'src');
const args = new Set(process.argv.slice(2));
const flag = (name) => [...args].find((a) => a.startsWith(`--${name}=`))?.split('=')[1];
const DEV = args.has('--dev');
const WATCH = args.has('--watch');
const E2E = args.has('--e2e');
const TARGETS = E2E ? ['chrome'] : flag('target') ? [flag('target')] : ['chrome', 'firefox'];

const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));

const ENTRIES = {
  background: 'background/index.ts',
  'popup/popup': 'popup/popup.ts',
  'options/options': 'options/options.ts',
  'welcome/welcome': 'welcome/welcome.ts',
};

const STATIC = [
  'popup/popup.html',
  'popup/popup.css',
  'options/options.html',
  'welcome/welcome.html',
  'welcome/welcome.css',
  'shared/tokens.css',
  'shared/page.css',
  'icons/mark.svg',
  'icons/icon-16.png',
  'icons/icon-32.png',
  'icons/icon-48.png',
  'icons/icon-128.png',
  '_locales',
];

const GECKO_ID = 'extension@fancytextpro.com';

function manifestFor(target) {
  const m = JSON.parse(fs.readFileSync(path.join(SRC, 'manifest.json'), 'utf8'));
  m.version = pkg.version;
  if (target === 'firefox') {
    m.background = { scripts: ['background.js'] };
    m.permissions = m.permissions.map((p) => (p === 'contextMenus' ? 'menus' : p));
    m.browser_specific_settings = {
      gecko: {
        id: GECKO_ID,
        // 140 is the first desktop release that understands data_collection_permissions.
        strict_min_version: '140.0',
        data_collection_permissions: { required: ['none'] },
      },
      gecko_android: { strict_min_version: '142.0' },
    };
  } else {
    m.background = { service_worker: 'background.js' };
    m.minimum_chrome_version = '121';
  }
  if (E2E) {
    // Test builds only: lets Playwright drive scripting without a real user gesture.
    m.host_permissions = ['<all_urls>'];
    m.name = 'FancyTextPro (e2e)';
  }
  return m;
}

function copyStatic(outdir) {
  for (const rel of STATIC) {
    const from = path.join(SRC, rel);
    if (!fs.existsSync(from)) throw new Error(`Missing static file: src/${rel}`);
    fs.cpSync(from, path.join(outdir, rel), { recursive: true });
  }
}

function optionsFor(target, outdir) {
  return {
    absWorkingDir: ROOT,
    entryPoints: Object.fromEntries(Object.entries(ENTRIES).map(([out, src]) => [out, path.join(SRC, src)])),
    outdir,
    bundle: true,
    format: 'iife',
    target: target === 'firefox' ? ['firefox140'] : ['chrome121'],
    minify: !DEV,
    sourcemap: DEV ? 'linked' : false,
    charset: 'utf8',
    legalComments: 'none',
    logLevel: 'warning',
    define: {
      __BROWSER__: JSON.stringify(target),
      __E2E__: String(E2E),
    },
  };
}

async function buildTarget(target) {
  const outdir = path.join(ROOT, 'dist', E2E ? `${target}-e2e` : target);
  fs.rmSync(outdir, { recursive: true, force: true });
  fs.mkdirSync(outdir, { recursive: true });
  const writeRest = () => {
    copyStatic(outdir);
    fs.writeFileSync(path.join(outdir, 'manifest.json'), JSON.stringify(manifestFor(target), null, 2) + '\n');
  };
  if (WATCH) {
    const ctx = await esbuild.context({
      ...optionsFor(target, outdir),
      plugins: [{ name: 'static', setup: (b) => b.onEnd(() => (writeRest(), console.log(`[${target}] rebuilt`))) }],
    });
    await ctx.watch();
    fs.watch(SRC, { recursive: true }, (_e, file) => file && !file.endsWith('.ts') && writeRest());
  } else {
    await esbuild.build(optionsFor(target, outdir));
    writeRest();
    console.log(`Built ${path.relative(ROOT, outdir)} (v${pkg.version})`);
  }
}

await Promise.all(TARGETS.map(buildTarget));
if (WATCH) console.log('Watching for changes…');
