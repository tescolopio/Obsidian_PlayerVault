# Security Policy

## Supported Versions

Only the latest release receives security fixes.

| Version | Supported |
|---------|-----------|
| 1.x (latest) | ✅ |
| < 1.0 | ❌ |

---

## Reporting a Vulnerability

**Do not open a public GitHub issue for security vulnerabilities.**

Please report security issues by opening a [GitHub Security Advisory](https://github.com/tescolopio/Obsidian_PlayerVault/security/advisories/new) (private, visible only to maintainers).

Include:

- A description of the vulnerability and its potential impact
- Steps to reproduce or a proof-of-concept
- The version of Player Vault affected
- Any suggested remediation if you have one

You will receive an acknowledgement within **72 hours**. If you do not hear back, feel free to follow up in the advisory thread.

---

## Security Model

Player Vault converts Obsidian Markdown notes into static HTML files. Its threat model has two primary surfaces:

### 1. Note content as untrusted input

Vault notes may contain arbitrary text, including HTML tags, JavaScript URIs, or crafted Markdown patterns. Player Vault treats all note content as untrusted:

- **HTML escaping** — all raw note text is run through `escapeHtml()` before any HTML is emitted. Structured Markdown (links, bold, code) is extracted to placeholder slots first, so capture groups in regex substitutions can never introduce unescaped content.
- **URL scheme allowlist** — only `http:`, `https:`, `mailto:`, and relative URLs are rendered as `<a>` tags. `javascript:`, `data:`, `vbscript:`, and all other schemes are rendered as escaped plain text.
- **Inline code isolation** — content inside backtick spans is escaped before being placed in `<code>` tags, preventing `<script>` injection via inline code.

### 2. File system access

- The output path is provided by the user in settings. Player Vault writes only to that nominated folder via the Obsidian `FileSystemAdapter` API.
- `openAfterExport` uses `instanceof FileSystemAdapter` before calling `adapter.getBasePath()`, and wraps the Electron shell call in a try/catch. The feature is skipped silently on mobile or in environments where Electron is unavailable.

### 3. Out of scope

Player Vault does **not**:

- Make network requests
- Execute note content
- Store secrets or credentials anywhere outside your local vault
- Transmit vault contents off-device

---

## Past Security Fixes

| Version | Issue | Fix |
|---------|-------|-----|
| 1.0.0 | XSS via raw HTML in note text emitted unescaped by `convertInline` | Placeholder-slot pattern; `escapeHtml()` on all raw text before substitution |
| 1.0.0 | `javascript:` and `data:` URIs rendered as clickable links | `isSafeUrl()` scheme allowlist |
| 1.0.0 | `survivingNotes` keyed by `file.basename` allowed path-collision overwrite | Re-keyed by `file.path`; `filePathToOutputName(path)` for collision-safe output filenames |
| 1.0.0 | `openAfterExport` called `(adapter as any).basePath` without guard | `instanceof FileSystemAdapter` check + `adapter.getBasePath()` + try/catch |
