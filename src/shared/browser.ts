/**
 * One tiny shim for Chrome and Firefox. Both support promise-based MV3 APIs,
 * so we use `browser` when it exists (Firefox) and `chrome` otherwise.
 * No webextension-polyfill needed.
 */
declare global {
  // Injected by esbuild (see scripts/build.mjs).
  const __BROWSER__: 'chrome' | 'firefox';
  const __E2E__: boolean;
}

type FirefoxMenus = typeof chrome.contextMenus & {
  onShown?: { addListener(cb: (info: { menuIds: (string | number)[]; selectionText?: string; contexts: string[] }, tab?: chrome.tabs.Tab) => void): void };
  refresh?: () => Promise<void>;
};

const g = globalThis as unknown as { browser?: typeof chrome; chrome?: typeof chrome };

export const ext: typeof chrome = (g.browser ?? g.chrome) as typeof chrome;

export const IS_FIREFOX = __BROWSER__ === 'firefox';

/** Firefox calls it `menus` (with extras such as onShown); Chrome calls it `contextMenus`. */
export const menus: FirefoxMenus = ((ext as unknown as { menus?: FirefoxMenus } | undefined)?.menus ?? ext?.contextMenus) as FirefoxMenus;
