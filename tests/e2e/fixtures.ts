import { test as base, chromium, type BrowserContext, type Worker } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const EXT_DIR = path.join(ROOT, 'dist', 'chrome-e2e');
export const FIXTURE_ORIGIN = 'https://fixture.test';

/** A page with every kind of field the extension has to deal with. */
export const FIXTURE_HTML = `<!doctype html><html><head><meta charset="utf-8"><title>Fixture</title></head><body>
<textarea id="ta">hello world</textarea>
<input id="inp" value="react input">
<div id="ce" contenteditable="true">rich editor text</div>
<div id="hostile" contenteditable="true">locked editor</div>
<p id="para">Plain paragraph text</p>
<input id="pw" type="password" value="secret">
<script>
  // Mimics a controlled-input framework: tracks value via input events.
  window.inputLog = [];
  document.getElementById('inp').addEventListener('input', e => window.inputLog.push(e.target.value));
  // Mimics a framework editor that re-renders from its own state and drops DOM edits it didn't make.
  const hostile = document.getElementById('hostile');
  hostile.addEventListener('input', () => { hostile.textContent = 'locked editor'; });
</script>
</body></html>`;

type Fixtures = { context: BrowserContext; extensionId: string; sw: Worker };

export const test = base.extend<Fixtures>({
  // eslint-disable-next-line no-empty-pattern
  context: async ({}, use) => {
    const context = await chromium.launchPersistentContext('', {
      channel: 'chromium', // new headless mode supports extensions
      headless: true,
      args: [`--disable-extensions-except=${EXT_DIR}`, `--load-extension=${EXT_DIR}`],
      permissions: ['clipboard-read', 'clipboard-write'],
    });
    await context.route(`${FIXTURE_ORIGIN}/**`, (route) => route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: FIXTURE_HTML }));
    await use(context);
    await context.close();
  },
  sw: async ({ context }, use) => {
    const sw = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
    await use(sw);
  },
  extensionId: async ({ sw }, use) => {
    await use(new URL(sw.url()).host);
  },
});

export const expect = test.expect;
