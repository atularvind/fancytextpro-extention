/**
 * Functions injected into the active tab with `scripting.executeScript`,
 * only after a user action (context-menu click, keyboard shortcut, popup
 * "Insert"). That's covered by `activeTab`, so no host permissions are needed.
 *
 * IMPORTANT: each exported function is serialised with `Function#toString`
 * and runs in the page, so it must be fully self-contained: no imports, no
 * references to module scope, and all helpers declared inside.
 */

export interface PageSelection {
  text: string;
  editable: boolean;
  kind: 'field' | 'rich' | 'page';
}

export interface ReplaceResult {
  ok: boolean;
  method: 'execCommand' | 'setRangeText' | 'rich' | 'stale' | 'not-editable' | 'failed';
}

export function readSelection(): PageSelection {
  let el: Element | null = document.activeElement;
  while (el && el.shadowRoot && el.shadowRoot.activeElement) el = el.shadowRoot.activeElement;
  const textTypes = ['text', 'search', 'url', 'tel', ''];
  if (el instanceof HTMLTextAreaElement || (el instanceof HTMLInputElement && textTypes.includes(el.type))) {
    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? 0;
    return { text: el.value.slice(start, end), editable: !el.readOnly && !el.disabled, kind: 'field' };
  }
  const sel = window.getSelection();
  const text = sel ? sel.toString() : '';
  const node = sel && sel.rangeCount ? sel.anchorNode : null;
  const anchor = node instanceof Element ? node : (node?.parentElement ?? null);
  const editable = !!(anchor && (anchor as HTMLElement).isContentEditable);
  return { text, editable, kind: editable ? 'rich' : 'page' };
}

/**
 * Replace the current selection (or insert at the caret) with `out`.
 * `expected` is the selection text read earlier; if the selection changed in
 * the meantime we refuse (`stale`) rather than overwrite the wrong text.
 * Pass `null` to skip that check.
 */
export async function replaceSelection(out: string, expected: string | null): Promise<ReplaceResult> {
  const squash = (s: string) => s.replace(/\s+/g, '');
  let el: Element | null = document.activeElement;
  while (el && el.shadowRoot && el.shadowRoot.activeElement) el = el.shadowRoot.activeElement;
  const textTypes = ['text', 'search', 'url', 'tel', ''];

  if (el instanceof HTMLTextAreaElement || (el instanceof HTMLInputElement && textTypes.includes(el.type))) {
    const field = el;
    if (field.readOnly || field.disabled) return { ok: false, method: 'not-editable' };
    const start = field.selectionStart ?? field.value.length;
    const end = field.selectionEnd ?? start;
    if (expected !== null && field.value.slice(start, end) !== expected) return { ok: false, method: 'stale' };
    if (expected !== null && expected === out) return { ok: true, method: 'execCommand' };
    field.focus();
    field.setSelectionRange(start, end);
    let done = false;
    try {
      // Goes through the browser's editing pipeline: fires beforeinput/input and keeps Ctrl+Z undo.
      done = document.execCommand('insertText', false, out);
    } catch {
      done = false;
    }
    if (done && field.value.slice(start, start + out.length) === out) return { ok: true, method: 'execCommand' };
    field.setRangeText(out, start, end, 'end');
    field.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertReplacementText', data: out }));
    return { ok: field.value.slice(start, start + out.length) === out, method: 'setRangeText' };
  }

  const sel = window.getSelection();
  if (!sel || !sel.rangeCount) return { ok: false, method: 'not-editable' };
  const node = sel.anchorNode;
  let host: HTMLElement | null = node instanceof HTMLElement ? node : (node?.parentElement ?? null);
  if (!host || !host.isContentEditable) return { ok: false, method: 'not-editable' };
  while (host.parentElement && host.parentElement.isContentEditable) host = host.parentElement;
  if (expected !== null && sel.toString() !== expected) return { ok: false, method: 'stale' };
  const before = host.textContent ?? '';
  // Nothing to change (e.g. "Remove styling" on plain text): that's a success, not a failure.
  if (expected !== null && expected === out) return { ok: true, method: 'rich' };
  try {
    document.execCommand('insertText', false, out);
  } catch {
    /* verified below */
  }
  // Rich editors (Lexical, ProseMirror, Draft.js, Slate) may update the DOM a little later: poll up to ~400 ms.
  const applied = () => {
    const after = host!.textContent ?? '';
    return after !== before && squash(after).includes(squash(out));
  };
  for (let waited = 0; waited <= 400 && !applied(); waited += 40) await new Promise((r) => setTimeout(r, 40));
  const ok = applied();
  return { ok, method: ok ? 'rich' : 'failed' };
}

/** Copy text from the page, restoring focus and selection afterwards. */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && document.hasFocus()) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through to execCommand */
  }
  const active = document.activeElement as HTMLElement | null;
  const field = active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement ? active : null;
  const fieldSel = field ? [field.selectionStart, field.selectionEnd] : null;
  const sel = window.getSelection();
  const ranges: Range[] = [];
  if (sel) for (let i = 0; i < sel.rangeCount; i++) ranges.push(sel.getRangeAt(i));

  const ta = document.createElement('textarea');
  ta.value = text;
  ta.setAttribute('readonly', '');
  ta.style.cssText = 'position:fixed;top:-9999px;left:-9999px;opacity:0;';
  (document.body ?? document.documentElement).appendChild(ta);
  ta.select();
  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch {
    ok = false;
  }
  ta.remove();
  active?.focus?.({ preventScroll: true });
  if (field && fieldSel && fieldSel[0] != null && fieldSel[1] != null) field.setSelectionRange(fieldSel[0], fieldSel[1]);
  else if (sel) {
    sel.removeAllRanges();
    ranges.forEach((r) => sel.addRange(r));
  }
  return ok;
}

/** Small, self-removing notice in the page (Shadow DOM, so page CSS can't touch it). */
export function showToast(message: string): void {
  const ID = 'fancytextpro-extension-toast';
  document.getElementById(ID)?.remove();
  const host = document.createElement('div');
  host.id = ID;
  host.style.cssText = 'all:initial;position:fixed;z-index:2147483647;right:16px;bottom:16px;';
  const root = host.attachShadow({ mode: 'closed' });
  const style = document.createElement('style');
  style.textContent =
    '.t{font:500 13px/1.45 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#fff;background:#1D4ED8;' +
    'padding:10px 14px;border-radius:8px;box-shadow:0 4px 14px rgba(15,23,42,.25);max-width:340px;' +
    'animation:in .16s ease-out}.b{font-weight:700;margin-right:6px}' +
    '@keyframes in{from{opacity:0;transform:translateY(6px)}}' +
    '@media (prefers-reduced-motion:reduce){.t{animation:none}}';
  const box = document.createElement('div');
  box.className = 't';
  box.setAttribute('role', 'status');
  box.setAttribute('aria-live', 'polite');
  const brand = document.createElement('span');
  brand.className = 'b';
  brand.textContent = 'FancyTextPro';
  box.append(brand, document.createTextNode(message));
  root.append(style, box);
  (document.body ?? document.documentElement).appendChild(host);
  setTimeout(() => host.remove(), 3500);
}
