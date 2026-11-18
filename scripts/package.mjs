#!/usr/bin/env node
/**
 * Create store-ready zips in web-ext-artifacts/:
 *   fancytextpro-chrome-<version>.zip    → Chrome Web Store
 *   fancytextpro-firefox-<version>.zip   → addons.mozilla.org
 *   fancytextpro-source-<version>.zip    → AMO "source code" upload (required because the build is bundled/minified)
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { version } = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const OUT = path.join(ROOT, 'web-ext-artifacts');
const bin = path.join(ROOT, 'node_modules', '.bin', process.platform === 'win32' ? 'web-ext.cmd' : 'web-ext');

fs.mkdirSync(OUT, { recursive: true });
for (const target of ['chrome', 'firefox']) {
  const src = path.join(ROOT, 'dist', target);
  if (!fs.existsSync(path.join(src, 'manifest.json'))) throw new Error(`Build first: dist/${target} is missing`);
  execFileSync(bin, ['build', '--source-dir', src, '--artifacts-dir', OUT, '--filename', `fancytextpro-${target}-${version}.zip`, '--overwrite-dest'], { stdio: 'inherit' });
}

// Source archive for AMO reviewers: every tracked or untracked, non-ignored file (no node_modules, dist, caches).
const files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], { cwd: ROOT, encoding: 'utf8' })
  .split('\n')
  .filter((f) => f && fs.existsSync(path.join(ROOT, f)));
const sourceZip = path.join(OUT, `fancytextpro-source-${version}.zip`);
fs.rmSync(sourceZip, { force: true });
execFileSync('zip', ['-q', '-X', sourceZip, '-@'], { cwd: ROOT, input: files.join('\n'), stdio: ['pipe', 'inherit', 'inherit'] });
console.log(`Packages written to ${path.relative(ROOT, OUT)}/`);
