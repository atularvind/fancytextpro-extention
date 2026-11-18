# FancyTextPro Extension: Privacy Policy

_Last updated: 2026-11-18 · Applies to the FancyTextPro browser extension for Chrome and Firefox, version 2.0.0 and later._

## Summary

**The FancyTextPro extension does not collect, transmit, sell or share any personal data.** All text conversion happens locally in your browser.

## What the extension processes, and where

| Data | When | Where it goes |
|---|---|---|
| Text you type or paste into the popup | While the popup is open | Stays in the popup. It's converted in memory and discarded when the popup closes. |
| Text you select on a web page | Only when you click a FancyTextPro menu item, press its shortcut, or open the popup | Read from that tab, converted in your browser, then written back into the field or copied to your clipboard. It isn't stored or sent anywhere. |
| Favorite styles and settings | When you change them | `storage.sync`, your browser's own storage. If you've turned on browser sync, Google or Mozilla sync it as part of your browser profile. It contains style names only, never your text. |
| Recently used styles | When you use a style | `storage.local`, on your device only. Style names only. |
| Text passed from "More styles…" to the popup | When you choose "More styles…" | Session memory (`storage.session`). Cleared when the popup reads it, or when the browser closes. |

## What the extension does **not** do

- No network requests of its own. No analytics, telemetry, crash reporting, ads or tracking.
- No remote code. Everything the extension runs ships inside the package and is reviewed by the browser stores.
- No access to pages you don't use it on. It has no "all websites" permission and no content scripts that run automatically. It can see a tab only through `activeTab`, which the browser grants for that one tab, and only after you use FancyTextPro there.
- It never reads password fields.

## Links to FancyTextPro.com

The popup, settings and welcome pages link to FancyTextPro.com (for example "More Elegant styles on FancyTextPro.com"). These links:
- open only when **you** click them
- carry `utm_source=extension` tags, so the website can count visits that came from the extension

If text is in the popup when you click a "more styles" link, it's passed in the URL fragment (`#text=…`). Browsers don't send the fragment to the server, and analytics don't record it by default. Once you're on FancyTextPro.com, [its own privacy policy](https://www.fancytextpro.com/privacy-policy) applies.

## Permissions

| Permission | Purpose |
|---|---|
| `contextMenus` / `menus` | Adds the FancyTextPro item to the right-click menu |
| `storage` | Saves favorites, recent styles and settings |
| `activeTab` | Temporary access to the current tab, after you use a FancyTextPro action there |
| `scripting` | Runs the one-off "read selection / replace selection / copy" step in that tab |

Firefox users will see "This extension does not collect any data" on install. The extension declares `data_collection_permissions: none`.

## Children

The extension collects no data from anyone, including children.

## Changes

Any change to this policy will be listed in [CHANGELOG.md](CHANGELOG.md) and will update the date above. If a future version ever needs a new permission or any data collection, the browser will ask you first. That version would also make clear what's collected and why, and make it optional.

## Contact

Open an issue at https://github.com/atularvind/fancytextpro-extention/issues or use https://www.fancytextpro.com/contact.
