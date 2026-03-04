# Player Vault — Development Roadmap

This document tracks planned features, active work, and completed milestones.  
Items within each phase are ordered by priority, not commitment order.

---

## Legend

| Symbol | Meaning |
|--------|---------|
| ✅ | Shipped |
| 🚧 | In progress |
| 🗓 | Planned — next phase |
| 💭 | Under consideration |
| ❌ | Declined / out of scope |

---

## v1.0 — Foundation ✅

Core pipeline and security baseline shipped in the initial public release.

- ✅ Two-pass export pipeline (sanitise → convert → write)
- ✅ `%%SECRET%%` / `%%GM%%` inline stripping
- ✅ `> [!gm-only]` callout block exclusion
- ✅ `gm-only: true` front-matter whole-note exclusion
- ✅ `%%OBSIDIAN_COMMENT%%` / `%% ... %%` comment stripping
- ✅ Custom regex pattern manager (live validation, chip UI)
- ✅ Collision-safe output filenames derived from vault path
- ✅ Orphan wiki-link demotion to plain text
- ✅ `javascript:` / `data:` URL neutralisation
- ✅ Static dark-theme HTML output with auto-generated index
- ✅ Horizontal rules, fenced code blocks, blockquotes, ordered/unordered lists, images
- ✅ First-run onboarding wizard (4-step WelcomeModal)
- ✅ Improved settings tab (banner, CTA button, section headers)
- ✅ GitHub Actions release workflow
- ✅ 49-test suite covering sanitiser and exporter

---

## v1.1 — Output Quality ✅

Focus: richer HTML output and better export ergonomics.

- ✅ **Heading anchors** — `<h2 id="...">` so notes can be deep-linked
- ✅ **Table support** — GFM pipe tables → `<table>` / `<thead>` / `<tbody>` with theme styling
- ✅ **Strikethrough** — `~~text~~` → `<s>text</s>`
- ✅ **55-test suite** — 6 new tests added covering anchors, strikethrough, and tables
- ✅ **Export progress bar** — `ExportProgressModal` shows note name, count, and animated fill bar during export
- ✅ **Output folder browser** — `FolderSuggestModal` fuzzy-picker on the Browse button replaces free-text path entry

---

## v1.2 — Selective Export ✅

Focus: give the GM precise control over what goes out.

- ✅ **Folder-level exclusion** — mark an entire folder as GM-only via a config entry
- ✅ **Tag-based inclusion** — only export notes carrying a specified Obsidian tag (e.g. `#player-facing`)
- ✅ **Dry-run mode** — show which notes will be exported/excluded before writing anything
- ✅ **Export manifest** — write a `_export-manifest.json` alongside HTML listing export metadata (timestamp, profile name, note count)
- ✅ **Per-export profiles** — save and switch between named export configurations (e.g. "Campaign A players", "Session 0 intro")

---

## v1.3 — Navigation & UX ✅

Focus: make the generated wiki easier to navigate.

- ✅ **Sidebar navigation** — collapsible sidebar listing all exported notes, grouped by folder
- ✅ **Search bar** — client-side full-text search across all exported notes (no server required)
- ✅ **Breadcrumb trail** — top-of-page path derived from vault folder structure
- ✅ **Back-links section** — "Notes that link here" footer on each page
- ✅ **Theme switcher** — light / dark toggle embedded in the exported HTML
- ✅ **Custom CSS injection** — let the user supply extra CSS that is appended to every exported page

---

## v2.0 — Platform & Integration 💭

Under consideration — requires significant design work or Obsidian API changes.

- 💭 **Mobile support** — remove `isDesktopOnly` restriction; replace `FileSystemAdapter` path with a cross-platform abstraction
- 💭 **Publish to web** — optional one-click upload to a static host (GitHub Pages, Netlify drop)
- 💭 **Incremental export** — only re-export notes modified since the last export run
- 💭 **Obsidian Publish parity** — honour Obsidian Publish's `publish: false` front-matter flag
- 💭 **Localisation** — i18n support for the plugin UI and exported HTML chrome

---

## Declined / Out of Scope ❌

- ❌ **Server-side rendering** — the output must remain fully static; no Node/Python server bundled
- ❌ **PDF export** — out of scope; Obsidian's built-in PDF export covers this
- ❌ **Real-time sync** — the folder-watch approach creates privacy risks for GM content; not planned
- ❌ **Editing the exported HTML** — the exported wiki is read-only by design

---

## How to Influence the Roadmap

Open a [GitHub issue](https://github.com/tescolopio/Obsidian_PlayerVault/issues) with the label `enhancement`.  
Upvote existing issues with a 👍 reaction — high-reaction items move up in priority.
