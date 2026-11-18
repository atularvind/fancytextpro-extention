import siteData from './data/site-styles.json';
import { NATIVE_STYLES } from './native';
import { renderModel } from './model';
import { unstyle } from './plain';
import { graphemes } from './segment';
import type { CategoryId, CharModel, Style } from './types';

export interface Category {
  id: CategoryId;
  /** Short label for chips. */
  label: string;
  /** Path of the matching page on FancyTextPro.com. */
  sitePath: string;
}

/** Display order: everyday styles first, seasonal last. */
export const CATEGORIES: readonly Category[] = (
  [
    ['CoolText', 'Cool'],
    ['Elegant', 'Elegant'],
    ['Unique', 'Unique'],
    ['New', 'New'],
    ['Lunicodes', 'Classic'],
    ['LineText', 'Lines'],
    ['Squiggle', 'Squiggle'],
    ['Symbolic', 'Symbolic'],
    ['Freaky', 'Freaky'],
    ['BoxText', 'Boxed'],
    ['StarDecorated', 'Stars'],
    ['HeartDecorated', 'Hearts'],
    ['DecoratedText', 'Decorated'],
    ['JoinerText', 'Joiners'],
    ['EmoticonText', 'Emoticons'],
  ] as const
).map(([id, label]) => ({ id, label, sitePath: id === 'New' ? '/' : `/FancyTextGenerator/${id}` }));

/** Website categories whose styles are random, so they're only linked, not bundled. */
export const SITE_ONLY_CATEGORIES = [
  { label: 'Cute', sitePath: '/FancyTextGenerator/CuteText' },
  { label: 'Crazy', sitePath: '/FancyTextGenerator/CrazyText' },
  { label: 'Full crazy', sitePath: '/FancyTextGenerator/FullCrazyText' },
  { label: 'Random', sitePath: '/FancyTextGenerator/RandomText' },
  { label: 'Halloween', sitePath: '/FancyTextGenerator/Halloween' },
  { label: 'Christmas', sitePath: '/FancyTextGenerator/Christmas' },
] as const;

/** Shown in the context menu until the user has favorites or recent styles. */
export const DEFAULT_MENU_STYLE_IDS = [
  'boldCharMap',
  'italicCharMap',
  'boldItalicCharMap',
  'cursiveLettersBold',
  'cursiveLetters',
  'doubleStruckCharMap',
  'oldEnglishCharMap',
  'monospaceCharMap',
  'bubbles',
  'strikeThroughText',
] as const;

/** Unicode blocks with patchy font support; styles using them get a "may not display everywhere" hint. */
const FRAGILE_RANGES: ReadonlyArray<readonly [number, number]> = [
  [0x0f00, 0x0fff], // Tibetan
  [0x1950, 0x197f], // Tai Le
  [0x2c00, 0x2c5f], // Glagolitic
  [0xa000, 0xa4cf], // Yi
  [0xa4d0, 0xa4ff], // Lisu
  [0xa500, 0xa63f], // Vai
  [0xa6a0, 0xa6ff], // Bamum
  [0xa980, 0xa9df], // Javanese
  [0xaa80, 0xaadf], // Tai Viet
  [0x10000, 0x1d3ff], // Historic scripts (Linear B, Old Italic, Phoenician, Carian…)
  [0x1d800, 0x1efff],
];
const FRAGILE_SAMPLE = 'Fancy Text 2026';

function isFragile(transform: (t: string) => string): boolean {
  for (const ch of transform(FRAGILE_SAMPLE)) {
    const cp = ch.codePointAt(0) ?? 0;
    if (FRAGILE_RANGES.some(([a, b]) => cp >= a && cp <= b)) return true;
  }
  return false;
}

interface SiteStyleEntry {
  id: string;
  name: string;
  category: string;
  a: number;
  p?: string;
  x?: string;
  j?: string;
  rev?: number;
  w?: [string, string];
  sp?: string;
  e?: Record<string, string>;
}

function buildSiteStyles(): Omit<Style, 'fragile'>[] {
  const keys = graphemes(siteData.keys);
  const alphabets = siteData.alphabets.map((table) => table.split(siteData.sep));
  const known = new Set<string>(CATEGORIES.map((c) => c.id));
  return (siteData.styles as SiteStyleEntry[])
    .filter((s) => known.has(s.category))
    .map((s) => {
      const table = alphabets[s.a] ?? [];
      const map = new Map<string, string>();
      keys.forEach((k, i) => {
        const v = table[i];
        if (v) map.set(k, v);
      });
      for (const [k, v] of Object.entries(s.e ?? {})) map.set(k, v);
      const model: CharModel = { p: s.p ?? '', x: s.x ?? '', j: s.j ?? '', rev: !!s.rev, map };
      if (s.sp !== undefined) model.sp = s.sp;
      if (s.w) model.wrap = s.w;
      return {
        id: s.id,
        name: s.name,
        category: s.category as CategoryId,
        source: 'site' as const,
        transform: (text: string) => renderModel(model, text),
      };
    });
}

function buildCatalog(): Style[] {
  const all = [...buildSiteStyles(), ...NATIVE_STYLES];
  const order = new Map(CATEGORIES.map((c, i) => [c.id, i]));
  // Stable sort by category order; within a category, keep website order.
  return all
    .map((s, i) => ({ s, i }))
    .sort((a, b) => (order.get(a.s.category) ?? 99) - (order.get(b.s.category) ?? 99) || a.i - b.i)
    .map(({ s }) => ({ ...s, fragile: isFragile(s.transform) }));
}

export const STYLES: readonly Style[] = buildCatalog();
const BY_ID = new Map(STYLES.map((s) => [s.id, s]));

/** "Remove styling" action. Not listed among the styles; used by the menu and popup. */
export const PLAIN_STYLE_ID = 'plain';
const PLAIN_STYLE: Style = { id: PLAIN_STYLE_ID, name: 'Plain text', category: 'CoolText', source: 'native', fragile: false, transform: unstyle };

export function getStyle(id: string): Style | undefined {
  return BY_ID.get(id);
}

/** Like getStyle, but also resolves the "Remove styling" action. */
export function resolveAction(id: string): Style | undefined {
  return id === PLAIN_STYLE_ID ? PLAIN_STYLE : BY_ID.get(id);
}

export function getCategory(id: CategoryId): Category | undefined {
  return CATEGORIES.find((c) => c.id === id);
}

/** Apply a style to text that may already be styled. */
export function applyStyle(style: Style, text: string): string {
  return style.transform(unstyle(text));
}

/** Short label for menus: "Bold Text" → "Bold", "Cursive Letters Bold" stays. */
export function shortName(name: string): string {
  const s = name
    .replace(/\b(Fancy|Text|Generator|Font|Fonts|Style)\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  return s || name;
}

export { unstyle };
