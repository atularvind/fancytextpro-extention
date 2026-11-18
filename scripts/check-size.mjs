#!/usr/bin/env node
/**
 * Enforce the bundle budget: the packaged extension (zip) must
 * stay ≤ 150 KB. Estimated per browser with DEFLATE, which is what zip uses.
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BUDGET_ZIPPED = 150 * 1024;
const BUDGET_JS_FILE = 80 * 1024;

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]));
}

let failed = false;
for (const target of ['chrome', 'firefox']) {
  const dir = path.join(ROOT, 'dist', target);
  if (!fs.existsSync(dir)) {
    console.error(`dist/${target} missing — run npm run build first`);
    process.exit(1);
  }
  let raw = 0;
  let zipped = 0;
  for (const file of walk(dir)) {
    const buf = fs.readFileSync(file);
    raw += buf.length;
    zipped += zlib.deflateRawSync(buf, { level: 9 }).length + 100; // + zip entry overhead
    if (file.endsWith('.js') && buf.length > BUDGET_JS_FILE) {
      console.error(`✗ ${path.relative(ROOT, file)} is ${(buf.length / 1024).toFixed(1)} KB (limit ${BUDGET_JS_FILE / 1024} KB)`);
      failed = true;
    }
  }
  const ok = zipped <= BUDGET_ZIPPED;
  failed ||= !ok;
  console.log(`${ok ? '✓' : '✗'} ${target}: ${(raw / 1024).toFixed(1)} KB unpacked, ~${(zipped / 1024).toFixed(1)} KB zipped (budget ${BUDGET_ZIPPED / 1024} KB)`);
}
process.exit(failed ? 1 : 0);
