/**
 * "Unstyle": turn styled Unicode back into plain letters where that can be
 * done without guessing. Used for the "Remove styling" action, and before
 * applying a new style, so converting 𝐁𝐨𝐥𝐝 to italic gives 𝘐𝘵𝘢𝘭𝘪𝘤 rather than a mix.
 *
 * It only reverses mappings that are unambiguous (math alphanumerics,
 * enclosed/squared letters, full-width forms, letter-like symbols,
 * super/subscripts) and decorative combining marks. Real-language text,
 * such as Greek, Cyrillic or accented letters, is never changed.
 */
import { graphemes } from './segment';

/** Combining marks the decorative styles add (strike, underline, slash, keycap…). */
const DECORATIVE_MARKS = new Set(
  [0x0305, 0x0324, 0x0325, 0x032e, 0x0330, 0x0331, 0x0332, 0x0333, 0x0334, 0x0335, 0x0336, 0x0337, 0x0338, 0x033d, 0x033e, 0x0346, 0x0347, 0x034d, 0x034e, 0x0353, 0x0359, 0x035a, 0x0489, 0x20dd, 0x20de, 0x20e0, 0x20e3].map((c) => String.fromCodePoint(c)),
);
const MARK = /\p{M}/u;

function inReversibleRange(cp: number): boolean {
  return (
    (cp >= 0x1d400 && cp <= 0x1d7ff) || // Mathematical Alphanumeric Symbols
    (cp >= 0x2460 && cp <= 0x24ff) || // Enclosed Alphanumerics
    (cp >= 0x1f100 && cp <= 0x1f1ff && !(cp >= 0x1f1e6 && cp <= 0x1f1ff)) || // Enclosed Alphanumeric Supplement (not regional indicators)
    (cp >= 0xff01 && cp <= 0xff5e) || // Full-width ASCII
    (cp >= 0x2100 && cp <= 0x214f) || // Letter-like symbols
    (cp >= 0x2070 && cp <= 0x209f) || // Super/subscripts
    (cp >= 0x1d2c && cp <= 0x1d6a) // Phonetic modifier letters (ᵃ ᵇ …)
  );
}

function plainChar(ch: string): string {
  const cp = ch.codePointAt(0) ?? 0;
  // Negative circled (🅐) and negative squared (🅰) letters have no NFKC form.
  if (cp >= 0x1f150 && cp <= 0x1f169) return String.fromCharCode(65 + cp - 0x1f150);
  if (cp >= 0x1f170 && cp <= 0x1f189) return String.fromCharCode(65 + cp - 0x1f170);
  if (!inReversibleRange(cp)) return ch;
  const n = ch.normalize('NFKC');
  return /^[\x20-\x7e]$/.test(n) ? n : ch;
}

function stripMarks(g: string): string {
  const cps = Array.from(g);
  const marks = cps.filter((c) => MARK.test(c));
  if (marks.length === 0) return g;
  const decorative = marks.some((m) => DECORATIVE_MARKS.has(m)) || marks.length >= 2;
  if (!decorative) return g; // e.g. "e" + U+0301 is a real accent: keep it.
  return cps.filter((c) => !MARK.test(c)).join('');
}

export function unstyle(text: string): string {
  let out = '';
  for (const g of graphemes(text)) {
    const base = stripMarks(g);
    out += Array.from(base).length === 1 ? plainChar(base) : base;
  }
  return out;
}
