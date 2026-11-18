# Releasing

## Versioning

- [Semantic Versioning](https://semver.org/): **major** for a new permission or a breaking UX change, **minor** for features or new styles, **patch** for fixes.
- `package.json` `version` is the single source of truth. The build writes it into both manifests, and the release workflow refuses a tag that doesn't match.
- 2.0.0 follows the 1.x line that was published on the Chrome Web Store before this rewrite. The Chrome Web Store rejects an upload whose version isn't **higher than the last uploaded one**. Before uploading, check the dashboard's last version. If it's 2.0.0 or higher, bump to the next major.
- Keep style **ids** stable across versions: users' favorites reference them.

## 1. Prepare

1. Update `version` in `package.json`. The build copies it into both manifests.
2. Move **Unreleased** entries in `CHANGELOG.md` under the new version heading, with today's date.
3. Run the full suite and the manual checklist in [docs/TESTING.md](docs/TESTING.md):

```bash
npm run check
```

```bash
npm run test:e2e
```

4. Refresh screenshots and store assets if the UI changed:

```bash
npm run store:assets
```

## 2. Tag

Commit, then push a tag that matches the version (e.g. `v2.0.0`). The **Release** workflow:
- checks that the tag matches `package.json`
- runs all checks and e2e tests
- builds the packages
- creates a GitHub Release with:
  - `fancytextpro-chrome-<v>.zip`
  - `fancytextpro-firefox-<v>.zip`
  - `fancytextpro-source-<v>.zip`

To package locally instead, run `npm run build && npm run package`. The zips land in `web-ext-artifacts/`.

## 3. Chrome Web Store

The extension already has a store item: **`mokackbjpknbmpebgkieaoapkioeoehf`** ("FancyTextPro"). As of 2026-11-18 it is taken down. Publish v2.0.0 as an **update to that item**, not as a new listing, so the name, ID and any reviews carry over.

- [ ] In the Developer Dashboard, find out why the item was taken down (policy email or the item's status page). Confirm that v2.0.0 resolves it. Typical causes include broad host permissions, undisclosed data collection, remote code, and misleading metadata. v2.0.0 has none of these.
- [ ] Upload `fancytextpro-chrome-<v>.zip`.
- [ ] **Privacy practices tab.** Single purpose: "Convert text into fancy Unicode styles and insert or copy it." Justify each permission (the table in `PRIVACY.md` can be pasted). Data usage: *does not collect user data*. Remote code: *no*.
- [ ] Privacy policy URL: the GitHub `PRIVACY.md`, or a page on fancytextpro.com.
- [ ] Listing text, permission justifications and assets: everything is in [`store/LISTING.md`](store/LISTING.md) and `store/*.png` (`npm run store:assets` regenerates them).
- [ ] Submit for review, or request reinstatement.

## 4. Firefox Add-ons (AMO)

- [ ] Upload `fancytextpro-firefox-<v>.zip`. The add-on ID is `extension@fancytextpro.com`. **Don't change it after the first submission.**
- [ ] The build is bundled and minified, so AMO requires the **source code**. Upload `fancytextpro-source-<v>.zip` with these reviewer instructions: "Node 20+, `npm ci && npm run build`; output in `dist/firefox`."
- [ ] Data collection: the manifest declares `none`. Make sure the listing says the same.
- [ ] Categories: *Social & Communication*, *Language Tools*. Homepage: https://www.fancytextpro.com. Support: GitHub issues.

## 5. After release

- [ ] Point FancyTextPro.com's "Get the extension" links at both store listings (a planned website change).
- [ ] Watch store reviews and GitHub issues for editor compatibility reports. Add any confirmed sites to the matrix in `docs/TESTING.md`.
