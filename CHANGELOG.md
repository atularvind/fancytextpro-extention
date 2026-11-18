# Changelog

All notable changes to this project are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [2.0.0] - 2026-11-18

A complete rewrite and the first open-source release. It replaces the earlier 1.x extension that was published on the Chrome Web Store, and is built from scratch for Manifest V3 on Chrome and Firefox.

### Changed
- New codebase, UI and permission model. Existing 1.x users get this as an update to the same store item. On that upgrade, the welcome page opens once to introduce the right-click menu. Later updates never open tabs.

### Added
- **Right-click menu** on selected text, showing favorites, then recent styles, then popular defaults. Editable text is replaced in place, with native undo. Anything else is copied, with a small on-page notice.
- **Live selection preview** inside the right-click menu on Firefox.
- **Toolbar popup** with live previews of 141 styles in 15 categories, search, category chips, favorites, recently used styles, light/dark themes, and full keyboard control.
- **Insert from the popup** into the focused field of the current page.
- **Remove styling**: converts styled Unicode back to plain text. It also allows restyling, e.g. bold → italic, without mixing.
- **Keyboard shortcuts**: open the popup (`Alt+Shift+F`) and re-apply the last style (`Alt+Shift+L`). On macOS they use `Ctrl`.
- **Style catalogue generated from FancyTextPro.com**: 135 styles verified character-for-character against the website, plus 6 Lunicode-style transforms implemented natively.
- **Settings page** with theme, menu behaviour (replace or always copy), recent styles in the menu, and clearing data.
- One-time **welcome page** on install.
- **Links to FancyTextPro.com** for more styles, Big Text, Lenny faces and the text decorator, tagged with UTM parameters.

### Fixed (compared with the website)
- Emoji are kept whole in strike-through, underline, box and joiner styles. The website splits them into broken characters.

### Privacy & security
- Minimal permissions: `contextMenus`/`menus`, `storage`, `activeTab`, `scripting`. No host permissions and no install warnings.
- No network requests, analytics or remote code. Firefox `data_collection_permissions: none`.

[Unreleased]: https://github.com/atularvind/fancytextpro-extention/compare/v2.0.0...HEAD
[2.0.0]: https://github.com/atularvind/fancytextpro-extention/releases/tag/v2.0.0

_1.x: earlier closed-source release on the Chrome Web Store (not in this repository)._
