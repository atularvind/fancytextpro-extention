/**
 * User state: favorites, recent styles, settings.
 * - favorites + settings → storage.sync (follows the user through the browser's own sync)
 * - recent → storage.local
 * Nothing is ever sent anywhere else.
 */
import { ext } from './browser';

export type Theme = 'system' | 'light' | 'dark';
export type MenuAction = 'replace' | 'copy';

export interface Settings {
  theme: Theme;
  /** Context menu / shortcut: replace editable selections in place, or always copy. */
  menuAction: MenuAction;
  /** Include recently used styles in the context menu. */
  menuShowRecent: boolean;
}

export const DEFAULT_SETTINGS: Settings = { theme: 'system', menuAction: 'replace', menuShowRecent: true };

export const MAX_FAVORITES = 50;
export const MAX_RECENT = 8;

// ---------- pure helpers (unit-tested) ----------

export function toggleFavorite(favorites: readonly string[], id: string): string[] {
  if (favorites.includes(id)) return favorites.filter((f) => f !== id);
  return [id, ...favorites].slice(0, MAX_FAVORITES);
}

export function pushRecent(recent: readonly string[], id: string): string[] {
  return [id, ...recent.filter((r) => r !== id)].slice(0, MAX_RECENT);
}

export function sanitizeSettings(raw: unknown): Settings {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<Settings>;
  return {
    theme: r.theme === 'light' || r.theme === 'dark' || r.theme === 'system' ? r.theme : DEFAULT_SETTINGS.theme,
    menuAction: r.menuAction === 'copy' || r.menuAction === 'replace' ? r.menuAction : DEFAULT_SETTINGS.menuAction,
    menuShowRecent: typeof r.menuShowRecent === 'boolean' ? r.menuShowRecent : DEFAULT_SETTINGS.menuShowRecent,
  };
}

const ids = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);

// ---------- storage access ----------

export interface UserState {
  favorites: string[];
  recent: string[];
  settings: Settings;
}

export async function loadState(): Promise<UserState> {
  const [sync, local] = await Promise.all([ext.storage.sync.get(['favorites', 'settings']), ext.storage.local.get(['recent'])]);
  return { favorites: ids(sync.favorites), recent: ids(local.recent), settings: sanitizeSettings(sync.settings) };
}

export async function saveFavorites(favorites: string[]): Promise<void> {
  await ext.storage.sync.set({ favorites });
}

let recentQueue: Promise<unknown> = Promise.resolve();

/** Serialised read-modify-write, so rapid uses in one context don't drop entries. */
export function recordRecent(id: string): Promise<string[]> {
  const run = recentQueue.then(async () => {
    const { recent } = await ext.storage.local.get(['recent']);
    const next = pushRecent(ids(recent), id);
    await ext.storage.local.set({ recent: next });
    return next;
  });
  recentQueue = run.catch(() => undefined);
  return run;
}

export async function saveSettings(settings: Settings): Promise<void> {
  await ext.storage.sync.set({ settings });
}

export async function clearHistory(): Promise<void> {
  await Promise.all([ext.storage.local.remove('recent'), ext.storage.sync.remove('favorites')]);
}
