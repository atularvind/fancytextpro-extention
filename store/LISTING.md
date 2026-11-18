# Store listing copy: FancyTextPro 2.0.0

Paste-ready text for the Chrome Web Store (item `mokackbjpknbmpebgkieaoapkioeoehf`) and addons.mozilla.org. Assets are in this folder.

## Name
FancyTextPro

## Short description (≤ 132 chars; also `extDescription` in `_locales`)
Fancy text anywhere you type. Right-click selected text to restyle it in 140+ fonts like 𝐛𝐨𝐥𝐝 and ⓑⓤⓑⓑⓛⓔ. Private & offline.

## Detailed description

FancyTextPro brings the styles of FancyTextPro.com to every text box on the web: social posts, bios, chats, comments and email.

★ RIGHT-CLICK TO RESTYLE
Select text, right-click → FancyTextPro, and pick a style. Editable text is replaced right where it is, and Ctrl+Z undoes it. Anything else is copied, ready to paste.

★ 141 STYLES WITH LIVE PREVIEW
𝐁𝐨𝐥𝐝, 𝘐𝘵𝘢𝘭𝘪𝘤, 𝓒𝓾𝓻𝓼𝓲𝓿𝓮, 𝔊𝔬𝔱𝔥𝔦𝔠, 𝔻𝕠𝕦𝕓𝕝𝕖, ⓑⓤⓑⓑⓛⓔ, ᴛɪɴʏ ᴄᴀᴘs, ʇxǝʇ dılɟ, s̶t̶r̶i̶k̶e̶, decorated ꧁༺ styles ༻꧂ and more. Search them or browse by category in the popup.

★ FAVORITES & RECENT
Star the styles you use most. They appear first in the popup and in the right-click menu.

★ KEYBOARD FRIENDLY
Alt+Shift+F opens the popup. Alt+Shift+L re-applies your last style. Arrow keys, Enter and / work inside the popup.

★ REMOVE STYLING
Turn 𝐬𝐭𝐲𝐥𝐞𝐝 text back into plain text in one click.

★ PRIVATE BY DESIGN
Everything happens on your device. No tracking, no analytics, no account, and no access to websites until you use it there.

Need more? Big text art, Lenny faces ( ͡° ͜ʖ ͡°) and hundreds more styles are free at https://www.fancytextpro.com

Open source (MIT): https://github.com/atularvind/fancytextpro-extention

## Category
- Chrome: Productivity → Communication (alternatively Tools)
- Firefox: Social & Communication; Language Tools

## Chrome "Privacy practices" tab

**Single purpose:** Convert text the user types or selects into decorative Unicode styles, and insert it into the page or copy it to the clipboard.

| Permission | Justification |
|---|---|
| `contextMenus` | Adds the "FancyTextPro" item to the right-click menu for selected text, so users can pick a style. |
| `storage` | Saves the user's favorite styles, recently used styles and settings locally (and through browser sync). No text content is stored. |
| `activeTab` | After the user clicks a FancyTextPro menu item, presses its shortcut or opens the popup, reads the selected text in that tab and writes the styled version back. No access otherwise. |
| `scripting` | Runs the one-off function that reads or replaces the selection in the active tab, only after a user action granted through activeTab. |

- **Remote code:** No, I am not using remote code.
- **Data usage:** none of the listed data types is collected.
- Certify: no selling of data; no use unrelated to the single purpose; no creditworthiness use.
- **Privacy policy URL:** https://github.com/atularvind/fancytextpro-extention/blob/main/PRIVACY.md

## Assets

| File | Use |
|---|---|
| `../src/icons/icon-128.png` | Store icon (128×128) |
| `screenshot-1-popup.png`, `screenshot-2-right-click.png`, `screenshot-3-private.png` | Screenshots (1280×800), both stores |
| `promo-small-440x280.png` | Chrome small promo tile (required) |
| `promo-marquee-1400x560.png` | Chrome marquee tile (optional) |

Regenerate with:

```bash
node scripts/build.mjs --e2e && node scripts/screenshots.mjs && node scripts/store-assets.mjs
```

## AMO reviewer notes
Bundled with esbuild (TypeScript → minified IIFE). Source archive attached. To rebuild: Node 20+, `npm ci && npm run build`. The output is in `dist/firefox`. No remote code, no network requests. Permissions are explained above.
