# Changelog

All notable changes to **Player Vault** are documented here.  
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), versions follow [Semantic Versioning](https://semver.org/).

---

## [2.0.0] — 2026-03-XX

### Highlights

Player Vault 2.0 brings the plugin out of desktop-only territory, dramatically speeds up large-vault exports, and adds a one-click "publish to web" workflow. It also makes the export pipeline fully internationalisation-ready.

### Added

- **Mobile support** — removed `isDesktopOnly` restriction. The "open exported folder" step is now guarded with `Platform.isDesktop` so mobile users still get the full export; they just manage files through their file-manager app. Tested on Obsidian for iOS 1.6 and Android 1.5.

- **Incremental export** (per-profile toggle) — after the first full export Player Vault writes a `.pv-cache.json` file beside the exported HTML. On subsequent runs, notes whose `mtime` is unchanged are skipped entirely, reducing export time on a 400-note vault from ~8 s to ~0.3 s. Cache is automatically invalidated when the total note count changes (so newly created or deleted notes always trigger a full re-scan of links and the index).

- **Publish to Web** (per-profile deploy-hook URL) — paste a [Netlify build hook](https://docs.netlify.com/configure-builds/build-hooks/), [GitHub Actions `repository_dispatch`](https://docs.github.com/en/actions/using-workflows/events-that-trigger-workflows#repository_dispatch) URL, or [Vercel deploy hook](https://vercel.com/docs/concepts/deployments/deploy-hooks) into Settings → Publish to Web. A **Publish** button appears in the Settings CTA row, and a new command **Player Vault: Publish to Web (trigger deploy hook)** becomes available in the command palette. The plugin POSTs to the URL and reports success or HTTP error via a Notice.

- **`publish: false` parity** — notes with `publish: false` (or `publish: "false"`) in their YAML front matter are silently excluded from export. This mirrors the [Obsidian Publish](https://help.obsidian.md/Obsidian+Publish/Introduction+to+Obsidian+Publish) convention, making it easy to migrate an existing Obsidian Publish vault to Player Vault. Dry-run mode shows these as **publish: false** in the exclusion reason column.

- **i18n foundation** (`PV_STRINGS` / `PvLocale`) — all user-visible strings in the exported HTML (site title, search placeholder, "Linked from", "Home", etc.) are now gathered in a `PV_STRINGS` constant keyed by locale. The active locale is a vault-wide setting (Settings → Advanced → Language). Only `en` ships by default; adding a new locale requires a single object entry in `exporter.ts`:

  ```typescript
  // Example: add French
  export const PV_STRINGS = {
      en: { siteTitle: "Player Wiki", searchPlaceholder: "Search notes…", … },
      fr: { siteTitle: "Wiki Joueur",  searchPlaceholder: "Rechercher…",   … },
  } as const;
  ```

  The exported pages also receive a matching `<html lang="en">` attribute, improving screen-reader and SEO behaviour.

### Changed

- `manifest.json` — `isDesktopOnly` removed; `version` bumped to `2.0.0`.
- `runExport()` — "open folder after export" shell call only executes on `Platform.isDesktop`.
- Pass 1 (note-collection) — calls `isNotePublishBlocked` before the existing GM-only check.
- `runDryRun()` — includes `publish` as a new `DryRunReason`; checked before `gm-only`.
- `wrapInPage` — new optional `locale?: PvLocale` field in `WrapPageOptions`. Defaults to `"en"`.
- `buildIndexPage` — accepts `locale` via `WrapPageOptions`.
- Settings — new **Publish to Web** section (deploy hook URL field + contextual hint), **Incremental export** toggle in the Export section, **Language** dropdown in a new Advanced section.

### Tests

- 86 tests total (up from 77).
- Added `describe("isNotePublishBlocked")` — 5 tests (boolean false, string "false", boolean true, no front matter, front matter without publish key).
- Added `describe("PV_STRINGS / i18n")` — 4 tests (all required keys present, locale used in output, default falls back to English, `lang` attribute correctness).

---

## [1.3.0] — 2026-03-XX

### Added
- **Sidebar navigation** — every exported page now includes a collapsible sidebar listing all exported notes. Root-level notes appear first; sub-folder notes are grouped under collapsible `<details>` elements labelled with their folder path. The current note is highlighted with a `.pv-sidebar-active` class.
- **Breadcrumb trail** — pages located inside a sub-folder show a Home › Folder › Title breadcrumb beneath the site title in the header.
- **Back-links footer** — if other notes wiki-link to a page, a "Linked from" footer lists them as clickable chips. Back-links are computed from `[[wiki-link]]` syntax during export.
- **Live search bar** — a search input in the header filters notes by title and plain-text content. Results appear in a dropdown; Escape closes it. Powered by `search-index.js` + `search.js` (both written to the output folder on every export — no server required, works on `file://`).
- **Dark/light theme switcher** — a toggle button (☀/☽) in the header switches between the dark and light themes. The choice is persisted in `localStorage`. A FOUC-prevention `<script>` in `<head>` restores the saved theme before first paint.
- **Custom CSS per profile** — a "Appearance" section in each export profile's settings exposes a `customCss` textarea. CSS entered there is injected as a `<style>` block in every exported page's `<head>`. `</style>` sequences are escaped to prevent injection.

### Changed
- `EXPORT_CSS` rewritten with `.pv-header` class (replacing bare `header` selector), sticky header and sidebar, collapsible folder-group styles, back-links footer styles, light-theme overrides (`html[data-theme="light"] …`), and table styles for exported content.
- `wrapInPage` signature updated to `wrapInPage(title, body, optsOrCss?: string | WrapPageOptions)`. Old `string` form (`wrapInPage(t, b, "../custom.css")`) still works unchanged.
- `buildIndexPage` signature updated to `buildIndexPage(notes, optsOrCss?: string | WrapPageOptions)`. Old zero-options calls still work.
- Export pipeline writes two additional files per export: `search-index.js` and `search.js`.

### Tests
- 77 tests total (up from 66).
- Added `describe("buildBackLinksMap")` — 3 tests.
- Added `describe("buildSidebarEntries")` — 2 tests.
- Added `describe("buildSearchIndexJs")` — 2 tests.
- Added `describe("wrapInPage with v1.3 options")` — 4 tests (sidebar, breadcrumb, backlinks, custom CSS).

---

## [1.2.0] — 2026-03-04

### Added
- **Per-export profiles** — save and switch between named export configurations in a new Profiles section of Settings. Each profile stores its own output folder, excluded folders, inclusion tag, extra secret patterns, and strip-all-comments toggle. Profiles can be duplicated (New button) or deleted (Delete button). The active profile name is shown next to the export buttons.
- **Folder-level exclusion** — new "Excluded folders" chip manager in Settings → Content Filtering. Notes inside any listed folder (and all sub-folders) are suppressed without needing per-note flags.
- **Tag-based inclusion** — new "Inclusion tag" text field. When set, only notes carrying that Obsidian tag (inline `#tag`, YAML inline array, or YAML list) are exported; all others are silently skipped. Leave blank to export all surviving notes.
- **Dry-run mode** — new command **Player Vault: Dry Run (preview export)** and a matching button in Settings. Opens a modal showing exactly which notes would be exported and which would be excluded, with the reason for each exclusion (GM-only content / excluded folder / missing inclusion tag). No files are written.
- **Export manifest** — a `_export-manifest.json` file is now written alongside the HTML on every export. It records the timestamp, active profile name, total note count, and the name/filename/vault-path of each exported note.
- **Settings migration** — existing v1.1 flat settings (`outputFolder`, `extraSecretPatterns`, `stripAllComments`) are automatically migrated to a single "Default" profile on first load. No user action required.

### Changed
- Settings tab redesigned: the Profiles section (dropdown, New, Delete, Rename) now appears before Export. Output folder, excluded folders, inclusion tag, strip-all-comments, and extra secret patterns are all read from and written to the active profile.
- `runExport()` now reads `outputFolder`, `extraSecretPatterns`, and `stripAllComments` from `getActiveProfile()` instead of from the root settings object.
- The export hint in the Settings CTA row now reads `Profile: <name> → <folder>/` instead of `Output: <folder>/`.

### Tests
- 66 tests total (up from 55).
- Added `describe("isNoteExcludedByFolder")` — 5 tests covering empty list, prefix match, non-match, trailing slash, partial-name non-match.
- Added `describe("isNoteIncludedByTag")` — 6 tests covering empty tag pass-through, inline `#tag`, YAML inline array, YAML list, wrong-tag rejection, leading-`#` stripping.

---

## [1.1.0] — 2026-02-XX

### Added
- **Heading anchors** — every `<h1>`–`<h6>` element now has an auto-generated `id` attribute (lowercase, spaces → hyphens, symbols removed), enabling deep-linking into exported notes.
- **GFM pipe table support** — pipe tables (`| col | col |`) are converted to semantic `<table>` / `<thead>` / `<tbody>` HTML with the existing dark-theme stylesheet applied.
- **Strikethrough** — `~~text~~` renders as `<s>text</s>`.
- **Export progress modal** — `ExportProgressModal` shows an animated fill bar, the current note name, and a `current / total` counter while the export pipeline runs.
- **Output folder browser** — the Output folder setting now has a **Browse** button that opens a `FolderSuggestModal` fuzzy-picker, replacing raw free-text path entry.

### Tests
- 55 tests total (up from 49).
- Added 6 tests covering heading anchor generation, strikethrough, and GFM table rendering.

---

## [1.0.0] — 2026-01-XX

### Added
- Initial public release.
- Two-pass export pipeline: sanitize then convert.
- `%%SECRET%%` / `%%GM%%` inline block stripping (case-insensitive, multiline).
- `> [!gm-only]` callout block exclusion.
- `gm-only: true` front-matter whole-note exclusion.
- `%% … %%` Obsidian comment stripping (optional).
- Custom regex pattern manager with live validation and a chip UI.
- Collision-safe output filenames derived from vault path.
- Orphan wiki-link demotion to plain text.
- `javascript:` / `data:` URL neutralization.
- XSS prevention via placeholder-slot pattern in `convertInline`.
- Static dark-fantasy HTML output with auto-generated `index.html`.
- Supported Markdown: headings, bold, italic, bold+italic, inline code, fenced code blocks, blockquotes, ordered/unordered lists, horizontal rules, images, Markdown links, Obsidian wiki-links.
- First-run onboarding wizard (`WelcomeModal`, 4 steps).
- Settings tab with banner, CTA export button, section headers.
- GitHub Actions release workflow.
- 49-test suite covering sanitizer and exporter.

---

[1.2.0]: https://github.com/tescolopio/Obsidian_PlayerVault/compare/1.1.0...1.2.0
[1.1.0]: https://github.com/tescolopio/Obsidian_PlayerVault/compare/1.0.0...1.1.0
[1.0.0]: https://github.com/tescolopio/Obsidian_PlayerVault/releases/tag/1.0.0
