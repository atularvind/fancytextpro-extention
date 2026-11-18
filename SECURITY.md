# Security Policy

## Supported versions

| Version | Supported |
|---|---|
| 2.x | ✅ |
| 1.x (earlier closed-source release) | ❌ Please update to 2.x |

## Reporting a vulnerability

Please **don't open a public issue.** Report privately through GitHub's [private vulnerability reporting](https://github.com/atularvind/fancytextpro-extention/security/advisories/new) or via https://www.fancytextpro.com/contact.

Please include the affected version, the browser, steps to reproduce, and the impact. You can expect an acknowledgement within 7 days. Confirmed issues are fixed in a patch release and credited in the changelog, unless you'd prefer not to be named.

## Security model (summary)

- No host permissions, no persistent content scripts, no remote code, no network requests.
- Page access only through `activeTab`, after an explicit user action. Password fields are never read.
- Only messages from the extension's own pages are accepted, and they are validated.
- CI fails if the permission set changes.

Details: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md#security-notes).
