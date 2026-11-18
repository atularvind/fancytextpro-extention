# Contributing to FancyTextPro

Thanks for helping! This project values **small, private and reliable** over feature count. Please open an issue to discuss larger features before starting work.

## Quick start

```bash
npm ci
```

```bash
npx playwright install chromium
```

```bash
npm run dev
```

Load `dist/chrome` (Chrome: `chrome://extensions` → Developer mode → Load unpacked) or `dist/firefox/manifest.json` (Firefox: `about:debugging` → Load Temporary Add-on). `npm run dev` rebuilds on save. Reload the extension to pick up background changes.

Before opening a pull request:

```bash
npm run check
```

```bash
npm run test:e2e
```

## Ground rules

- **No new permissions** without discussion. CI fails if `permissions`, `host_permissions` or `content_scripts` change. A change there also needs a `PRIVACY.md` update.
- **No network calls, analytics or remote code** in the extension.
- **No runtime dependencies.** Dev dependencies are fine if they earn their place.
- **No `innerHTML`** with dynamic content. Use `textContent` or `<template>`.
- **Injected functions** (`src/inject/page.ts`) must be fully self-contained: no imports, no module-scope references.
- **All UI strings** go in `src/_locales/en/messages.json`.
- Keep the popup accessible: everything reachable by keyboard, visible focus, contrast ≥ 4.5:1. The axe tests must pass in light and dark.

## Adding or updating styles

Most styles come from FancyTextPro.com, so the extension stays consistent with the site:

```bash
npm run styles:capture
```

```bash
npm run styles:derive
```

```bash
npm test
```

To add a style that isn't on the website, add it to `src/engine/native.ts` with unit tests in `tests/unit/engine.test.ts`. Prefer the declarative `mapFrom` + `renderModel` helpers. Never reorder or rename existing style **ids**: users' favorites reference them.

## Translations

Copy `src/_locales/en/messages.json` to `src/_locales/<locale>/messages.json` and translate the `message` values. Leave `$1` placeholders and the product name as-is. The store description (`extDescription`) must stay ≤ 132 characters.

## Commit and PR style

- One logical change per PR, with tests.
- Add user-visible changes to `CHANGELOG.md` under **Unreleased**.
- Describe how you tested, especially for the manual site matrix in [docs/TESTING.md](docs/TESTING.md).

## Reporting security issues

Please don't open a public issue for vulnerabilities. Use GitHub's private vulnerability reporting on this repository, or https://www.fancytextpro.com/contact.

## Code of conduct

Be kind, assume good intent, and keep discussions about the work.
