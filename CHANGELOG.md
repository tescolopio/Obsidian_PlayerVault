# Changelog

All notable changes to **Player Vault** are documented here.  
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), versions follow [Semantic Versioning](https://semver.org/).

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
