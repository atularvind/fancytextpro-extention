#!/usr/bin/env node
/**
 * Maintainer tool: capture FancyTextPro.com style output so the extension's
 * local style catalogue stays faithful to the website.
 *
 * It sends one probe string per request to the site's public `/generate`
 * endpoint (the same call the website makes while you type), plus a fetch of
 * each category page to read style names. It does not download or run the
 * website's JavaScript.
 *
 *   node scripts/sync-styles/capture.mjs   → scripts/sync-styles/.cache/capture.json
 *   node scripts/sync-styles/derive.mjs    → src/engine/data/site-styles.json
 *
 * Be polite: requests are sequential with a delay (~75 requests total).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, '.cache', 'capture.json');
const BASE = 'https://www.fancytextpro.com';
const HEADERS = { 'User-Agent': 'FancyTextPro-extension-style-sync/1.0' };
const DELAY_MS = 400;

export const CATEGORIES = [
  'New', 'Unique', 'CoolText', 'Elegant', 'Lunicodes', 'Squiggle', 'Symbolic', 'Freaky',
  'BoxText', 'StarDecorated', 'HeartDecorated', 'DecoratedText', 'JoinerText', 'EmoticonText',
  'LineText', 'CuteText', 'CrazyText', 'FullCrazyText', 'RandomText', 'Halloween', 'Christmas',
];

export const SINGLE_PROBES = [
  ...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
  '.', ',', '!', '?', "'", '-', 'é', '😀',
];
export const MULTI_PROBES = ['ab', 'a b', 'abc', 'Hello World 2026', 'The quick brown fox, jumps over 13 lazy dogs!'];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function decodeEntities(s) {
  return s.replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"');
}

async function captureMeta() {
  const meta = [];
  for (const category of CATEGORIES) {
    const url = category === 'New' ? `${BASE}/` : `${BASE}/FancyTextGenerator/${category}`;
    const html = await (await fetch(url, { headers: HEADERS })).text();
    const start = html.indexOf(`data-page="${category}"`);
    if (start < 0) throw new Error(`Category section not found: ${category}`);
    const rest = html.slice(start);
    const next = rest.indexOf('data-page="', 20);
    const section = next > 0 ? rest.slice(0, next) : rest;
    const re = /data-style="([^"]*)"[\s\S]*?<p id="([^"]+)"/g;
    let m;
    while ((m = re.exec(section))) meta.push({ id: m[2], name: decodeEntities(m[1]), category });
    await sleep(DELAY_MS);
  }
  return meta;
}

async function session() {
  const res = await fetch(`${BASE}/preProduce`, { headers: HEADERS });
  const cookie = (res.headers.getSetCookie?.() ?? []).map((c) => c.split(';')[0]).join('; ');
  const csrf = (await res.json())._csrf ?? '';
  return { cookie, csrf };
}

async function generate({ cookie, csrf }, text) {
  const body = new URLSearchParams();
  body.append('_csrf', csrf);
  body.append('text', text);
  for (const c of CATEGORIES) body.append('pages[]', c);
  const res = await fetch(`${BASE}/generate`, {
    method: 'POST',
    headers: {
      ...HEADERS,
      cookie,
      'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'x-requested-with': 'XMLHttpRequest',
    },
    body,
  });
  if (!res.ok) throw new Error(`/generate ${res.status} for ${JSON.stringify(text)}`);
  return JSON.parse(await res.text());
}

async function main() {
  const meta = await captureMeta();
  const s = await session();
  const outputs = {};
  // Every single-char probe is sent twice for 'a' to detect randomised styles.
  for (const text of [...SINGLE_PROBES, ...MULTI_PROBES]) {
    outputs[text] = await generate(s, text);
    await sleep(DELAY_MS);
  }
  const again = await generate(s, 'a');
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify({ capturedAt: new Date().toISOString(), meta, outputs, repeatA: again }));
  console.log(`Captured ${meta.length} style names and ${Object.keys(outputs).length} probes → ${path.relative(process.cwd(), OUT)}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
