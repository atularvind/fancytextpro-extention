/** Which styles the context menu and the "apply last style" shortcut use. Needs the catalogue, so it lives apart from state.ts. */
import { DEFAULT_MENU_STYLE_IDS, getStyle } from '../engine/catalog';

export const MAX_MENU_STYLES = 10;

/** Favorites first, then recent, then defaults; unknown ids dropped; no duplicates. */
export function menuStyleIds(favorites: readonly string[], recent: readonly string[], showRecent: boolean): string[] {
  const out: string[] = [];
  const add = (id: string) => {
    if (out.length < MAX_MENU_STYLES && !out.includes(id) && getStyle(id)) out.push(id);
  };
  favorites.forEach(add);
  if (showRecent) recent.forEach(add);
  DEFAULT_MENU_STYLE_IDS.forEach(add);
  return out;
}

/** Style used by the "apply last style" shortcut. */
export function lastStyleId(favorites: readonly string[], recent: readonly string[]): string {
  return [...recent, ...favorites].find((id) => getStyle(id)) ?? DEFAULT_MENU_STYLE_IDS[0];
}
