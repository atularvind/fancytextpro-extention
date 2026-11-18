#!/usr/bin/env node
/**
 * Render store listing assets into store/:
 *   screenshot-1-popup.png, screenshot-2-right-click.png, screenshot-3-private.png  (1280×800, Chrome + AMO)
 *   promo-small-440x280.png, promo-marquee-1400x560.png                              (Chrome Web Store tiles)
 *
 *   node scripts/build.mjs --e2e && node scripts/screenshots.mjs && node scripts/store-assets.mjs
 *
 * The popup images are real screenshots (docs/screenshots). Styled sample text
 * comes from the real engine. The right-click menu is drawn in HTML, because
 * browsers can't screenshot native menus.
 */
import { chromium } from '@playwright/test';
import * as esbuild from 'esbuild';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'store');
const SHOTS = path.join(ROOT, 'docs', 'screenshots');
fs.mkdirSync(OUT, { recursive: true });

// Load the real engine.
const tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'ftp-assets-')), 'engine.mjs');
await esbuild.build({ entryPoints: [path.join(ROOT, 'src/engine/catalog.ts')], bundle: true, format: 'esm', platform: 'node', outfile: tmp, logLevel: 'error' });
const { getStyle, applyStyle, shortName, STYLES } = await import(pathToFileURL(tmp).href);
const s = (id, text) => applyStyle(getStyle(id), text);

const img = (file) => `data:image/png;base64,${fs.readFileSync(path.join(SHOTS, file)).toString('base64')}`;
const icon = `data:image/png;base64,${fs.readFileSync(path.join(ROOT, 'src/icons/icon-128.png')).toString('base64')}`;
const esc = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;');

const BASE_CSS = `*{box-sizing:border-box}body{margin:0;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#0f172a}
.frame{position:relative;overflow:hidden;background:linear-gradient(135deg,#2563eb 0%,#1d4ed8 60%,#1e40af 100%);color:#fff}
.brand{display:flex;align-items:center;gap:14px;font-weight:800;font-size:30px}.brand img{width:56px;height:56px;border-radius:12px;box-shadow:0 0 0 2px rgba(255,255,255,.4)}
h1{font-size:54px;line-height:1.08;margin:28px 0 18px;letter-spacing:-.5px}p.sub{font-size:24px;line-height:1.4;color:#dbeafe;margin:0}
.shot{border-radius:14px;box-shadow:0 30px 60px rgba(2,6,23,.45)}`;

function screenshotPage(left, right) {
  return `<html><head><style>${BASE_CSS}.frame{width:1280px;height:800px;display:grid;grid-template-columns:560px 1fr;align-items:center;padding:0 80px;gap:40px}</style></head>
  <body><div class="frame"><div>${left}</div><div style="display:flex;justify-content:center">${right}</div></div></body></html>`;
}

const brand = `<div class="brand"><img src="${icon}">FancyTextPro</div>`;
const menuIds = ['boldCharMap', 'italicCharMap', 'cursiveLettersBold', 'doubleStruckCharMap', 'oldEnglishCharMap', 'bubbles', 'strikeThroughText'];
const menu = menuIds.map((id) => `<div class="mi">${esc(s(id, shortName(getStyle(id).name)))}</div>`).join('');

const pages = {
  'screenshot-1-popup.png': screenshotPage(
    `${brand}<h1>${STYLES.length} fancy text styles, one click away</h1><p class="sub">Live previews, search, favorites and categories. Copy any style instantly or insert it straight into the page.</p>`,
    `<img class="shot" src="${img('popup-light.png')}" style="height:700px">`,
  ),
  'screenshot-2-right-click.png': `<html><head><style>${BASE_CSS}
    .frame{width:1280px;height:800px;padding:70px 80px}
    .win{position:absolute;left:80px;right:80px;top:300px;bottom:-20px;background:#fff;border-radius:14px 14px 0 0;box-shadow:0 30px 60px rgba(2,6,23,.45);padding:40px 48px;color:#0f172a}
    .post{border:2px solid #cbd5e1;border-radius:10px;padding:22px;font-size:26px;line-height:1.5;width:640px}
    .sel{background:#bfdbfe;border-radius:3px}
    .ctx{position:absolute;left:520px;top:110px;width:230px;background:#f8fafc;border:1px solid #cbd5e1;border-radius:8px;box-shadow:0 10px 30px rgba(15,23,42,.25);padding:6px 0;font-size:16px}
    .ctx .mi{padding:6px 16px}.ctx .hl{background:#2563eb;color:#fff;display:flex;justify-content:space-between}
    .sub2{position:absolute;left:748px;top:146px;width:300px;background:#f8fafc;border:1px solid #cbd5e1;border-radius:8px;box-shadow:0 10px 30px rgba(15,23,42,.25);padding:6px 0;font-size:19px}
    .sub2 .mi{padding:6px 16px}.sub2 .mi:first-child{background:#dbeafe}.sep{border-top:1px solid #cbd5e1;margin:4px 0}
    .after{margin-top:26px;font-size:20px;color:#475569}.after span{color:#0f172a;font-size:26px}
    </style></head><body><div class="frame">${brand}<h1 style="font-size:48px;margin-top:22px">Select. Right-click. Styled.</h1>
    <p class="sub">Restyle text in place on any site, with Ctrl+Z to undo. Not editable? It's copied for you.</p>
    <div class="win"><div class="post">Launching our new app <span class="sel">today</span> 🚀</div>
      <div class="after">Result: <span>Launching our new app ${esc(s('boldCharMap', 'today'))} 🚀</span></div>
      <div class="ctx"><div class="mi">Copy</div><div class="mi">Paste</div><div class="sep"></div><div class="mi hl"><span>FancyTextPro</span><span>▸</span></div><div class="mi">Inspect</div></div>
      <div class="sub2">${menu}<div class="sep"></div><div class="mi">Remove styling (plain text)</div><div class="mi">More styles…</div></div>
    </div></div></body></html>`,
  'screenshot-3-private.png': screenshotPage(
    `${brand}<h1>Private by design</h1><p class="sub">Works offline, entirely on your device. No tracking, no analytics, no accounts, and no access to sites until you use it. Light and dark themes, fully keyboard accessible.</p>`,
    `<img class="shot" src="${img('popup-dark.png')}" style="height:700px">`,
  ),
  'promo-small-440x280.png': `<html><head><style>${BASE_CSS}.frame{width:440px;height:280px;padding:34px 34px;display:flex;flex-direction:column;justify-content:center}
    .brand{font-size:26px}.brand img{width:52px;height:52px}.t{font-size:30px;margin-top:22px;line-height:1.25}</style></head>
    <body><div class="frame">${brand}<div class="t">${esc(s('cursiveLettersBold', 'Fancy text'))}<br>anywhere you type</div></div></body></html>`,
  'promo-marquee-1400x560.png': `<html><head><style>${BASE_CSS}.frame{width:1400px;height:560px;padding:70px 90px;display:grid;grid-template-columns:1fr 1fr;align-items:center}
    .samples{display:grid;gap:14px;font-size:38px;background:rgba(255,255,255,.1);border-radius:16px;padding:30px 36px}</style></head>
    <body><div class="frame"><div>${brand}<h1>Fancy text anywhere you type</h1><p class="sub">Right-click any text, pick a style. ${STYLES.length} styles, free and private.</p></div>
    <div class="samples">${['boldCharMap', 'cursiveLettersBold', 'bubbles', 'oldEnglishCharMap', 'BoldJavaneseText'].map((id) => `<div>${esc(s(id, 'FancyTextPro'))}</div>`).join('')}</div></div></body></html>`,
};

const browser = await chromium.launch();
for (const [file, html] of Object.entries(pages)) {
  const [w, h] = file.startsWith('promo-small') ? [440, 280] : file.startsWith('promo-marquee') ? [1400, 560] : [1280, 800];
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  await page.setContent(html);
  await page.screenshot({ path: path.join(OUT, file) });
  await page.close();
  console.log(`store/${file}`);
}
await browser.close();
