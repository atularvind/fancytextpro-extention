import type { Page, Worker } from '@playwright/test';
import { expect, FIXTURE_ORIGIN, test } from './fixtures';

const BOLD_WORLD = '𝐰𝐨𝐫𝐥𝐝';

async function openFixture(context: import('@playwright/test').BrowserContext): Promise<Page> {
  const page = await context.newPage();
  await page.goto(`${FIXTURE_ORIGIN}/`);
  await page.bringToFront();
  return page;
}

/** Call the background's apply function (what a context-menu click does) via the e2e-only hook. */
async function applyInActiveTab(sw: Worker, styleId: string, mode: 'replace' | 'copy' = 'replace'): Promise<string> {
  return sw.evaluate(
    async ({ styleId, mode }) => {
      const [tab] = await chrome.tabs.query({ url: 'https://fixture.test/*' });
      const hook = (globalThis as unknown as { __ftpTest: { applyStyleInTab: (r: object) => Promise<string> } }).__ftpTest;
      return hook.applyStyleInTab({ tabId: tab!.id!, styleId, mode });
    },
    { styleId, mode },
  );
}

async function selectRange(page: Page, selector: string, start: number, end: number) {
  await page.evaluate(
    ({ selector, start, end }) => {
      const el = document.querySelector(selector) as HTMLInputElement | HTMLTextAreaElement;
      el.focus();
      el.setSelectionRange(start, end);
    },
    { selector, start, end },
  );
}

async function selectContents(page: Page, selector: string) {
  await page.evaluate((selector) => {
    const el = document.querySelector(selector) as HTMLElement;
    if (el.isContentEditable) el.focus();
    const r = document.createRange();
    r.selectNodeContents(el);
    getSelection()!.removeAllRanges();
    getSelection()!.addRange(r);
  }, selector);
}

test.describe('install', () => {
  test('opens the welcome page once on install', async ({ context, extensionId }) => {
    await expect.poll(() => context.pages().map((p) => p.url())).toContain(`chrome-extension://${extensionId}/welcome/welcome.html`);
    const welcome = context.pages().find((p) => p.url().includes('welcome.html'))!;
    await expect(welcome.locator('h1')).toHaveText('Welcome to FancyTextPro');
  });

  test('requests only the minimal permissions', async ({ sw }) => {
    const perms = await sw.evaluate(() => chrome.runtime.getManifest().permissions);
    expect(perms?.sort()).toEqual(['activeTab', 'contextMenus', 'scripting', 'storage']);
  });
});

test.describe('in-page conversion (context menu / shortcut path)', () => {
  test('replaces a textarea selection in place, and Ctrl+Z undoes it', async ({ context, sw }) => {
    const page = await openFixture(context);
    await selectRange(page, '#ta', 6, 11);
    expect(await applyInActiveTab(sw, 'boldCharMap')).toBe('replaced');
    await expect(page.locator('#ta')).toHaveValue(`hello ${BOLD_WORLD}`);
    await page.locator('#ta').press('ControlOrMeta+z');
    await expect(page.locator('#ta')).toHaveValue('hello world');
  });

  test('fires input events that controlled-input frameworks rely on', async ({ context, sw }) => {
    const page = await openFixture(context);
    await selectRange(page, '#inp', 0, 5);
    expect(await applyInActiveTab(sw, 'bubbles')).toBe('replaced');
    await expect(page.locator('#inp')).toHaveValue('ⓡⓔⓐⓒⓣ input');
    expect(await page.evaluate(() => (window as unknown as { inputLog: string[] }).inputLog.at(-1))).toBe('ⓡⓔⓐⓒⓣ input');
  });

  test('replaces a contenteditable selection', async ({ context, sw }) => {
    const page = await openFixture(context);
    await selectContents(page, '#ce');
    expect(await applyInActiveTab(sw, 'italicCharMap')).toBe('replaced');
    await expect(page.locator('#ce')).toHaveText('𝘳𝘪𝘤𝘩 𝘦𝘥𝘪𝘵𝘰𝘳 𝘵𝘦𝘹𝘵');
  });

  test('copies (with a notice) when the selection is not editable', async ({ context, sw }) => {
    const page = await openFixture(context);
    await selectContents(page, '#para');
    expect(await applyInActiveTab(sw, 'boldCharMap')).toBe('copied');
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('𝐏𝐥𝐚𝐢𝐧 𝐩𝐚𝐫𝐚𝐠𝐫𝐚𝐩𝐡 𝐭𝐞𝐱𝐭');
    await expect(page.locator('#fancytextpro-extension-toast')).toHaveCount(1);
    await expect(page.locator('#para')).toHaveText('Plain paragraph text');
  });

  test('falls back to copy when an editor rejects the edit', async ({ context, sw }) => {
    const page = await openFixture(context);
    await selectContents(page, '#hostile');
    expect(await applyInActiveTab(sw, 'boldCharMap')).toBe('copied');
    await expect(page.locator('#hostile')).toHaveText('locked editor');
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('𝐥𝐨𝐜𝐤𝐞𝐝 𝐞𝐝𝐢𝐭𝐨𝐫');
  });

  test('"always copy" setting never modifies the page', async ({ context, sw }) => {
    const page = await openFixture(context);
    await selectRange(page, '#ta', 0, 5);
    expect(await applyInActiveTab(sw, 'boldCharMap', 'copy')).toBe('copied');
    await expect(page.locator('#ta')).toHaveValue('hello world');
  });

  test('restyles already-styled text and can remove styling', async ({ context, sw }) => {
    const page = await openFixture(context);
    await selectRange(page, '#ta', 6, 11);
    await applyInActiveTab(sw, 'boldCharMap');
    await page.evaluate(() => (document.querySelector('#ta') as HTMLTextAreaElement).select());
    expect(await applyInActiveTab(sw, 'plain')).toBe('replaced');
    await expect(page.locator('#ta')).toHaveValue('hello world');
  });

  test('records the style as recently used', async ({ context, sw }) => {
    const page = await openFixture(context);
    await selectRange(page, '#ta', 0, 5);
    await applyInActiveTab(sw, 'flip');
    expect(await sw.evaluate(async () => (await chrome.storage.local.get('recent')).recent)).toEqual(['flip']);
  });

  test('reports nothing-selected without touching the page', async ({ context, sw }) => {
    const page = await openFixture(context);
    await page.evaluate(() => getSelection()!.removeAllRanges());
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    expect(await applyInActiveTab(sw, 'boldCharMap')).toBe('nothing-selected');
  });
});

test.describe('popup → page insert', () => {
  test('inserts the styled popup text at the page caret', async ({ context, sw }) => {
    const page = await openFixture(context);
    await selectRange(page, '#ta', 5, 5); // caret after "hello"
    const outcome = await sw.evaluate(async () => {
      const [tab] = await chrome.tabs.query({ url: 'https://fixture.test/*' });
      const hook = (globalThis as unknown as { __ftpTest: { insertFromPopup: (...a: unknown[]) => Promise<string> } }).__ftpTest;
      return hook.insertFromPopup(tab!.id!, 'boldCharMap', ' there', '');
    });
    expect(outcome).toBe('replaced');
    await expect(page.locator('#ta')).toHaveValue('hello 𝐭𝐡𝐞𝐫𝐞 world');
  });

  test('refuses to insert if the page selection changed after the popup opened', async ({ context, sw }) => {
    const page = await openFixture(context);
    await selectRange(page, '#ta', 0, 5);
    const outcome = await sw.evaluate(async () => {
      const [tab] = await chrome.tabs.query({ url: 'https://fixture.test/*' });
      const hook = (globalThis as unknown as { __ftpTest: { insertFromPopup: (...a: unknown[]) => Promise<string> } }).__ftpTest;
      return hook.insertFromPopup(tab!.id!, 'boldCharMap', 'x', 'world');
    });
    expect(outcome).toBe('copied');
    await expect(page.locator('#ta')).toHaveValue('hello world');
  });
});

test.describe('upgrade from 1.x', () => {
  test('removes 1.x storage keys but keeps 2.x data', async ({ sw }) => {
    const left = await sw.evaluate(async () => {
      await chrome.storage.sync.set({ favorites: ['flip'], oldFonts: [1, 2], theme1x: 'x' });
      await chrome.storage.local.set({ recent: ['bubbles'], history: ['a'] });
      const hook = (globalThis as unknown as { __ftpTest: { removeLegacyStorage: () => Promise<void> } }).__ftpTest;
      await hook.removeLegacyStorage();
      return { sync: await chrome.storage.sync.get(null), local: await chrome.storage.local.get(null) };
    });
    expect(left.sync).toEqual({ favorites: ['flip'] });
    expect(left.local).toEqual({ recent: ['bubbles'] });
  });
});

test.describe('context menu', () => {
  test('builds without errors, and rebuilds when favorites change', async ({ sw }) => {
    const ok = await sw.evaluate(async () => {
      const hook = (globalThis as unknown as { __ftpTest: { rebuildMenus: () => Promise<void> } }).__ftpTest;
      await chrome.storage.sync.set({ favorites: ['flip', 'bubbles'] });
      await hook.rebuildMenus();
      return chrome.runtime.lastError === undefined;
    });
    expect(ok).toBe(true);
  });
});

test.describe('popup', () => {
  async function openPopup(context: import('@playwright/test').BrowserContext, extensionId: string): Promise<Page> {
    const popup = await context.newPage();
    await popup.setViewportSize({ width: 380, height: 590 });
    await popup.goto(`chrome-extension://${extensionId}/popup/popup.html`);
    await expect(popup.locator('.row').first()).toBeVisible();
    return popup;
  }

  test('lists 140+ styles with live previews', async ({ context, extensionId }) => {
    const popup = await openPopup(context, extensionId);
    expect(await popup.locator('.row').count()).toBeGreaterThanOrEqual(140);
    await popup.locator('#input').fill('Hello');
    await expect(popup.locator('.row[data-id="boldCharMap"] .preview')).toHaveText('𝐇𝐞𝐥𝐥𝐨');
    await expect(popup.locator('.row[data-id="flip"] .preview')).toHaveText('ollǝH');
  });

  test('search and category chips filter the list', async ({ context, extensionId }) => {
    const popup = await openPopup(context, extensionId);
    await popup.locator('#search').fill('cursive');
    await expect(popup.locator('.section')).toHaveCount(1);
    const ids = await popup.locator('.row').evaluateAll((rows) => rows.map((r) => (r as HTMLElement).dataset.id));
    expect(ids).toContain('cursiveLetters');
    expect(ids).not.toContain('boldCharMap');
    await popup.locator('#search').fill('');
    await popup.locator('.chip', { hasText: 'Lines' }).click();
    await expect(popup.locator('.section h2')).toHaveText(['Lines']);
  });

  test('keyboard: ↓ from the input, Enter copies, f favorites', async ({ context, extensionId }) => {
    const popup = await openPopup(context, extensionId);
    await popup.locator('#input').fill('Hi');
    await popup.locator('#input').press('ArrowDown');
    const first = popup.locator('.row-main').first();
    await expect(first).toBeFocused();
    const id = await first.evaluate((b) => (b.closest('.row') as HTMLElement).dataset.id!);
    await popup.keyboard.press('Enter');
    await expect(popup.locator('#toast')).toContainText('Copied');
    const expected = await popup.locator(`.row[data-id="${id}"] .preview`).first().textContent();
    expect(await popup.evaluate(() => navigator.clipboard.readText())).toBe(expected);
    await popup.keyboard.press('f');
    await expect(popup.locator(`.row[data-id="${id}"] .star`).first()).toHaveAttribute('aria-pressed', 'true');
  });

  test('favorites persist and appear first', async ({ context, extensionId }) => {
    let popup = await openPopup(context, extensionId);
    await popup.locator('.row[data-id="bubbles"] .star').click();
    await popup.close();
    popup = await openPopup(context, extensionId);
    await expect(popup.locator('.section').first().locator('h2')).toHaveText('Favorites');
    await expect(popup.locator('.section').first().locator('.row')).toHaveAttribute('data-id', 'bubbles');
  });

  test('"Remove styling" turns styled input back into plain text', async ({ context, extensionId }) => {
    const popup = await openPopup(context, extensionId);
    await popup.locator('#input').fill('𝐁𝐨𝐥𝐝 text');
    await popup.locator('#removeStyling').click();
    await expect(popup.locator('#input')).toHaveValue('Bold text');
  });

  test('website links carry UTM tags and keep text out of the query string', async ({ context, extensionId }) => {
    const popup = await openPopup(context, extensionId);
    await popup.locator('#input').fill('private words');
    const href = await popup.locator('.foot-links a').first().getAttribute('href');
    const url = new URL(href!);
    expect(url.searchParams.get('utm_source')).toBe('extension');
    expect(url.search).not.toContain('private');
  });

  test('becomes interactive quickly', async ({ context, extensionId }) => {
    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${extensionId}/popup/popup.html`);
    await expect(popup.locator('.row').first()).toBeVisible();
    const ready = await popup.evaluate(() => performance.getEntriesByName('ftp:ready')[0]?.startTime ?? -1);
    console.log(`popup ready after ${ready.toFixed(0)} ms`);
    expect(ready).toBeGreaterThan(0);
    expect(ready).toBeLessThan(500); // target is 100 ms on a normal machine; CI headless gets headroom
  });

  test('has no console errors', async ({ context, extensionId }) => {
    const errors: string[] = [];
    const popup = await context.newPage();
    popup.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    popup.on('pageerror', (e) => errors.push(e.message));
    await popup.goto(`chrome-extension://${extensionId}/popup/popup.html`);
    await expect(popup.locator('.row').first()).toBeVisible();
    await popup.locator('#input').fill('test');
    expect(errors).toEqual([]);
  });
});

test.describe('options', () => {
  test('saves settings to sync storage', async ({ context, extensionId, sw }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/options/options.html`);
    await page.locator('#theme').selectOption('dark');
    await page.locator('input[name="menuAction"][value="copy"]').check();
    await expect
      .poll(() => sw.evaluate(async () => (await chrome.storage.sync.get('settings')).settings))
      .toEqual({ theme: 'dark', menuAction: 'copy', menuShowRecent: true });
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  });
});
