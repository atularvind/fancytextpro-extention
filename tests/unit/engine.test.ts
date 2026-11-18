import { describe, expect, it } from 'vitest';
import golden from '../fixtures/site-golden.json';
import { applyStyle, CATEGORIES, DEFAULT_MENU_STYLE_IDS, getStyle, shortName, STYLES, unstyle } from '../../src/engine/catalog';
import { creepify } from '../../src/engine/native';
import { graphemes, perLine } from '../../src/engine/segment';

const style = (id: string) => {
  const s = getStyle(id);
  if (!s) throw new Error(`missing style ${id}`);
  return s;
};

describe('catalogue', () => {
  it('ships at least 140 styles with unique ids', () => {
    expect(STYLES.length).toBeGreaterThanOrEqual(140);
    expect(new Set(STYLES.map((s) => s.id)).size).toBe(STYLES.length);
  });

  it('every style has a name and a known category', () => {
    const cats = new Set(CATEGORIES.map((c) => c.id));
    for (const s of STYLES) {
      expect(s.name.trim()).not.toBe('');
      expect(cats.has(s.category)).toBe(true);
    }
  });

  it('every category has at least one style', () => {
    for (const c of CATEGORIES) expect(STYLES.some((s) => s.category === c.id), c.id).toBe(true);
  });

  it('default context-menu styles all exist', () => {
    for (const id of DEFAULT_MENU_STYLE_IDS) expect(getStyle(id), id).toBeDefined();
  });

  it('flags styles that use scripts with weak font support', () => {
    expect(style('taiVietCharMap').fragile).toBe(true);
    expect(style('oldItalicText').fragile).toBe(true);
    expect(style('boldCharMap').fragile).toBe(false);
    expect(style('bubbles').fragile).toBe(false);
  });
});

describe('parity with FancyTextPro.com', () => {
  const { probes, expected } = golden as { probes: string[]; expected: Record<string, (string | null)[]> };
  const ids = Object.keys(expected);

  it('covers every website-derived style', () => {
    const siteIds = STYLES.filter((s) => s.source === 'site').map((s) => s.id);
    expect(siteIds.sort()).toEqual(ids.sort());
  });

  it.each(ids)('%s matches the website output for every probe', (id) => {
    const s = style(id);
    probes.forEach((probe, i) => {
      const want = expected[id]![i];
      // null = the website split an emoji into broken surrogates; we intentionally don't.
      if (want !== null) expect(s.transform(probe), JSON.stringify(probe)).toBe(want);
    });
  });

  it('keeps emoji whole where the website breaks them (wrap-each styles)', () => {
    expect(style('strikeThroughText').transform('😀')).toBe('😀\u0336');
    const box = style('weirdBox');
    expect(box.transform('a😀')).toBe(box.transform('a') + box.transform('😀'));
    expect(box.transform('😀').startsWith('[😀')).toBe(true);
    expect(style('heartsBetween').transform('a😀')).toBe('a♥😀');
  });

  it('wrap-each styles decorate characters outside the captured alphabet', () => {
    expect(style('strikeThroughText').transform('ü~')).toBe('ü\u0336~\u0336');
  });
});

describe('transform behaviour', () => {
  it('bold maps letters and digits, passes punctuation through', () => {
    expect(style('boldCharMap').transform('Hi, 42!')).toBe('𝐇𝐢, 𝟒𝟐!');
  });

  it('keeps emoji ZWJ sequences, flags and skin tones intact', () => {
    const input = 'a👩‍💻b🇮🇳c👍🏽';
    const out = style('boldCharMap').transform(input);
    expect(out).toBe('𝐚👩‍💻𝐛🇮🇳𝐜👍🏽');
    // Joiner styles must not split an emoji cluster.
    const joined = style('heartsBetween').transform('a👩‍💻');
    expect(joined).toBe('a♥👩‍💻');
  });

  it('never breaks combining marks or non-Latin scripts', () => {
    const input = 'é é नमस्ते مرحبا 你好 שלום';
    const out = style('boldCharMap').transform(input);
    expect(out).toBe(input); // nothing here is mappable, so it's unchanged
    for (const s of STYLES) {
      const res = s.transform('नमस्ते');
      // Every original grapheme cluster must survive somewhere in the output.
      for (const g of graphemes('नमस्ते')) expect(res.includes(g), s.id).toBe(true);
    }
  });

  it('handles empty input', () => {
    for (const s of STYLES) expect(s.transform(''), s.id).toBe('');
  });

  it('decorates each line separately and keeps blank lines and indentation', () => {
    const out = style('starDecor1').transform('one\n\n  two');
    expect(out).toBe('ミ★ 𝗈𝗇𝖾 ★彡'.replace('𝗈𝗇𝖾', style('starDecor1').transform('one').slice(3, -3)) + '\n\n  ' + style('starDecor1').transform('two'));
    expect(out.split('\n')[1]).toBe('');
  });

  it('preserves CRLF line endings', () => {
    expect(style('boldCharMap').transform('a\r\nb')).toBe('𝐚\r\n𝐛');
    expect(perLine('x\r\ny', (l) => `[${l}]`)).toBe('[x]\r\n[y]');
  });

  it('flip and mirror reverse the reading order', () => {
    expect(style('flip').transform('Hello')).toBe('ollǝH');
    expect(style('mirror').transform('abc')).toBe('ɔdɒ');
  });

  it('tiny and bubbles map as on the website', () => {
    expect(style('tiny').transform('Fancy')).toBe('ꜰᴀɴᴄʏ');
    expect(style('bubbles').transform('Ab1')).toBe('Ⓐⓑ①');
  });

  it('creepify is deterministic and keeps the base letters', () => {
    const a = creepify('Boo');
    expect(a).toBe(creepify('Boo'));
    expect(unstyle(a)).toBe('Boo');
  });

  it('processes 10k characters for every style quickly', () => {
    const long = 'The quick brown fox 123. '.repeat(400);
    const t0 = performance.now();
    for (const s of STYLES) s.transform(long);
    expect(performance.now() - t0).toBeLessThan(5000);
  });
});

describe('unstyle / restyle', () => {
  const reversible = ['boldCharMap', 'italicCharMap', 'boldItalicCharMap', 'monospaceCharMap', 'doubleStruckCharMap', 'oldEnglishCharMap', 'oldEnglishCharBoldMap', 'cursiveLetters', 'cursiveLettersBold', 'wideTextCharMap', 'bubbles', 'strikeThroughText', 'underline', 'doubleUnderline', 'slashThrough'];

  it.each(reversible)('%s round-trips back to plain text', (id) => {
    const plain = 'Hello World 2026';
    expect(unstyle(style(id).transform(plain))).toBe(plain);
  });

  it('uppercase-only styles round-trip to uppercase', () => {
    expect(unstyle(style('invertedSquaresCharMap').transform('Hello 2026'))).toBe('HELLO 2026');
  });

  it('restyling already-styled text replaces the style', () => {
    const bold = style('boldCharMap').transform('Hello');
    expect(applyStyle(style('italicCharMap'), bold)).toBe(style('italicCharMap').transform('Hello'));
  });

  it('never alters real-language text', () => {
    const text = 'Ελληνικά Русский café naïve é ½ ™';
    expect(unstyle(text)).toBe(text);
  });

  it('leaves flags (regional indicators) alone', () => {
    expect(unstyle('🇮🇳')).toBe('🇮🇳');
  });
});

describe('shortName', () => {
  it('drops filler words', () => {
    expect(shortName('Bold Text')).toBe('Bold');
    expect(shortName('Ninja Style Fancy Text Generator')).toBe('Ninja');
    expect(shortName('Text')).toBe('Text');
  });
});
