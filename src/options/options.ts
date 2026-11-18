import { ext, IS_FIREFOX } from '../shared/browser';
import { applyTheme, localizeDocument, t } from '../shared/i18n';
import { SITE_PAGES, siteUrl } from '../shared/links';
import { clearHistory, loadState, saveSettings, type Settings } from '../shared/state';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const PRIVACY_URL = 'https://github.com/atularvind/fancytextpro-extention/blob/main/PRIVACY.md';

let settings: Settings;
let statusTimer: ReturnType<typeof setTimeout> | undefined;

function status(msg: string): void {
  const el = $('status');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(statusTimer);
  statusTimer = setTimeout(() => el.classList.remove('show'), 1600);
}

async function save(patch: Partial<Settings>): Promise<void> {
  settings = { ...settings, ...patch };
  await saveSettings(settings);
  applyTheme(settings.theme);
  status(t('optSaved'));
}

async function renderShortcuts(): Promise<void> {
  const dl = $('shortcuts');
  const cmds = await ext.commands.getAll();
  dl.replaceChildren(
    ...cmds.flatMap((c) => {
      const dt = document.createElement('dt');
      dt.textContent = c.name === '_execute_action' ? t('cmdOpenPopup') : (c.description ?? c.name ?? '');
      const dd = document.createElement('dd');
      const kbd = document.createElement('kbd');
      kbd.textContent = c.shortcut || t('optShortcutUnset');
      dd.append(kbd);
      return [dt, dd];
    }),
  );
  $('shortcutHelp').textContent = t(IS_FIREFOX ? 'optShortcutsFirefox' : 'optShortcutsChrome');
  const edit = $<HTMLButtonElement>('editShortcuts');
  edit.hidden = IS_FIREFOX;
  edit.addEventListener('click', () => void ext.tabs.create({ url: 'chrome://extensions/shortcuts' }));
}

async function init(): Promise<void> {
  localizeDocument();
  ({ settings } = await loadState());
  applyTheme(settings.theme);
  $<HTMLAnchorElement>('brand').href = siteUrl(SITE_PAGES.home, 'options');
  $<HTMLAnchorElement>('privacyLink').href = PRIVACY_URL;
  $('version').textContent = `FancyTextPro ${ext.runtime.getManifest().version}`;

  const theme = $<HTMLSelectElement>('theme');
  theme.value = settings.theme;
  theme.addEventListener('change', () => void save({ theme: theme.value as Settings['theme'] }));

  document.querySelectorAll<HTMLInputElement>('input[name="menuAction"]').forEach((r) => {
    r.checked = r.value === settings.menuAction;
    r.addEventListener('change', () => r.checked && void save({ menuAction: r.value as Settings['menuAction'] }));
  });

  const recent = $<HTMLInputElement>('menuShowRecent');
  recent.checked = settings.menuShowRecent;
  recent.addEventListener('change', () => void save({ menuShowRecent: recent.checked }));

  $('clear').addEventListener('click', async () => {
    if (!confirm(t('optClearConfirm'))) return;
    await clearHistory();
    status(t('optCleared'));
  });

  await renderShortcuts();
}

void init();
