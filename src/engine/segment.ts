/**
 * Grapheme segmentation. Emoji ZWJ sequences, flags, skin tones and
 * combining marks are kept together as one user-perceived character.
 */
let segmenter: Intl.Segmenter | undefined;

export function graphemes(text: string): string[] {
  segmenter ??= new Intl.Segmenter(undefined, { granularity: 'grapheme' });
  const out: string[] = [];
  for (const { segment } of segmenter.segment(text)) out.push(segment);
  return out;
}

/** Split into lines, keeping the exact line terminators so they can be restored. */
export function splitLines(text: string): { lines: string[]; breaks: string[] } {
  const lines: string[] = [];
  const breaks: string[] = [];
  const re = /\r\n|\n|\r|\u2028|\u2029/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    lines.push(text.slice(last, m.index));
    breaks.push(m[0]);
    last = m.index + m[0].length;
  }
  lines.push(text.slice(last));
  return { lines, breaks };
}

/** Apply `fn` to each line that has visible content; blank lines pass through untouched. */
export function perLine(text: string, fn: (line: string) => string): string {
  const { lines, breaks } = splitLines(text);
  let out = '';
  lines.forEach((line, i) => {
    out += line.trim() === '' ? line : transformTrimmed(line, fn);
    if (i < breaks.length) out += breaks[i];
  });
  return out;
}

/** Keep leading/trailing whitespace outside of decorations, e.g. "  hi " → "  ★hi★ ". */
function transformTrimmed(line: string, fn: (s: string) => string): string {
  const lead = /^\s*/.exec(line)?.[0] ?? '';
  const trail = /\s*$/.exec(line)?.[0] ?? '';
  const core = line.slice(lead.length, line.length - trail.length);
  return lead + fn(core) + trail;
}
