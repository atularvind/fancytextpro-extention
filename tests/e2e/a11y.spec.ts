import AxeBuilder from '@axe-core/playwright';
import { expect, test } from './fixtures';

const PAGES = ['popup/popup.html', 'options/options.html', 'welcome/welcome.html'];

for (const scheme of ['light', 'dark'] as const) {
  for (const path of PAGES) {
    test(`${path} has no WCAG 2.2 AA violations (${scheme})`, async ({ context, extensionId }) => {
      const page = await context.newPage();
      await page.emulateMedia({ colorScheme: scheme });
      if (path.startsWith('popup')) await page.setViewportSize({ width: 380, height: 590 });
      await page.goto(`chrome-extension://${extensionId}/${path}`);
      await page.waitForLoadState('networkidle');
      if (path.startsWith('popup')) {
        await page.locator('#input').fill('Hello');
        // Favorite something so star/aria-pressed states are audited too.
        await page.locator('.row[data-id="bubbles"] .star').click();
      }
      const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
      const summary = results.violations.map((v) => `${v.id}: ${v.nodes.length} × ${v.help}\n   ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join('\n   ')}`);
      expect(summary, summary.join('\n')).toEqual([]);
    });
  }
}
