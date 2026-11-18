import { graphemes, perLine } from './segment';
import type { CharModel } from './types';

/** Render one line with a declarative character model. */
export function renderLine(model: CharModel, line: string): string {
  const wrap = model.wrap;
  const parts = graphemes(line).map((g) => {
    if (g === ' ' && model.sp !== undefined) return model.sp;
    const inner = model.map.get(g) ?? g;
    return wrap ? wrap[0] + inner + wrap[1] : inner;
  });
  if (model.rev) parts.reverse();
  return model.p + parts.join(model.j) + model.x;
}

/** Render multi-line text; each non-blank line is styled independently. */
export function renderModel(model: CharModel, text: string): string {
  return perLine(text, (line) => renderLine(model, line));
}

/** Build a character map from parallel source/target alphabets (split by grapheme). */
export function mapFrom(source: string, targetText: string): Map<string, string> {
  const src = graphemes(source);
  const target = graphemes(targetText);
  if (src.length !== target.length) throw new Error(`Alphabet length mismatch: ${src.length} vs ${target.length}`);
  const map = new Map<string, string>();
  src.forEach((c, i) => {
    const t = target[i];
    if (t !== undefined && t !== c) map.set(c, t);
  });
  return map;
}
