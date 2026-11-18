/**
 * Right-click menu on selected text:
 *
 *   FancyTextPro ▸  [favorites → recent → defaults, max 10]
 *                   ───────────
 *                   Remove styling
 *                   More styles…
 *
 * Chrome can't change a menu while it's open, so its items show each style
 * applied to its own name ("𝐁𝐨𝐥𝐝"). Firefox's menus.onShown lets us preview
 * the user's actual selection instead.
 */
import { applyStyle, getStyle, PLAIN_STYLE_ID, shortName } from '../engine/catalog';
import { graphemes } from '../engine/segment';
import { IS_FIREFOX, menus } from '../shared/browser';
import { t } from '../shared/i18n';
import { menuStyleIds } from '../shared/menu-ids';
import { loadState } from '../shared/state';

export const ROOT_ID = 'ftp-root';
export const STYLE_PREFIX = 'ftp-style:';
export const MORE_ID = 'ftp-more';
export const PLAIN_ID = `${STYLE_PREFIX}${PLAIN_STYLE_ID}`;
const CONTEXTS: [`${chrome.contextMenus.ContextType}`] = ['selection'];
const MAX_TITLE = 48;

let currentIds: string[] = [];

/** Menu titles: avoid '&' (an access-key marker in some menus) and cap the length. */
export function menuTitle(text: string): string {
  const g = graphemes(text.replace(/&/g, '+').replace(/\s+/g, ' ').trim());
  return g.length > MAX_TITLE ? `${g.slice(0, MAX_TITLE - 1).join('')}…` : g.join('');
}

function styleTitle(id: string, sample?: string): string {
  const s = getStyle(id);
  if (!s) return id;
  return menuTitle(applyStyle(s, sample ?? shortName(s.name)));
}

function create(props: chrome.contextMenus.CreateProperties): Promise<void> {
  return new Promise((resolve) => {
    menus.create(props, () => {
      void chrome.runtime?.lastError; // reading it marks it handled (e.g. duplicate id during races)
      resolve();
    });
  });
}

let chain: Promise<void> = Promise.resolve();

/** Rebuild the whole menu. Serialised so overlapping storage events can't interleave. */
export function rebuildMenus(): Promise<void> {
  chain = chain.then(build, build);
  return chain;
}

async function build(): Promise<void> {
  const { favorites, recent, settings } = await loadState();
  currentIds = menuStyleIds(favorites, recent, settings.menuShowRecent);
  await menus.removeAll();
  await create({ id: ROOT_ID, title: t('menuRoot'), contexts: CONTEXTS });
  for (const id of currentIds) await create({ id: `${STYLE_PREFIX}${id}`, parentId: ROOT_ID, title: styleTitle(id), contexts: CONTEXTS });
  await create({ id: 'ftp-sep', parentId: ROOT_ID, type: 'separator', contexts: CONTEXTS });
  await create({ id: PLAIN_ID, parentId: ROOT_ID, title: t('menuPlain'), contexts: CONTEXTS });
  await create({ id: MORE_ID, parentId: ROOT_ID, title: t('menuMore'), contexts: CONTEXTS });
}

/** Firefox only: show the real selection in each style while the menu is open. */
export function enableLivePreview(): void {
  if (!IS_FIREFOX || !menus.onShown || !menus.refresh) return;
  const refresh = menus.refresh.bind(menus);
  menus.onShown.addListener((info) => {
    if (!info.menuIds.includes(ROOT_ID) || !info.selectionText) return;
    const g = graphemes(info.selectionText.replace(/\s+/g, ' ').trim());
    const sample = g.length > 24 ? `${g.slice(0, 24).join('')}…` : g.join('');
    // Apply all title updates before refreshing the open menu.
    void Promise.all(currentIds.map((id) => menus.update(`${STYLE_PREFIX}${id}`, { title: styleTitle(id, sample) }))).then(() => refresh());
  });
}
