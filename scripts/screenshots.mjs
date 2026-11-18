#!/usr/bin/env node
/**
 * Capture README / store screenshots from the built extension.
 *   node scripts/build.mjs --e2e && node scripts/screenshots.mjs
 * Output: docs/screenshots/*.png
 */
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const EXT = path.join(ROOT, 'dist', 'chrome-e2e');
const OUT = path.join(ROOT, 'docs', 'screenshots');
fs.mkdirSync(OUT, { recursive: true });

const context = await chromium.launchPersistentContext('', {
  channel: 'chromium',
  headless: true,
  deviceScaleFactor: 2,
  args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`],
});
const sw = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
const id = new URL(sw.url()).host;
await sw.evaluate(async () => {
  await chrome.storage.sync.set({ favorites: ['cursiveLettersBold', 'bubbles'] });
  await chrome.storage.local.set({ recent: ['boldCharMap', 'BoldJavaneseText'] });
});

for (const scheme of ['light', 'dark']) {
  const page = await context.newPage();
  await page.emulateMedia({ colorScheme: scheme });
  await page.setViewportSize({ width: 380, height: 590 });
  await page.goto(`chrome-extension://${id}/popup/popup.html`);
  await page.locator('#input').fill('Hello World');
  await page.locator('#input').blur();
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(OUT, `popup-${scheme}.png`) });
  await page.locator('#search').fill('cursive');
  await page.waitForTimeout(150);
  await page.screenshot({ path: path.join(OUT, `popup-search-${scheme}.png`) });
  await page.close();
}

for (const [name, url, w, h] of [
  ['options', 'options/options.html', 900, 900],
  ['welcome', 'welcome/welcome.html', 1000, 900],
]) {
  const page = await context.newPage();
  await page.setViewportSize({ width: w, height: h });
  await page.goto(`chrome-extension://${id}/${url}`);
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: true });
  await page.close();
}

await context.close();
console.log(`Screenshots → ${path.relative(ROOT, OUT)}`);
