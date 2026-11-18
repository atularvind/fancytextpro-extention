import { ext } from './browser';

/** Localised string from _locales; falls back to the key so missing strings are obvious. */
export function t(key: string, substitutions?: string | string[]): string {
  return ext.i18n.getMessage(key, substitutions) || key;
}

/**
 * Fill elements marked with data-i18n (textContent), data-i18n-placeholder,
 * data-i18n-title and data-i18n-aria-label.
 */
export function localizeDocument(root: ParentNode = document): void {
  root.querySelectorAll<HTMLElement>('[data-i18n]').forEach((el) => (el.textContent = t(el.dataset.i18n!)));
  root.querySelectorAll<HTMLElement>('[data-i18n-placeholder]').forEach((el) => el.setAttribute('placeholder', t(el.dataset.i18nPlaceholder!)));
  root.querySelectorAll<HTMLElement>('[data-i18n-title]').forEach((el) => el.setAttribute('title', t(el.dataset.i18nTitle!)));
  root.querySelectorAll<HTMLElement>('[data-i18n-aria-label]').forEach((el) => el.setAttribute('aria-label', t(el.dataset.i18nAriaLabel!)));
  document.documentElement.lang = ext.i18n.getUILanguage();
}

export function applyTheme(theme: 'system' | 'light' | 'dark'): void {
  if (theme === 'system') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = theme;
}
