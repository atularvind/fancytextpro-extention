/**
 * Background (Chrome: service worker, Firefox: event page). Event-driven
 * with no persistent state: it wakes for a menu click, shortcut, message or
 * install, then idles.
 */
import { ext, menus } from '../shared/browser';
import { lastStyleId } from '../shared/menu-ids';
import { loadState } from '../shared/state';
import { applyStyleInTab, insertFromPopup, setPending, takePending } from './actions';
import { isLegacyUpgrade, removeLegacyStorage, shouldShowWelcome } from './lifecycle';
import { enableLivePreview, MORE_ID, rebuildMenus, STYLE_PREFIX } from './menus';
import type { PopupMessage } from '../shared/messages';

/** Run an async handler; log failures instead of leaving unhandled rejections. */
function safe(label: string, task: () => Promise<unknown>): void {
  task().catch((err: unknown) => console.warn(`[FancyTextPro] ${label} failed:`, err));
}

ext.runtime.onInstalled.addListener((details) => {
  safe('install', async () => {
    if (isLegacyUpgrade(details.reason, details.previousVersion)) await removeLegacyStorage();
    await rebuildMenus();
    if (shouldShowWelcome(details.reason, details.previousVersion)) await ext.tabs.create({ url: ext.runtime.getURL('welcome/welcome.html') });
  });
});
ext.runtime.onStartup.addListener(() => safe('startup menus', rebuildMenus));

ext.storage.onChanged.addListener((changes, area) => {
  if ((area === 'sync' && (changes.favorites || changes.settings)) || (area === 'local' && changes.recent)) safe('menu rebuild', rebuildMenus);
});

enableLivePreview();

menus.onClicked.addListener((info, tab) => {
  if (!tab?.id) return;
  const id = String(info.menuItemId);
  if (id === MORE_ID) {
    setPending(info.selectionText ?? '');
    // Must be called synchronously: Firefox only allows openPopup inside the user-action handler.
    ext.action.openPopup().catch(() => {
      /* can't open here; the text waits for the next popup open */
    });
    return;
  }
  if (!id.startsWith(STYLE_PREFIX)) return;
  safe('menu action', async () => {
    const { settings } = await loadState();
    await applyStyleInTab({
      tabId: tab.id!,
      frameId: info.frameId ?? 0,
      styleId: id.slice(STYLE_PREFIX.length),
      fallbackText: info.selectionText ?? '',
      mode: settings.menuAction,
    });
  });
});

ext.commands.onCommand.addListener((command, tab) => {
  if (command !== 'apply-last-style') return;
  safe('shortcut', async () => {
    const tabId = tab?.id ?? (await ext.tabs.query({ active: true, currentWindow: true }))[0]?.id;
    if (!tabId) return;
    const { favorites, recent, settings } = await loadState();
    await applyStyleInTab({ tabId, styleId: lastStyleId(favorites, recent), mode: settings.menuAction });
  });
});

ext.runtime.onMessage.addListener((msg: PopupMessage, sender, sendResponse) => {
  // Only accept messages from our own extension pages (not content scripts or other extensions).
  if (sender.id !== ext.runtime.id || sender.tab) return false;
  if (msg?.type === 'ftp:take-pending') {
    takePending()
      .then((text) => sendResponse({ text }))
      .catch(() => sendResponse({}));
    return true;
  }
  if (msg?.type !== 'ftp:insert') return false;
  if (typeof msg.tabId !== 'number' || typeof msg.styleId !== 'string' || typeof msg.text !== 'string') return false;
  // The popup closes itself right after sending; give focus a moment to return to the page.
  setTimeout(() => {
    insertFromPopup(msg.tabId, msg.styleId, msg.text, typeof msg.expectedSelection === 'string' ? msg.expectedSelection : null)
      .then((outcome) => sendResponse({ outcome }))
      .catch(() => sendResponse({ outcome: 'failed' }));
  }, 150);
  return true;
});

if (__E2E__) {
  // Test-only hook (built with --e2e); never present in release builds.
  (globalThis as Record<string, unknown>).__ftpTest = { applyStyleInTab, insertFromPopup, rebuildMenus, removeLegacyStorage };
}
