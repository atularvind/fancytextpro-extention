import { ext } from '../shared/browser';
import { applyTheme, localizeDocument, t } from '../shared/i18n';
import { SITE_PAGES, siteUrl } from '../shared/links';
import { loadState } from '../shared/state';

async function init(): Promise<void> {
  localizeDocument();
  applyTheme((await loadState()).settings.theme);
  (document.getElementById('brand') as HTMLAnchorElement).href = siteUrl(SITE_PAGES.home, 'welcome');
  (document.getElementById('siteLink') as HTMLAnchorElement).href = siteUrl(SITE_PAGES.home, 'welcome');

  const demo = document.getElementById('demo') as HTMLTextAreaElement;
  demo.value = t('welcomeDemoText');

  let shortcut = '';
  try {
    shortcut = (await ext.commands.getAll()).find((c) => c.name === '_execute_action')?.shortcut ?? '';
  } catch {
    /* ignore */
  }
  const step2 = document.getElementById('step2')!;
  step2.textContent = t('welcomeStep2Body');
  if (shortcut) {
    const kbd = document.createElement('kbd');
    kbd.textContent = shortcut;
    step2.append(' ', t('welcomeStep2Shortcut'), ' ', kbd, '.');
  }
}

void init();
