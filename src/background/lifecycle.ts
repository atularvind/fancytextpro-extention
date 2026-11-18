/**
 * Install / upgrade handling.
 *
 * 2.0.0 is a rewrite that replaces the 1.x extension previously published
 * under the same Chrome Web Store item. On that one upgrade we:
 *  - remove storage keys that 1.x left behind (2.x can't read them), and
 *  - show the welcome page once, so existing users discover the right-click menu.
 * Later updates never open tabs.
 */
import { ext } from '../shared/browser';

/** Storage keys owned by 2.x. Anything else found on upgrade from 1.x is stale. */
export const OWN_KEYS = { sync: ['favorites', 'settings'], local: ['recent'] } as const;

export function majorOf(version: string | undefined): number {
  const n = Number.parseInt((version ?? '').split('.')[0] ?? '', 10);
  return Number.isFinite(n) ? n : 0;
}

export function shouldShowWelcome(reason: string, previousVersion?: string): boolean {
  if (reason === 'install') return true;
  return reason === 'update' && majorOf(previousVersion) < 2;
}

export function isLegacyUpgrade(reason: string, previousVersion?: string): boolean {
  return reason === 'update' && majorOf(previousVersion) < 2;
}

/** Remove keys written by 1.x (unknown format). 2.x keys are validated on every read anyway. */
export async function removeLegacyStorage(): Promise<void> {
  for (const area of ['sync', 'local'] as const) {
    const all = await ext.storage[area].get(null);
    const own: readonly string[] = OWN_KEYS[area];
    const stale = Object.keys(all).filter((k) => !own.includes(k));
    if (stale.length) await ext.storage[area].remove(stale);
  }
}
