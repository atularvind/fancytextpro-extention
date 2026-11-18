/**
 * Apply a style to the user's selection in a tab: replace it in place when
 * it's editable, otherwise copy the result. Every step has a fallback, so the
 * user always ends up with the styled text somewhere.
 */
import { applyStyle, PLAIN_STYLE_ID, resolveAction } from '../engine/catalog';
import { copyText, readSelection, replaceSelection, showToast, type PageSelection, type ReplaceResult } from '../inject/page';
import { ext, IS_FIREFOX } from '../shared/browser';
import { t } from '../shared/i18n';
import { recordRecent, type MenuAction } from '../shared/state';

export interface ApplyRequest {
  tabId: number;
  frameId?: number;
  styleId: string;
  /** Selection text reported by the browser (context menu); used when the page can't be scripted. */
  fallbackText?: string;
  mode: MenuAction;
}

export type ApplyOutcome = 'replaced' | 'copied' | 'opened-popup' | 'nothing-selected' | 'failed';

/** Run a self-contained function in the page. Returns undefined if the page can't be scripted (e.g. chrome://, store pages). */
export async function runInPage<A extends unknown[], R>(tabId: number, frameId: number, func: (...args: A) => R | Promise<R>, args: A): Promise<Awaited<R> | undefined> {
  try {
    const [res] = await ext.scripting.executeScript({ target: { tabId, frameIds: [frameId] }, func, args } as chrome.scripting.ScriptInjection<A, R>);
    return res?.result as Awaited<R> | undefined;
  } catch {
    return undefined;
  }
}

/** Clipboard from an extension context. Firefox's background page can do this in response to a user action; Chrome's service worker can't. */
async function copyFromExtension(text: string): Promise<boolean> {
  if (!IS_FIREFOX || !globalThis.navigator?.clipboard) return false;
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

// Text handed to the popup ("More styles…", or the last-resort fallback).
// Kept in memory, with storage.session as a backup in case the service worker restarts.
let pendingText: string | undefined;

export function setPending(text: string): void {
  pendingText = text;
  void ext.storage.session.set({ pendingText: text });
}

export async function takePending(): Promise<string | undefined> {
  let text = pendingText;
  if (text === undefined) {
    const stored = await ext.storage.session.get(['pendingText']);
    text = typeof stored.pendingText === 'string' ? stored.pendingText : undefined;
  }
  pendingText = undefined;
  await ext.storage.session.remove('pendingText');
  return text;
}

async function openPopupWith(text: string): Promise<boolean> {
  setPending(text);
  try {
    await ext.action.openPopup();
    return true;
  } catch {
    return false;
  }
}

export async function applyStyleInTab(req: ApplyRequest): Promise<ApplyOutcome> {
  const style = resolveAction(req.styleId);
  if (!style) return 'failed';
  const frameId = req.frameId ?? 0;

  const sel: PageSelection | undefined = await runInPage(req.tabId, frameId, readSelection, []);
  const text = sel?.text || req.fallbackText || '';
  if (!text) return 'nothing-selected';
  const out = applyStyle(style, text);
  const remember = () => (style.id === PLAIN_STYLE_ID ? Promise.resolve() : recordRecent(style.id).then(() => undefined));

  if (sel?.editable && req.mode === 'replace') {
    const res: ReplaceResult | undefined = await runInPage(req.tabId, frameId, replaceSelection, [out, sel.text]);
    if (res?.ok) {
      await remember();
      return 'replaced';
    }
  }

  const copied = (await runInPage(req.tabId, frameId, copyText, [out])) === true || (await copyFromExtension(out));
  if (copied) {
    await remember();
    const editableButFailed = sel?.editable && req.mode === 'replace';
    await runInPage(req.tabId, frameId, showToast, [t(editableButFailed ? 'toastCopiedPaste' : 'toastCopied')]);
    return 'copied';
  }

  // Last resort (restricted pages): open the popup with the text so it's one click away.
  if (await openPopupWith(text)) return 'opened-popup';
  return 'failed';
}

/** Insert styled text from the popup into the page's focused field. */
export async function insertFromPopup(tabId: number, styleId: string, text: string, expectedSelection: string | null): Promise<ApplyOutcome> {
  const style = resolveAction(styleId);
  if (!style || !text) return 'failed';
  const out = applyStyle(style, text);
  const res = await runInPage(tabId, 0, replaceSelection, [out, expectedSelection]);
  if (res?.ok) {
    if (style.id !== PLAIN_STYLE_ID) await recordRecent(style.id);
    return 'replaced';
  }
  const copied = (await runInPage(tabId, 0, copyText, [out])) === true || (await copyFromExtension(out));
  if (copied) {
    await runInPage(tabId, 0, showToast, [t('toastCopiedPaste')]);
    return 'copied';
  }
  return 'failed';
}
