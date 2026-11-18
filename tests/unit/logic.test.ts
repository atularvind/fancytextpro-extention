import { describe, expect, it } from 'vitest';
import { lastStyleId, MAX_MENU_STYLES, menuStyleIds } from '../../src/shared/menu-ids';
import { DEFAULT_SETTINGS, MAX_FAVORITES, MAX_RECENT, pushRecent, sanitizeSettings, toggleFavorite } from '../../src/shared/state';
import { siteUrl } from '../../src/shared/links';
import { buildSections, matches, normalize } from '../../src/popup/sections';
import { DEFAULT_MENU_STYLE_IDS, STYLES } from '../../src/engine/catalog';
import { menuTitle } from '../../src/background/menus';

describe('favorites & recent', () => {
  it('toggles favorites, newest first, capped', () => {
    expect(toggleFavorite([], 'a')).toEqual(['a']);
    expect(toggleFavorite(['a'], 'b')).toEqual(['b', 'a']);
    expect(toggleFavorite(['b', 'a'], 'a')).toEqual(['b']);
    const many = Array.from({ length: MAX_FAVORITES }, (_, i) => `s${i}`);
    expect(toggleFavorite(many, 'new')).toHaveLength(MAX_FAVORITES);
  });

  it('keeps recent unique, most recent first, capped', () => {
    let r: string[] = [];
    for (const id of ['a', 'b', 'a', 'c', 'd', 'e', 'f', 'g', 'h', 'i']) r = pushRecent(r, id);
    expect(r[0]).toBe('i');
    expect(r).toHaveLength(MAX_RECENT);
    expect(new Set(r).size).toBe(r.length);
  });
});

describe('context menu style list', () => {
  it('uses defaults when there is no history', () => {
    expect(menuStyleIds([], [], true)).toEqual([...DEFAULT_MENU_STYLE_IDS].slice(0, MAX_MENU_STYLES));
  });

  it('puts favorites, then recent, before defaults; no duplicates; unknown ids dropped', () => {
    const ids = menuStyleIds(['bubbles', 'nope'], ['flip', 'bubbles'], true);
    expect(ids.slice(0, 2)).toEqual(['bubbles', 'flip']);
    expect(ids).not.toContain('nope');
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBe(MAX_MENU_STYLES);
  });

  it('can hide recent styles', () => {
    expect(menuStyleIds([], ['flip'], false)).not.toContain('flip');
  });

  it('"apply last style" prefers the most recent style', () => {
    expect(lastStyleId(['bubbles'], ['flip'])).toBe('flip');
    expect(lastStyleId(['bubbles'], [])).toBe('bubbles');
    expect(lastStyleId([], [])).toBe('boldCharMap');
  });

  it('menu titles avoid "&" and are length-capped', () => {
    expect(menuTitle('Bold & Cursive')).toBe('Bold + Cursive');
    expect(Array.from(menuTitle('x'.repeat(200))).length).toBeLessThanOrEqual(48);
  });
});

describe('settings', () => {
  it('sanitizes unknown or corrupted values', () => {
    expect(sanitizeSettings(undefined)).toEqual(DEFAULT_SETTINGS);
    expect(sanitizeSettings({ theme: 'neon', menuAction: 'delete', menuShowRecent: 'yes' })).toEqual(DEFAULT_SETTINGS);
    expect(sanitizeSettings({ theme: 'dark', menuAction: 'copy', menuShowRecent: false })).toEqual({ theme: 'dark', menuAction: 'copy', menuShowRecent: false });
  });
});

describe('website links', () => {
  it('adds UTM tags', () => {
    const u = new URL(siteUrl('/FancyTextGenerator/Elegant', 'popup_category'));
    expect(u.origin).toBe('https://www.fancytextpro.com');
    expect(u.pathname).toBe('/FancyTextGenerator/Elegant');
    expect(u.searchParams.get('utm_source')).toBe('extension');
    expect(u.searchParams.get('utm_medium')).toBe('popup_category');
    expect(u.hash).toBe('');
  });

  it('passes user text only in the fragment, never the query string', () => {
    const u = new URL(siteUrl('/', 'popup_footer', 'My secret draft'));
    expect(u.search).not.toContain('secret');
    expect(decodeURIComponent(u.hash)).toBe('#text=My secret draft');
  });

  it('caps hand-off text length', () => {
    const u = new URL(siteUrl('/', 'popup_footer', 'a'.repeat(1000)));
    expect(decodeURIComponent(u.hash).length).toBeLessThanOrEqual('#text='.length + 200);
  });
});

describe('popup sections & search', () => {
  it('normalizes accents and case', () => {
    expect(normalize('CÚRSIVE')).toBe('cursive');
  });

  it('search matches names, categories and ids; all words must match', () => {
    expect(matches('boldCharMap', 'bold')).toBe(true);
    expect(matches('cursiveLettersBold', 'bold cursive')).toBe(true);
    expect(matches('boldCharMap', 'bold cursive')).toBe(false);
    expect(matches('starDecor1', 'stars')).toBe(true); // category label
  });

  it('"All" shows favorites, recent, then every category', () => {
    const s = buildSections({ query: '', filter: 'all', favorites: ['flip'], recent: ['bubbles'] });
    expect(s[0]).toMatchObject({ key: 'favorites', styleIds: ['flip'] });
    expect(s[1]).toMatchObject({ key: 'recent', styleIds: ['bubbles'] });
    const total = s.slice(2).reduce((n, x) => n + x.styleIds.length, 0);
    expect(total).toBe(STYLES.length);
  });

  it('a query produces one results section, respecting the active filter', () => {
    const all = buildSections({ query: 'bold', filter: 'all', favorites: [], recent: [] });
    expect(all).toHaveLength(1);
    expect(all[0]!.styleIds).toContain('boldCharMap');
    const favs = buildSections({ query: 'bold', filter: 'favorites', favorites: ['flip'], recent: [] });
    expect(favs[0]!.styleIds).toEqual([]);
  });

  it('category filter shows just that category', () => {
    const s = buildSections({ query: '', filter: 'LineText', favorites: [], recent: [] });
    expect(s).toHaveLength(1);
    expect(s[0]!.styleIds).toContain('strikeThroughText');
  });
});

describe('install / upgrade from 1.x', async () => {
  const { majorOf, shouldShowWelcome, isLegacyUpgrade } = await import('../../src/background/lifecycle');
  it('parses major versions', () => {
    expect(majorOf('1.4.2')).toBe(1);
    expect(majorOf('2.0.0')).toBe(2);
    expect(majorOf(undefined)).toBe(0);
  });
  it('shows the welcome page on install and on the 1.x → 2.x upgrade only', () => {
    expect(shouldShowWelcome('install')).toBe(true);
    expect(shouldShowWelcome('update', '1.3.0')).toBe(true);
    expect(shouldShowWelcome('update', '2.0.0')).toBe(false);
    expect(shouldShowWelcome('update', '2.1.0')).toBe(false);
    expect(shouldShowWelcome('browser_update', '2.0.0')).toBe(false);
  });
  it('cleans legacy storage only when upgrading from 1.x', () => {
    expect(isLegacyUpgrade('update', '1.0.5')).toBe(true);
    expect(isLegacyUpgrade('update', '2.0.0')).toBe(false);
    expect(isLegacyUpgrade('install')).toBe(false);
  });
});
