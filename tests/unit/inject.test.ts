// @vitest-environment jsdom
/**
 * The injected page functions, run in jsdom. jsdom has no execCommand
 * editing support, so these exercise the fallback paths. The real-browser
 * paths are covered by the Playwright e2e tests.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { copyText, readSelection, replaceSelection, showToast } from '../../src/inject/page';

beforeEach(() => {
  document.body.innerHTML = '';
  // jsdom lacks execCommand; make it report "not supported" like a hostile editor would.
  document.execCommand = vi.fn(() => false);
});

function field(tag: 'input' | 'textarea', value: string, start: number, end: number) {
  const el = document.createElement(tag);
  el.value = value;
  document.body.append(el);
  el.focus();
  el.setSelectionRange(start, end);
  return el;
}

describe('readSelection', () => {
  it('reads a textarea selection as editable', () => {
    field('textarea', 'hello world', 6, 11);
    expect(readSelection()).toEqual({ text: 'world', editable: true, kind: 'field' });
  });

  it('treats read-only fields as not editable', () => {
    const el = field('input', 'hello', 0, 5);
    el.readOnly = true;
    expect(readSelection().editable).toBe(false);
  });

  it('never reads password fields', () => {
    const el = document.createElement('input');
    el.type = 'password';
    el.value = 'secret';
    document.body.append(el);
    el.focus();
    expect(readSelection().text).not.toBe('secret');
  });

  it('reads page selections as not editable', () => {
    document.body.innerHTML = '<p id="p">Plain paragraph</p>';
    const range = document.createRange();
    range.selectNodeContents(document.getElementById('p')!);
    getSelection()!.removeAllRanges();
    getSelection()!.addRange(range);
    expect(readSelection()).toMatchObject({ text: 'Plain paragraph', editable: false, kind: 'page' });
  });
});

describe('replaceSelection', () => {
  it('replaces the selected range in a textarea and fires input', async () => {
    const el = field('textarea', 'hello world', 6, 11);
    const onInput = vi.fn();
    el.addEventListener('input', onInput);
    const res = await replaceSelection('𝐰𝐨𝐫𝐥𝐝', 'world');
    expect(res).toEqual({ ok: true, method: 'setRangeText' });
    expect(el.value).toBe('hello 𝐰𝐨𝐫𝐥𝐝');
    expect(onInput).toHaveBeenCalledOnce();
  });

  it('inserts at the caret when nothing is selected', async () => {
    const el = field('input', 'ab', 1, 1);
    const res = await replaceSelection('X', '');
    expect(res.ok).toBe(true);
    expect(el.value).toBe('aXb');
  });

  it('refuses to overwrite if the selection changed since it was read', async () => {
    const el = field('textarea', 'hello world', 0, 5);
    const res = await replaceSelection('𝐡𝐞𝐥𝐥𝐨', 'world');
    expect(res).toEqual({ ok: false, method: 'stale' });
    expect(el.value).toBe('hello world');
  });

  it('refuses read-only fields', async () => {
    const el = field('textarea', 'locked', 0, 6);
    el.readOnly = true;
    expect(await replaceSelection('x', null)).toEqual({ ok: false, method: 'not-editable' });
  });

  it('reports failure (so the caller copies instead) when a rich editor ignores the edit', async () => {
    document.body.innerHTML = '<div contenteditable="true" id="ed">Hello there</div>';
    const ed = document.getElementById('ed')!;
    ed.focus();
    const range = document.createRange();
    range.selectNodeContents(ed);
    getSelection()!.removeAllRanges();
    getSelection()!.addRange(range);
    // jsdom doesn't implement isContentEditable; emulate the browser.
    Object.defineProperty(HTMLElement.prototype, 'isContentEditable', { configurable: true, get() { return this.getAttribute?.('contenteditable') === 'true' || !!this.parentElement?.isContentEditable; } });
    const res = await replaceSelection('𝐇𝐞𝐥𝐥𝐨', 'Hello there');
    expect(res).toEqual({ ok: false, method: 'failed' });
    expect(ed.textContent).toBe('Hello there');
  });
});

describe('copyText', () => {
  it('uses the async clipboard when the page has focus', async () => {
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    vi.spyOn(document, 'hasFocus').mockReturnValue(true);
    expect(await copyText('𝐡𝐢')).toBe(true);
    expect(writeText).toHaveBeenCalledWith('𝐡𝐢');
  });

  it('falls back to execCommand and restores the field selection', async () => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: vi.fn(async () => Promise.reject(new Error('denied'))) } });
    vi.spyOn(document, 'hasFocus').mockReturnValue(true);
    document.execCommand = vi.fn((cmd: string) => cmd === 'copy');
    const el = field('textarea', 'keep my selection', 5, 7);
    expect(await copyText('x')).toBe(true);
    expect(document.activeElement).toBe(el);
    expect([el.selectionStart, el.selectionEnd]).toEqual([5, 7]);
    expect(document.querySelectorAll('textarea')).toHaveLength(1); // temp textarea removed
  });
});

describe('showToast', () => {
  it('adds one self-contained notice and replaces an existing one', () => {
    showToast(' Copied');
    showToast(' Copied again');
    const hosts = document.querySelectorAll('#fancytextpro-extension-toast');
    expect(hosts).toHaveLength(1);
  });
});
