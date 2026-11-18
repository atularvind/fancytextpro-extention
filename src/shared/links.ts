/**
 * Links to FancyTextPro.com. Every link is tagged with UTM parameters so the
 * site's existing analytics can count extension referrals. The extension
 * itself measures nothing.
 *
 * Privacy: the user's text is never put in the query string. It may be
 * passed in the URL fragment (#text=…), which browsers don't send to the
 * server and analytics don't record by default. The website can read it to
 * prefill its input (planned website change).
 */
export const SITE = 'https://www.fancytextpro.com';
export const CAMPAIGN = 'extension_v2';

export type Surface = 'popup_category' | 'popup_footer' | 'popup_header' | 'context_menu' | 'options' | 'welcome';

export const SITE_PAGES = {
  home: '/',
  bigText: '/BigTextGenerator',
  lennyFace: '/LennyFace',
  emoticons: '/Emoticons',
  textDecorator: '/TextDecorator',
  privacy: '/privacy-policy',
} as const;

const MAX_HANDOFF_CHARS = 200;

export function siteUrl(path: string, surface: Surface, text?: string): string {
  const url = new URL(path, SITE);
  url.searchParams.set('utm_source', 'extension');
  url.searchParams.set('utm_medium', surface);
  url.searchParams.set('utm_campaign', CAMPAIGN);
  const t = text?.trim();
  if (t) url.hash = `text=${encodeURIComponent(Array.from(t).slice(0, MAX_HANDOFF_CHARS).join(''))}`;
  return url.toString();
}
