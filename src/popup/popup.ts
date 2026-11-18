import { applyStyle, CATEGORIES, getCategory, getStyle, SITE_ONLY_CATEGORIES, unstyle } from '../engine/catalog';
import { readSelection, type PageSelection } from '../inject/page';
import { ext } from '../shared/browser';
import { applyTheme, localizeDocument, t } from '../shared/i18n';
import { SITE_PAGES, siteUrl } from '../shared/links';
import type { InsertMessage, TakePendingMessage } from '../shared/messages';
import { loadState, recordRecent, saveFavorites, toggleFavorite, type UserState } from '../shared/state';
import { buildSections, type Filter } from './sections';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const input = $<HTMLTextAreaElement>('input');
const search = $<HTMLInputElement>('search');
const list = $<HTMLElement>('list');
const chips = $<HTMLElement>('chips');
const toast = $<HTMLElement>('toast');
const removeStylingBtn = $<HTMLButtonElement>('removeStyling');
const clearInputBtn = $<HTMLButtonElement>('clearInput');
const insertHint = $<HTMLElement>('insertHint');

let state: UserState;
let filter: Filter = 'all';
/** Tab whose selection was read on open; set when inserting into the page is possible. */
let insertTarget: { tabId: number; expected: string | null } | null = null;

const rowTemplate = $<HTMLTemplateElement>('row-template');

function sourceText(): string {
  return input.value.trim() ? input.value : t('sampleText');
}

// ---------- toast ----------
let toastTimer: ReturnType<typeof setTimeout> | undefined;
function showToast(message: string): void {
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 1800);
}

// ---------- actions ----------
async function copyStyle(id: string): Promise<void> {
  const style = getStyle(id);
  if (!style) return;
  try {
    await navigator.clipboard.writeText(applyStyle(style, sourceText()));
    showToast(t('popupCopied', style.name));
    state.recent = await recordRecent(id);
  } catch {
    showToast(t('popupCopyFailed'));
  }
}

function insertStyle(id: string): void {
  if (!insertTarget || !getStyle(id)) return;
  const msg: InsertMessage = { type: 'ftp:insert', tabId: insertTarget.tabId, styleId: id, text: sourceText(), expectedSelection: insertTarget.expected };
  void ext.runtime.sendMessage(msg);
  // Close so focus returns to the page; the background inserts once it has.
  setTimeout(() => window.close(), 60);
}

async function toggleFav(id: string, btn: HTMLButtonElement): Promise<void> {
  state.favorites = toggleFavorite(state.favorites, id);
  await saveFavorites(state.favorites);
  const on = state.favorites.includes(id);
  // Update every row for this style in place (it can appear in several sections).
  list.querySelectorAll<HTMLButtonElement>(`.row[data-id="${CSS.escape(id)}"] .star`).forEach((b) => setStar(b, id, on));
  showToast(t(on ? 'favoriteAdded' : 'favoriteRemoved', getStyle(id)?.name ?? id));
  btn.focus();
}

function setStar(btn: HTMLButtonElement, id: string, on: boolean): void {
  const name = getStyle(id)?.name ?? id;
  btn.setAttribute('aria-pressed', String(on));
  btn.setAttribute('aria-label', t(on ? 'favoriteRemoveLabel' : 'favoriteAddLabel', name));
  btn.title = btn.getAttribute('aria-label')!;
}

// ---------- rendering ----------
function rowEl(id: string): HTMLLIElement {
  const style = getStyle(id)!;
  const li = (rowTemplate.content.firstElementChild as HTMLLIElement).cloneNode(true) as HTMLLIElement;
  li.dataset.id = id;
  const main = li.querySelector<HTMLButtonElement>('.row-main')!;
  // Accessible name comes from content: "Copy" (screen-reader only) + the visible style name.
  // The styled preview is aria-hidden: screen readers would read it as "mathematical bold capital H…".
  const name = li.querySelector<HTMLElement>('.name')!;
  const verb = document.createElement('span');
  verb.className = 'sr-only';
  verb.textContent = `${t('copyVerb')} `;
  name.append(verb, style.name);
  if (style.fragile) {
    name.classList.add('is-fragile');
    li.querySelector<HTMLElement>('.row-main')!.title = t('fragileHint');
    const hint = document.createElement('span');
    hint.className = 'sr-only';
    hint.textContent = ` (${t('fragileHint')})`;
    name.append(hint);
  }
  setStar(li.querySelector<HTMLButtonElement>('.star')!, id, state.favorites.includes(id));
  const ins = li.querySelector<HTMLButtonElement>('.insert')!;
  if (insertTarget) {
    ins.setAttribute('aria-label', t('insertStyleLabel', style.name));
    ins.title = ins.getAttribute('aria-label')!;
  } else ins.remove();
  return li;
}

function renderList(): void {
  const sections = buildSections({ query: search.value, filter, favorites: state.favorites, recent: state.recent });
  const frag = document.createDocumentFragment();
  let total = 0;
  for (const sec of sections) {
    if (sec.styleIds.length === 0 && sec.titleKey !== 'sectionFavorites') continue;
    const el = document.createElement('section');
    el.className = 'section';
    const h = document.createElement('h2');
    const cat = sec.category ? getCategory(sec.category) : undefined;
    h.textContent = cat ? cat.label : t(sec.titleKey);
    const ul = document.createElement('ul');
    ul.className = 'rows';
    sec.styleIds.forEach((id) => ul.append(rowEl(id)));
    total += sec.styleIds.length;
    el.append(h, ul);
    if (sec.styleIds.length === 0) {
      const p = document.createElement('p');
      p.className = 'empty';
      p.textContent = t('favoritesEmpty');
      el.append(p);
    }
    if (cat) {
      const a = document.createElement('a');
      a.className = 'more-link';
      a.href = siteUrl(cat.sitePath, 'popup_category', input.value);
      a.target = '_blank';
      a.rel = 'noopener';
      a.textContent = t('moreCategoryOnSite', cat.label);
      el.append(a);
    }
    frag.append(el);
  }
  if (total === 0 && search.value.trim()) {
    const p = document.createElement('p');
    p.className = 'empty';
    p.textContent = t('noResults', search.value.trim());
    frag.append(p);
  }
  list.replaceChildren(frag);
  updatePreviews();
}

let raf = 0;
function updatePreviews(): void {
  cancelAnimationFrame(raf);
  raf = requestAnimationFrame(() => {
    const text = sourceText();
    const cache = new Map<string, string>();
    list.querySelectorAll<HTMLElement>('.row').forEach((row) => {
      const id = row.dataset.id!;
      let out = cache.get(id);
      if (out === undefined) {
        out = applyStyle(getStyle(id)!, text);
        cache.set(id, out);
      }
      row.querySelector('.preview')!.textContent = out;
    });
    removeStylingBtn.hidden = !input.value || unstyle(input.value) === input.value;
    clearInputBtn.hidden = !input.value;
  });
}

function renderChips(): void {
  const make = (key: Filter, label: string) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip';
    b.dataset.filter = key;
    b.textContent = label;
    b.setAttribute('aria-pressed', String(filter === key));
    return b;
  };
  const frag = document.createDocumentFragment();
  frag.append(make('all', t('chipAll')), make('favorites', `★ ${t('chipFavorites')}`));
  CATEGORIES.forEach((c) => frag.append(make(c.id, c.label)));
  SITE_ONLY_CATEGORIES.forEach((c) => {
    const a = document.createElement('a');
    a.className = 'chip external';
    a.href = siteUrl(c.sitePath, 'popup_category', input.value);
    a.target = '_blank';
    a.rel = 'noopener';
    a.textContent = `${c.label} ↗`;
    a.title = t('openOnSite');
    frag.append(a);
  });
  chips.replaceChildren(frag);
}

function renderFooter(): void {
  const links: [string, string][] = [
    [t('footAllStyles'), SITE_PAGES.home],
    [t('footBigText'), SITE_PAGES.bigText],
    [t('footLenny'), SITE_PAGES.lennyFace],
    [t('footDecorator'), SITE_PAGES.textDecorator],
  ];
  const nav = $<HTMLElement>('footLinks');
  nav.replaceChildren(
    ...links.map(([label, path]) => {
      const a = document.createElement('a');
      a.href = siteUrl(path, 'popup_footer', path === SITE_PAGES.home ? input.value : undefined);
      a.target = '_blank';
      a.rel = 'noopener';
      a.textContent = `${label} ↗`;
      return a;
    }),
  );
}

async function renderTip(): Promise<void> {
  let shortcut = '';
  try {
    const cmds = await ext.commands.getAll();
    shortcut = cmds.find((c) => c.name === 'apply-last-style')?.shortcut ?? '';
  } catch {
    /* ignore */
  }
  const tips = [t('tipRightClick'), t('tipPlainKeywords'), shortcut ? t('tipShortcut', shortcut) : t('tipFavorites')];
  $<HTMLElement>('tip').textContent = tips[new Date().getDate() % tips.length]!;
}

// ---------- events ----------
input.addEventListener('input', () => {
  input.style.height = 'auto';
  input.style.height = `${Math.min(input.scrollHeight, 96)}px`;
  updatePreviews();
});

search.addEventListener('input', renderList);
search.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && search.value) {
    e.preventDefault();
    search.value = '';
    renderList();
  }
});

removeStylingBtn.addEventListener('click', async () => {
  input.value = unstyle(input.value);
  updatePreviews();
  try {
    await navigator.clipboard.writeText(input.value);
    showToast(t('plainCopied'));
  } catch {
    /* text is still in the input */
  }
  input.focus();
});

clearInputBtn.addEventListener('click', () => {
  input.value = '';
  updatePreviews();
  input.focus();
});

chips.addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button.chip');
  if (!b) return;
  filter = b.dataset.filter as Filter;
  chips.querySelectorAll('button.chip').forEach((c) => c.setAttribute('aria-pressed', String(c === b)));
  renderList();
  list.scrollTop = 0;
});

list.addEventListener('click', (e) => {
  const target = e.target as HTMLElement;
  const row = target.closest<HTMLElement>('.row');
  if (!row) return;
  const id = row.dataset.id!;
  const btn = target.closest<HTMLButtonElement>('button');
  if (btn?.classList.contains('star')) void toggleFav(id, btn);
  else if (btn?.classList.contains('insert')) insertStyle(id);
  else if (btn) void copyStyle(id);
});

function rowButtons(): HTMLButtonElement[] {
  return [...list.querySelectorAll<HTMLButtonElement>('.row-main')];
}

function moveFocus(from: Element | null, delta: number): void {
  const items = rowButtons();
  if (!items.length) return;
  const i = from ? items.indexOf(from as HTMLButtonElement) : -1;
  const next = items[Math.max(0, Math.min(items.length - 1, i + delta))];
  next?.focus();
  next?.scrollIntoView({ block: 'nearest' });
}

document.addEventListener('keydown', (e) => {
  const active = document.activeElement;
  const inRow = active instanceof HTMLButtonElement && active.classList.contains('row-main');
  const typing = active === input || active === search;

  if (e.key === '/' && !typing) {
    e.preventDefault();
    search.focus();
    return;
  }
  if (e.key === 'ArrowDown' && (typing || inRow)) {
    if (active === input && input.value.includes('\n')) return; // let multi-line input move the caret
    e.preventDefault();
    moveFocus(inRow ? active : null, inRow ? 1 : 0);
    return;
  }
  if (!inRow) return;
  const id = active.closest<HTMLElement>('.row')!.dataset.id!;
  if (e.key === 'ArrowUp') {
    e.preventDefault();
    const items = rowButtons();
    if (items.indexOf(active) === 0) search.focus();
    else moveFocus(active, -1);
  } else if (e.key === 'Home' || e.key === 'End') {
    e.preventDefault();
    const items = rowButtons();
    (e.key === 'Home' ? items[0] : items[items.length - 1])?.focus();
  } else if (e.key === 'Enter' && e.shiftKey && insertTarget) {
    e.preventDefault();
    insertStyle(id);
  } else if (e.key.toLowerCase() === 'f' && !e.ctrlKey && !e.metaKey && !e.altKey) {
    e.preventDefault();
    const star = active.closest('.row')!.querySelector<HTMLButtonElement>('.star')!;
    void toggleFav(id, star);
    active.focus();
  }
});

$<HTMLButtonElement>('openOptions').addEventListener('click', () => void ext.runtime.openOptionsPage());

// ---------- start ----------
async function readActiveSelection(): Promise<{ tabId: number; sel: PageSelection } | undefined> {
  try {
    const [tab] = await ext.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return undefined;
    const [res] = await ext.scripting.executeScript({ target: { tabId: tab.id }, func: readSelection });
    return res?.result ? { tabId: tab.id, sel: res.result as PageSelection } : undefined;
  } catch {
    return undefined; // restricted page (browser settings, store, PDF viewer…)
  }
}

async function init(): Promise<void> {
  localizeDocument();
  state = await loadState();
  applyTheme(state.settings.theme);
  $<HTMLAnchorElement>('brand').href = siteUrl(SITE_PAGES.home, 'popup_header');

  const pending = (await ext.runtime.sendMessage({ type: 'ftp:take-pending' } satisfies TakePendingMessage).catch(() => undefined)) as { text?: string } | undefined;
  if (pending?.text) {
    input.value = pending.text;
  } else {
    const active = await readActiveSelection();
    if (active?.sel.text) input.value = active.sel.text;
    if (active?.sel.editable) insertTarget = { tabId: active.tabId, expected: active.sel.text };
  }
  insertHint.hidden = !insertTarget;

  renderChips();
  renderFooter();
  renderList();
  void renderTip();
  input.dispatchEvent(new Event('input'));
  input.focus();
  input.select();
  performance.mark('ftp:ready');
}

void init();
