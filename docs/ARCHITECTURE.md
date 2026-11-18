# Architecture

FancyTextPro is a Manifest V3 extension built from one TypeScript source tree for Chrome and Firefox. It has no runtime dependencies, no framework, and no network access. The design goal is to stay **small, private and easy to review**.

```
                ┌────────────────────────── extension ──────────────────────────┐
 user action    │                                                               │
 ─────────────▶ │  background (SW / event page)                                 │
 right-click    │   menus.ts ──── builds menu from favorites/recent/defaults    │
 shortcut       │   actions.ts ─┐                                               │
                │               │ scripting.executeScript (activeTab, one-off)  │
                │               ▼                                               │
                │   inject/page.ts ── readSelection → [engine] → replaceSelection│
                │                     └─ copyText / showToast fallback          │
                │                                                               │
 toolbar click  │  popup ── engine (live previews) ── clipboard                 │
                │     └── "insert" ─▶ runtime message ─▶ background ─▶ page     │
                │                                                               │
                │  engine/ (pure) ◀── data/site-styles.json ◀── scripts/sync-styles
                │  shared/ (browser shim, state, links, i18n, tokens)           │
                └───────────────────────────────────────────────────────────────┘
```

## Modules

| Path | Responsibility | Talks to browser APIs? |
|---|---|---|
| `src/engine/` | Text engine: style catalogue, grapheme-aware transforms, `unstyle()`. | **No.** Pure functions, fully unit-tested |
| `src/engine/data/site-styles.json` | Generated, declarative style models derived from FancyTextPro.com | — |
| `src/background/` | Context menu, keyboard commands, popup messages, apply/insert orchestration | Yes |
| `src/inject/page.ts` | Self-contained functions serialised into the page by `scripting.executeScript` | Runs in the page |
| `src/popup/` | Toolbar UI (`sections.ts` = pure list logic, `popup.ts` = DOM) | Yes |
| `src/options/`, `src/welcome/` | Settings page and one-time welcome page | Yes |
| `src/shared/` | `browser.ts` shim, `state.ts` storage, `menu-ids.ts`, `links.ts` (UTM), `i18n.ts`, CSS tokens | Yes |

## The text engine

Every style is a pure `transform(text) → text`. Most styles (135) come from a **declarative model** derived from the website:

```
output(line) = p + join(j, chars.map(c => w0 + (map[c] ?? c) + w1)) + x     (order reversed if rev)
```

- `map`: character → replacement (letters, digits, some punctuation). Anything unmapped passes through unchanged.
- `p` / `x`: decoration around each line (`ミ★ … ★彡`).
- `j`: joiner between characters (`a♥b♥c`).
- `w` (wrap-each): decoration on *every* character, including ones outside the captured alphabet. Used for strike-through, underline, boxes and Zalgo-like marks.
- `sp`: replacement for spaces (e.g. Blocky uses `◇`).
- `rev`: reversed reading order.

Text is split into **grapheme clusters** (`Intl.Segmenter`), so emoji ZWJ sequences, flags, skin tones and combining accents are never broken. The website splits emoji in 28 styles; we don't. Multi-line text is styled line by line. Blank lines, indentation and CRLF are preserved.

Six styles that the website generates in the browser (tiny caps, flip, bubbles, round squares, mirror, creepify) are implemented in `engine/native.ts`. Creepify uses a seeded PRNG, so the preview and the copied text are identical.

`unstyle()` reverses only **unambiguous** mappings: Math Alphanumerics, enclosed/squared letters, full-width, letter-like, super/subscripts, and decorative combining marks. Real-language text (Greek, Cyrillic, accented letters) is never touched. `applyStyle()` = `transform(unstyle(text))`, so restyling bold text as italic gives clean italics.

### Keeping in sync with FancyTextPro.com

```bash
npm run styles:capture   # ~75 polite requests to the site's public /generate endpoint
```

```bash
npm run styles:derive    # rebuild src/engine/data/site-styles.json + tests/fixtures/site-golden.json
```

The derive step checks every model against all captured probes (sentences, punctuation, accents, emoji). Styles that don't reproduce the website exactly, or that are randomised, are left out and listed in `scripts/sync-styles/.cache/report.json`. Website categories made only of random styles (Cute, Crazy, Full Crazy, Random, Halloween, Christmas) are **linked to, not bundled**.

## Applying a style in a page

1. A user action (menu click, shortcut, or popup "insert") grants `activeTab` for that tab.
2. `readSelection()` runs in the page. It returns the selected text, whether it's editable, and the field kind. Password fields are never read.
3. The background computes `applyStyle(style, text)`.
4. If editable (and the setting is "replace"), `replaceSelection(out, expected)` runs:
   - `document.execCommand('insertText')` first. It goes through the browser's editing pipeline, so frameworks see real input events and <kbd>Ctrl</kbd>+<kbd>Z</kbd> works.
   - For inputs, it falls back to `setRangeText` + an `input` event.
   - For rich editors, it checks the DOM actually changed (80 ms later, for async editors). If not, it reports failure.
   - If the selection changed since step 2 (`stale`), it refuses rather than overwrite the wrong text.
5. Otherwise, or on failure, `copyText()` runs: async Clipboard API, then an `execCommand('copy')` fallback that restores focus and selection, then a small Shadow-DOM notice.
6. On pages that can't be scripted (browser settings, stores), the text is handed to the popup.

There are **no persistent content scripts** and no host permissions. Each injected function is self-contained, because it's serialised with `Function#toString`.

## Cross-browser strategy

| Concern | Chrome | Firefox |
|---|---|---|
| Background | `service_worker` | event page (`background.scripts`) |
| Menu API | `contextMenus` | `menus` (adds `onShown`/`refresh` → live preview) |
| Manifest extras | `minimum_chrome_version: 121` | `gecko.id`, `strict_min_version: 140`, `data_collection_permissions: none` |

`scripts/build.mjs` writes one manifest per browser from `src/manifest.json`. `shared/browser.ts` picks `browser` or `chrome`. Both expose promise-based MV3 APIs, so no polyfill is needed.

## State

| Key | Area | Shape |
|---|---|---|
| `favorites` | `storage.sync` | `string[]` style ids (≤ 50) |
| `settings` | `storage.sync` | `{ theme, menuAction, menuShowRecent }` (validated on read) |
| `recent` | `storage.local` | `string[]` style ids (≤ 8) |
| `pendingText` | `storage.session` + background memory | text for "More styles…" |

Changes to favorites, recent styles or settings rebuild the context menu. Rebuilds are serialised, so overlapping events can't interleave.

## Build and budgets

esbuild bundles each entry point (IIFE, UTF-8 output) into `dist/<browser>/`. Budgets are enforced in CI:
- ≤ 150 KB zipped (currently ~53 KB)
- ≤ 80 KB per JS file
- the permission set may not change without updating this guard and `PRIVACY.md`

`--e2e` builds a separate test variant (`dist/chrome-e2e`) with `<all_urls>` and a test hook. It's never packaged.

## Security notes

- MV3 default CSP. No `eval`, no remote code, no `innerHTML` with dynamic content. Popup rows are cloned from a `<template>` and filled with `textContent`.
- Messages are accepted only from the extension's own pages (`sender.id` matches and there's no `sender.tab`).
- The in-page notice uses a closed Shadow DOM and only `textContent`.
- User text never goes into URL query strings. It's passed only in the fragment, and only when the user clicks a link.
