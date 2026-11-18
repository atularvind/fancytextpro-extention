#!/usr/bin/env node
/**
 * Derive the extension's style catalogue from a website capture
 * (see capture.mjs). For each style, it works out a declarative model:
 *
 *   output = prefix + join(joiner, chars.map(c => map[c] ?? c)) + suffix
 *            (with the char order optionally reversed)
 *
 * Then it checks the model against every probe the website answered
 * (sentences, punctuation, accents, emoji). Only styles that reproduce the
 * website's output exactly are kept. Randomised styles are excluded and listed
 * in the report.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const CACHE = path.join(HERE, '.cache', 'capture.json');
const OUT = path.join(ROOT, 'src', 'engine', 'data', 'site-styles.json');
const GOLDEN = path.join(ROOT, 'tests', 'fixtures', 'site-golden.json');
const GOLDEN_PROBES = ['Hello World 2026', 'The quick brown fox, jumps over 13 lazy dogs!', 'a b', 'é', '😀'];

export const KEYS = [...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'];
const PUNCT = ['.', ',', '!', '?', "'", '-'];
const SEP = '\u001f';

const cps = (s) => Array.from(s);

function commonPrefix(list) {
  let p = cps(list[0]);
  for (const s of list.slice(1)) {
    const c = cps(s);
    let i = 0;
    while (i < p.length && i < c.length && p[i] === c[i]) i++;
    p = p.slice(0, i);
  }
  return p.join('');
}
function commonSuffix(list) {
  const rev = list.map((s) => cps(s).reverse().join(''));
  return cps(commonPrefix(rev)).reverse().join('');
}
function strip(s, p, x) {
  if (!s.startsWith(p) || !s.endsWith(x) || s.length < p.length + x.length) return null;
  return s.slice(p.length, s.length - x.length);
}

/** True when the website split an emoji into lone UTF-16 surrogates (a site bug we don't replicate). */
const LONE_SURROGATE = /[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/;
export const hasLoneSurrogate = (s) => LONE_SURROGATE.test(s);

export function render(model, text) {
  const seg = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
  const parts = [...seg.segment(text)].map(({ segment: g }) => {
    if (g === ' ' && model.sp !== undefined) return model.sp;
    const inner = model.map[g] ?? g;
    return model.wrap ? model.wp + inner + model.wx : inner;
  });
  if (model.rev) parts.reverse();
  return model.p + parts.join(model.j) + model.x;
}

function deriveOne(id, outputs) {
  const singles = KEYS.map((k) => outputs[k][id]);
  let p = commonPrefix(singles);
  let x = commonSuffix(singles.map((s) => s.slice(p.length)));
  const map = {};
  for (const k of KEYS) map[k] = strip(outputs[k][id], p, x);
  const ab = strip(outputs['ab'][id], p, x);
  if (ab == null) return { error: 'ab probe does not fit prefix/suffix' };
  let rev = false;
  let j;
  if (ab.startsWith(map.a) && ab.endsWith(map.b)) j = ab.slice(map.a.length, ab.length - map.b.length);
  else if (ab.startsWith(map.b) && ab.endsWith(map.a)) {
    rev = true;
    j = ab.slice(map.b.length, ab.length - map.a.length);
  } else return { error: 'cannot locate joiner' };

  // Canonicalise per-character wrapping: joiner === suffix + prefix.
  if (j !== '' && j === x + p) {
    for (const k of KEYS) map[k] = p + map[k] + x;
    j = '';
    p = '';
    x = '';
  }

  // Detect "wrap each character" styles (strike-through, boxes, zalgo-like marks)
  // so ANY character (accents, emoji, symbols) gets the same treatment.
  const values = KEYS.map((k) => map[k]);
  const wp = commonPrefix(values);
  const wx = commonSuffix(values.map((v) => v.slice(wp.length)));
  const dotCore = strip(outputs['.'][id], p, x);
  const wrap = (wp !== '' || wx !== '') && dotCore === wp + '.' + wx;
  if (wrap) for (const k of KEYS) map[k] = map[k].slice(wp.length, map[k].length - wx.length);
  const model = { p, x, j, rev, wrap, wp: wrap ? wp : '', wx: wrap ? wx : '', map: { ...map } };

  // Space token.
  const aSpaceB = strip(outputs['a b'][id], p, x);
  if (aSpaceB == null) return { error: 'space probe does not fit' };
  const [first, last] = (rev ? ['b', 'a'] : ['a', 'b']).map((c) => render({ ...model, p: '', x: '', j: '' }, c));
  if (!aSpaceB.startsWith(first) || !aSpaceB.endsWith(last)) return { error: 'space probe misaligned' };
  let mid = aSpaceB.slice(first.length, aSpaceB.length - last.length);
  if (j && mid.startsWith(j) && mid.endsWith(j) && mid.length >= 2 * j.length) mid = mid.slice(j.length, mid.length - j.length);
  if (mid !== render({ ...model, p: '', x: '', j: '' }, ' ')) model.sp = mid;

  // Punctuation and non-ASCII probes.
  let skipped = 0;
  for (const ch of [...PUNCT, 'é', '😀']) {
    const raw = outputs[ch][id];
    if (hasLoneSurrogate(raw)) {
      skipped++;
      continue;
    }
    const core = strip(raw, p, x);
    if (core == null) return { error: `probe ${ch} does not fit` };
    if (core === render({ ...model, p: '', x: '', j: '' }, ch)) continue;
    if (wrap) {
      if (!core.startsWith(wp) || !core.endsWith(wx)) return { error: `probe ${ch} breaks wrapping` };
      model.map[ch] = core.slice(wp.length, core.length - wx.length);
    } else model.map[ch] = core;
  }
  // Remove identity entries to keep the data small.
  for (const [k, v] of Object.entries(model.map)) if (v === k) delete model.map[k];

  // Verify against every captured probe (except the website's broken-emoji outputs).
  for (const [probe, out] of Object.entries(outputs)) {
    if (hasLoneSurrogate(out[id])) continue;
    const got = render(model, probe);
    if (got !== out[id]) return { error: `mismatch on ${JSON.stringify(probe)}: got ${JSON.stringify(got)} want ${JSON.stringify(out[id])}` };
  }
  return { model, skipped };
}

function main() {
  const cap = JSON.parse(fs.readFileSync(CACHE, 'utf8'));
  const { meta, outputs, repeatA } = cap;
  const alphabets = [];
  const alphabetIndex = new Map();
  const styles = [];
  const excluded = [];
  const seenIds = new Set();

  for (const { id, name, category } of meta) {
    if (seenIds.has(id)) continue;
    seenIds.add(id);
    if (!(id in outputs.a)) {
      excluded.push({ id, name, category, reason: 'generated client-side on the website (implemented natively)' });
      continue;
    }
    const randomised = repeatA[id] !== outputs.a[id] || deriveOne(id, outputs).error === 'cannot locate joiner';
    if (randomised) {
      excluded.push({ id, name, category, reason: 'randomised output' });
      continue;
    }
    const { model, error } = deriveOne(id, outputs);
    if (error) {
      excluded.push({ id, name, category, reason: error });
      continue;
    }
    const table = KEYS.map((k) => model.map[k] ?? '').join(SEP);
    if (!alphabetIndex.has(table)) {
      alphabetIndex.set(table, alphabets.length);
      alphabets.push(table);
    }
    const extra = Object.fromEntries(Object.entries(model.map).filter(([k]) => !KEYS.includes(k)));
    const entry = { id, name, category, a: alphabetIndex.get(table) };
    if (model.p) entry.p = model.p;
    if (model.x) entry.x = model.x;
    if (model.j) entry.j = model.j;
    if (model.rev) entry.rev = 1;
    if (model.wrap) entry.w = [model.wp, model.wx];
    if (model.sp !== undefined) entry.sp = model.sp;
    if (Object.keys(extra).length) entry.e = extra;
    styles.push(entry);
  }

  const data = {
    source: 'https://www.fancytextpro.com',
    capturedAt: cap.capturedAt,
    keys: KEYS.join(''),
    sep: SEP,
    alphabets,
    styles,
  };
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(data) + '\n');
  // Golden fixture: the website's own output, used by the parity test.
  const golden = { capturedAt: cap.capturedAt, probes: GOLDEN_PROBES, expected: {} };
  // Outputs where the website split emoji into lone surrogates are stored as null (not compared).
  for (const st of styles) golden.expected[st.id] = GOLDEN_PROBES.map((pr) => (hasLoneSurrogate(outputs[pr][st.id]) ? null : outputs[pr][st.id]));
  fs.mkdirSync(path.dirname(GOLDEN), { recursive: true });
  fs.writeFileSync(GOLDEN, JSON.stringify(golden, null, 1) + '\n');
  const report = path.join(HERE, '.cache', 'report.json');
  fs.writeFileSync(report, JSON.stringify({ kept: styles.length, excluded }, null, 2));
  console.log(`Kept ${styles.length} styles (${alphabets.length} unique alphabets), excluded ${excluded.length}.`);
  const byReason = excluded.reduce((m, e) => ((m[e.reason.split(':')[0]] = (m[e.reason.split(':')[0]] ?? 0) + 1), m), {});
  console.log(byReason);
  console.log(`Wrote ${path.relative(ROOT, OUT)} (${fs.statSync(OUT).size} bytes)`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
