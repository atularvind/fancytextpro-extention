# Testing

Status as of **2026-11-18, v2.0.0**. ✅ automated and passing · 📝 manual checklist, not yet run · ⏳ planned.

## Automated

| Suite | Command | Count | What it proves |
|---|---|---|---|
| Engine | `npm test` | 173 | Catalogue integrity; **website parity** (each of 135 styles matches FancyTextPro.com for 5 probes); emoji ZWJ/flags/skin tones; combining marks; Hindi/Arabic/Hebrew/CJK pass-through; empty input; multi-line/CRLF; 10k-character performance; `unstyle` round-trips; restyle without mixing |
| Logic | `npm test` | 19 | Favorites/recent caps and ordering; 1.x → 2.x upgrade rules; context-menu list; settings validation; UTM links; user text never in the query string; popup search and sections |
| Injected functions (jsdom) | `npm test` | 12 | Selection reading (password fields never read); replace in input/textarea at selection or caret; stale-selection guard; read-only refusal; rich-editor failure detection; clipboard fallback restores focus and selection; single toast |
| End-to-end (real Chromium + the built extension) | `npm run test:e2e` | 24 | Welcome page on install; 1.x storage cleanup on upgrade; minimal permissions; **replace in textarea + Ctrl+Z undo**; `input` events for controlled inputs; contenteditable; copy + notice for non-editable text; **fallback to copy when an editor reverts the edit**; "always copy" setting; restyle and plain; recent recorded; popup→page insert and stale guard; menu build; popup previews, search, chips, keyboard, favorites persistence, remove styling, UTM links, no console errors, time to interactive; options saved |
| Accessibility | `npm run test:e2e` | 6 | axe-core WCAG 2.2 A/AA: popup, options and welcome pages, light and dark |
| Firefox lint | `npm run lint:firefox` | — | 0 errors, 0 warnings, 0 notices with `web-ext lint` (the AMO validator) |
| Size | `npm run size` | — | ~53 KB zipped per browser (budget 150 KB) |
| Permissions guard | CI | — | Fails if permissions, host permissions or content scripts change |

**Performance (measured in headless Chromium):**
- The popup script's own work, from start to first render with 141 live previews, takes about 18 ms.
- A warm popup open takes 43–58 ms, measured from navigation.
- The first cold open takes about 120–220 ms. That includes page load and waking the background.
- The CI guard is < 500 ms.

## Not automated (yet)

| Area | Why | Plan |
|---|---|---|
| **Firefox end-to-end** | Playwright can't load extensions in Firefox | 📝 Manual checklist below. ⏳ Investigate `web-ext run` + WebDriver BiDi |
| The native right-click menu itself | Browsers don't let tests click native menus | Covered by calling the same background function. Menu *building* is tested. |
| Real third-party editors | Needs live sites and accounts | 📝 Manual matrix below, before each store release |
| Screen readers | Needs a human | 📝 VoiceOver (macOS) and NVDA (Windows) spot checks |
| Memory | Background is event-driven with no persistent state | 📝 Check `chrome://extensions` → service worker → inactive after ~30 s |

## Manual release checklist 📝

Run on **Chrome (stable)** and **Firefox (release)** with `npm run build` and load the unpacked build.

**Core**
- [ ] Install shows the welcome page once. Selecting its demo text and right-clicking shows the FancyTextPro menu.
- [ ] Firefox: the menu shows the selected text previewed in each style.
- [ ] Popup opens with `Alt+Shift+F` (macOS: `Ctrl+Shift+F`), pre-filled with the page selection.
- [ ] `Alt+Shift+L` re-applies the last style to a selection.
- [ ] "More styles…" opens the popup with the selection.
- [ ] Settings → "Always copy" stops in-place replacement.
- [ ] Dark mode follows the OS. The theme override works.

**Site matrix**: select a word in each field, then right-click → Bold. Then undo with Ctrl/⌘+Z.

| Site / editor | Field | Chrome | Firefox | Expected |
|---|---|---|---|---|
| X / Twitter | Post composer (Draft.js) | 📝 | 📝 | replaced |
| LinkedIn | Post composer, About section | 📝 | 📝 | replaced |
| Facebook | Post composer (Lexical) | 📝 | 📝 | replaced |
| Instagram web | Bio, caption | 📝 | 📝 | replaced |
| Discord web | Message box (Slate) | 📝 | 📝 | replaced or copy fallback |
| Slack web | Message box (Quill) | 📝 | 📝 | replaced or copy fallback |
| WhatsApp Web | Message box (Lexical) | 📝 | 📝 | replaced |
| Gmail | Compose body, subject | 📝 | 📝 | replaced |
| Google Docs | Document | 📝 | 📝 | **copy fallback** (canvas rendering) |
| Reddit | Comment box | 📝 | 📝 | replaced |
| YouTube | Comment box | 📝 | 📝 | replaced |
| Notion | Page text | 📝 | 📝 | replaced or copy fallback |
| Any page | Non-editable paragraph | 📝 | 📝 | copied + notice |
| `chrome://` / `about:` / store pages | — | 📝 | 📝 | popup opens with the text (or nothing, on Firefox) |

**Known limitations**
- Cross-origin iframes (some embedded editors) aren't covered by `activeTab`. Selections there fall back to copy, using the browser-reported selection text.
- On Firefox restricted pages (`about:`, addons.mozilla.org), the copy fallback may not run, because the user-action window has passed.
- Unicode-styled text isn't searchable on most platforms, and screen readers may read it letter by letter. The popup shows a tip about this.
