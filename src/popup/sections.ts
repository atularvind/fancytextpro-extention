/** Pure list logic for the popup (unit-tested, no DOM). */
import { CATEGORIES, getStyle, STYLES } from '../engine/catalog';
import type { CategoryId } from '../engine/types';

export type Filter = 'all' | 'favorites' | CategoryId;

export interface Section {
  key: string;
  /** i18n key for the heading; for categories `category` is set and the label comes from the catalogue. */
  titleKey: 'sectionFavorites' | 'sectionRecent' | 'sectionResults' | 'sectionCategory';
  category?: CategoryId;
  styleIds: string[];
}

export function normalize(s: string): string {
  return s
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase();
}

function haystack(id: string): string {
  const s = getStyle(id);
  if (!s) return '';
  const cat = CATEGORIES.find((c) => c.id === s.category);
  return normalize(`${s.name} ${s.id} ${cat?.label ?? ''} ${s.category}`);
}

export function matches(id: string, query: string): boolean {
  const words = normalize(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const h = haystack(id);
  return words.every((w) => h.includes(w));
}

export function buildSections(opts: { query: string; filter: Filter; favorites: readonly string[]; recent: readonly string[] }): Section[] {
  const known = (ids: readonly string[]) => ids.filter((id) => getStyle(id));
  const favorites = known(opts.favorites);
  const recent = known(opts.recent);

  let pool: string[];
  if (opts.filter === 'favorites') pool = favorites;
  else if (opts.filter === 'all') pool = STYLES.map((s) => s.id);
  else pool = STYLES.filter((s) => s.category === opts.filter).map((s) => s.id);

  if (opts.query.trim()) {
    return [{ key: 'results', titleKey: 'sectionResults', styleIds: pool.filter((id) => matches(id, opts.query)) }];
  }
  if (opts.filter === 'favorites') return [{ key: 'favorites', titleKey: 'sectionFavorites', styleIds: favorites }];
  if (opts.filter !== 'all') return [{ key: opts.filter, titleKey: 'sectionCategory', category: opts.filter, styleIds: pool }];

  const sections: Section[] = [];
  if (favorites.length) sections.push({ key: 'favorites', titleKey: 'sectionFavorites', styleIds: favorites });
  if (recent.length) sections.push({ key: 'recent', titleKey: 'sectionRecent', styleIds: recent });
  for (const c of CATEGORIES) {
    sections.push({ key: c.id, titleKey: 'sectionCategory', category: c.id, styleIds: STYLES.filter((s) => s.category === c.id).map((s) => s.id) });
  }
  return sections;
}
