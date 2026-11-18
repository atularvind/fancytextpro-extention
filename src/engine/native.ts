/**
 * Styles that FancyTextPro.com generates in the browser (Lunicode-style
 * transforms), so the `/generate` capture can't supply them. They're
 * re-implemented here, plus "Plain text", which removes styling.
 */
import { mapFrom, renderModel } from './model';
import { graphemes, perLine } from './segment';
import type { CharModel, Style } from './types';

const LOWER = 'abcdefghijklmnopqrstuvwxyz';
const UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const DIGITS = '0123456789';

const model = (map: Map<string, string>, extra: Partial<CharModel> = {}): CharModel => ({ p: '', x: '', j: '', rev: false, map, ...extra });

// Small capitals (Q and X have no small-capital form, matching the website).
const tinyMap = mapFrom(LOWER + UPPER, 'ᴀʙᴄᴅᴇꜰɢʜɪᴊᴋʟᴍɴᴏᴘQʀꜱᴛᴜᴠᴡxʏᴢ'.repeat(2));

// Upside-down text, read right-to-left.
const flipMap = mapFrom(LOWER + UPPER + DIGITS + '.,!?\'"&_;()[]{}<>', [
  'ɐqɔpǝɟɓɥıɾʞlɯuodbɹsʇnʌʍxʎz',
  '∀ᙠƆᗡƎℲ⅁HIſ⋊˥WNOԀΌᴚS⊥∩ΛMX⅄Z',
  '0⇂ᄅƐㄣގ9ㄥ86',
  '˙\'¡¿,„⅋‾؛)(][}{><',
].join(''));

// Circled letters and digits.
const bubbleMap = mapFrom(LOWER + UPPER + DIGITS, [
  'ⓐⓑⓒⓓⓔⓕⓖⓗⓘⓙⓚⓛⓜⓝⓞⓟⓠⓡⓢⓣⓤⓥⓦⓧⓨⓩ',
  'ⒶⒷⒸⒹⒺⒻⒼⒽⒾⒿⓀⓁⓂⓃⓄⓅⓆⓇⓈⓉⓊⓋⓌⓍⓎⓏ',
  '⓪①②③④⑤⑥⑦⑧⑨',
].join(''));

// Horizontally mirrored, read right-to-left. Digits are kept as-is.
const mirrorMap = mapFrom(LOWER + UPPER + '()[]{}<>?', [
  'ɒdɔbɘᎸǫʜiꞁʞ|mᴎoqpɿꙅƚuvwxʏƹ',
  'AᙠƆᗡƎꟻᎮHIႱ⋊⅃MͶOꟼỌЯꙄTUVWXYƸ',
  ')(][}{<>⸮',
].join(''));

/** Keycap style: each character inside a combining enclosing keycap (U+20E3), as on the website. */
function roundSquares(text: string): string {
  return perLine(text, (line) =>
    graphemes(line)
      .map((g) => (g === ' ' ? ' ' : `${g}⃣`))
      .join('   '),
  );
}

// Combining marks used by "Creepify" (above, middle, below).
const ZALGO_UP = [...'̍̎̄̅̿̑̆̐͒͗͑̇̈̊͂̓̈́͊͋͌̃̂̌͐̀́̋̏̒̓̔̽̉ͣͤͥͦͧͨͩͪͫͬͭͮͯ̾͛'];
const ZALGO_MID = [...'̴̵̶̸̷̡̢̧̨̛̀́̕͘͜͟͢͝͞͠͡'];
const ZALGO_DOWN = [...'̖̗̘̙̜̝̞̟̠̤̥̦̩̪̫̬̭̮̯̰̱̲̳̹̺̻̼͇͈͉͍͎͓͔͕͖͙͚̣ͅ'];

/** Small deterministic PRNG (mulberry32) so previews and copies match. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** "Creepify" (Zalgo): adds a few combining marks per character, deterministically. */
export function creepify(text: string): string {
  const rand = rng(hash(text));
  const pick = (list: readonly string[], n: number) => {
    let s = '';
    for (let i = 0; i < n; i++) s += list[Math.floor(rand() * list.length)] ?? '';
    return s;
  };
  return perLine(text, (line) =>
    graphemes(line)
      .map((g) => (/\s/.test(g) ? g : g + pick(ZALGO_UP, 1 + Math.floor(rand() * 3)) + pick(ZALGO_MID, Math.floor(rand() * 2)) + pick(ZALGO_DOWN, 1 + Math.floor(rand() * 3))))
      .join(''),
  );
}

const fromModel = (m: CharModel) => (text: string) => renderModel(m, text);

export const NATIVE_STYLES: readonly Omit<Style, 'fragile'>[] = [
  { id: 'tiny', name: 'Tiny Capital Text', category: 'Lunicodes', source: 'native', transform: fromModel(model(tinyMap)) },
  { id: 'flip', name: 'Flip Text', category: 'Lunicodes', source: 'native', transform: fromModel(model(flipMap, { rev: true })) },
  { id: 'bubbles', name: 'Bubbles Text', category: 'Lunicodes', source: 'native', transform: fromModel(model(bubbleMap)) },
  { id: 'roundsquares', name: 'Round Squares Text', category: 'Lunicodes', source: 'native', transform: roundSquares },
  { id: 'mirror', name: 'Mirror Text', category: 'Lunicodes', source: 'native', transform: fromModel(model(mirrorMap, { rev: true })) },
  { id: 'creepify', name: 'Creepify aka Zalgo Generator', category: 'Lunicodes', source: 'native', transform: creepify },
];
