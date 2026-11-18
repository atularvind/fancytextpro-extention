#!/usr/bin/env node
/**
 * Render src/icons/icon.svg to the PNG sizes the manifest needs, using the
 * Playwright Chromium that's already a dev dependency.
 *
 *   node scripts/icons.mjs
 */
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ICONS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'icons');
const svg = fs.readFileSync(path.join(ICONS, 'icon.svg'), 'utf8');

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 1 });
for (const size of [16, 32, 48, 128]) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<html><body style="margin:0;background:transparent">${svg.replace('<svg ', `<svg style="display:block;width:${size}px;height:${size}px" `)}</body></html>`);
  await page.screenshot({ path: path.join(ICONS, `icon-${size}.png`), omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
  console.log(`icon-${size}.png`);
}
await browser.close();
