# Player Vault

> **An Obsidian plugin for GMs who share world-lore with players.**
>
> Player Vault sanitizes your vault — stripping GM-only secrets, hidden callouts, and orphan links — then compiles every surviving note into a self-contained, dark-themed static HTML wiki you can hand off to your players.  
> **Works on desktop and mobile. New in v2.0: incremental export, one-click deploy hooks, and Obsidian Publish parity.**

---

## Table of Contents

- [Features](#features)
- [How It Works](#how-it-works)
- [Installation](#installation)
  - [Community Plugin (Recommended)](#community-plugin-recommended)
  - [Manual Installation](#manual-installation)
  - [BRAT (Beta)](#brat-beta)
- [Usage](#usage)
- [Marking Content as GM-Only](#marking-content-as-gm-only)
  - [Inline Tags](#inline-tags)
  - [Callout Blocks](#callout-blocks)
  - [Front-Matter Flag (Whole Note)](#front-matter-flag-whole-note)
  - [Obsidian Comments](#obsidian-comments)
  - [Custom Patterns](#custom-patterns)
- [Export Profiles](#export-profiles)
- [Selective Export](#selective-export)
  - [Folder Exclusion](#folder-exclusion)
  - [Tag-Based Inclusion](#tag-based-inclusion)
  - [Dry Run](#dry-run)
- [Settings](#settings)
- [Export Output](#export-output)
- [Security](#security)
- [Compatibility](#compatibility)
- [Development](#development)
- [Contributing](#contributing)
- [Changelog](#changelog)
- [License](#license)

---

## Features

| Feature | Details |
|---|---|
| **Secret stripping** | Removes `%%SECRET%% … %%SECRET%%`, `%%GM%% … %%GM%%`, and `> [!gm-only]` callout blocks automatically |
| **Whole-note exclusion** | Notes with `gm-only: true` in front-matter are omitted entirely |
| **`publish: false` parity** | Notes with `publish: false` in YAML front-matter are excluded — same syntax as Obsidian Publish, so migrating is instant |
| **Custom patterns** | Supply extra regex patterns to strip additional private content |
| **Folder exclusion** | Designate entire vault folders as GM-only — every note inside is excluded without individual flagging |
| **Tag-based inclusion** | Optionally restrict the export to only notes carrying a specific Obsidian tag (e.g. `#player-facing`) |
| **Export profiles** | Save and switch between named export configurations — separate profiles for different campaigns or audiences |
| **Dry-run preview** | See exactly which notes will be exported and which will be excluded (and why) before writing a single file |
| **Export manifest** | A `_export-manifest.json` is written alongside the HTML documenting the timestamp, profile, and every exported note |
| **Incremental export** | A `.pv-cache.json` mtime cache skips unchanged notes — exports a 400-note vault in ~0.3 s after the first run |
| **Publish to Web** | Paste a Netlify / GitHub Actions / Vercel deploy-hook URL; click **Publish** or run the command to trigger a deploy |
| **Orphan links** | Wiki-links to notes that weren't exported are demoted to plain text — no broken `<a>` tags |
| **Static HTML output** | Zero server, zero JavaScript dependencies — every note is a standalone `.html` file |
| **Index page** | An auto-generated `index.html` lists and links every exported note |
| **Dark fantasy theme** | Built-in CSS gives the wiki a clean, readable dark-theme out of the box |
| **Sidebar navigation** | Every exported page has a collapsible sidebar listing all notes, grouped by folder |
| **Breadcrumbs** | Sub-folder pages show a Home › Folder › Title trail |
| **Back-links** | "Linked from" chips at the bottom of each page list reverse wiki-links |
| **Live search** | Header search bar filters notes by title and content; no server required |
| **Theme switcher** | ☀/☽ button persists dark/light preference per browser |
| **Custom CSS per profile** | Inject additional styles into every exported page from Settings → Appearance |
| **Collision-safe filenames** | Notes in different folders that share a basename receive unique filenames derived from their full vault path |
| **Safe URL rendering** | Only `http`, `https`, `mailto`, and relative URLs become links — `javascript:` and `data:` schemes are neutralized |
| **Mobile support** | Works on Obsidian iOS and Android — no desktop-only APIs required |

---

## How It Works

Player Vault runs a two-pass pipeline every time you trigger an export:

1. **Pass 1 – Filter & Sanitize**  
   Every Markdown file in your vault is read. Notes are dropped if they match any of these criteria (checked in order):
   - `publish: false` in YAML front-matter (Obsidian Publish parity)
   - `gm-only: true` in front-matter
   - Inside an excluded folder (per the active profile)
   - Missing the required inclusion tag (if one is set in the active profile)

   Remaining notes have GM-only sections stripped by the sanitizer.

2. **Pass 2 – Convert & Write**  
   Each surviving note is converted from Obsidian-flavoured Markdown to an HTML fragment, wrapped in a full HTML5 page, and written to the output folder. Wiki-links that point to exported notes become clickable `<a>` tags; those pointing to excluded or missing notes become plain text.  
   When **Incremental export** is enabled, notes whose `mtime` matches the previous cache are skipped entirely — only modified notes are re-written.

3. **Index, CSS & Manifest**  
   An `index.html` listing all exported notes, a `styles.css` stylesheet, a `_export-manifest.json` summary, `search-index.js`, and `search.js` are written alongside the notes.  
   If incremental export is on, a `.pv-cache.json` is also written (or updated) for the next run.

---

## Installation

### Community Plugin (Recommended)

1. Open Obsidian → **Settings** → **Community plugins** → **Browse**.
2. Search for **Player Vault**.
3. Click **Install**, then **Enable**.

### Manual Installation

1. Download the latest release from the [GitHub Releases page](https://github.com/tescolopio/Obsidian_PlayerVault/releases).
2. Extract `main.js`, `manifest.json`, and `styles.css` into  
   `<your vault>/.obsidian/plugins/player-vault/`.
3. Reload Obsidian (Ctrl/Cmd + R) and enable the plugin under **Settings → Community plugins**.

### BRAT (Beta)

1. Install [BRAT](https://github.com/TfTHacker/obsidian42-brat) from Community Plugins.
2. In BRAT settings, add the beta repository: `tescolopio/Obsidian_PlayerVault`.
3. Enable **Player Vault** under **Settings → Community plugins**.

---

## Usage

Trigger an export via any of these methods:

- **Ribbon icon** — click the open-book icon in the left sidebar.
- **Command palette** — run **Player Vault: Export Player Vault to HTML** (`Ctrl/Cmd + P`).
- **Settings panel** — click the **⚡ Run Export Now** button at the top of the Player Vault settings tab.

To preview what would be exported without writing any files, use the **Dry Run** command (see [Dry Run](#dry-run)).

Progress and completion notices appear at the top of the Obsidian window. The output folder is created automatically if it does not exist.

---

## Marking Content as GM-Only

### Inline Tags

Wrap any span of text — across multiple lines — in matching tag pairs to have it stripped:

```markdown
The party arrives in Thornwall. 

%%SECRET%%
The mayor is secretly a werewolf. He will attack during the next full moon.
%%SECRET%%

The inn is called The Rusty Flagon.
```

```markdown
%%GM%%
Perception DC 18: a faint magical aura clings to the chalice.
%%GM%%
```

Both tag names are **case-insensitive** and can span any number of lines.

### Callout Blocks

Use Obsidian's callout syntax with the `gm-only` type. All continuation lines (those starting with `>`) are included in the removal:

```markdown
> [!gm-only] Session Notes
> The villain escapes through the northwest passage.
> She will reappear in Chapter 4.

The town is peaceful for now.
```

### Front-Matter Flag (Whole Note)

To exclude an entire note from the export, add `gm-only: true` to its front-matter:

```yaml
---
gm-only: true
---
# Campaign Master Timeline
...
```

The note will be completely omitted and any wiki-links pointing to it will be rendered as plain text.

### Obsidian Publish Parity (`publish: false`)

If you are migrating from — or running alongside — [Obsidian Publish](https://obsidian.md/publish), Player Vault respects the same `publish: false` flag:

```yaml
---
publish: false
---
# Work-in-Progress Location
Not ready for players yet.
```

Both the boolean form (`publish: false`) and the string form (`publish: "false"`) are recognised. The note is omitted from the export and shown in Dry Run output with the reason **publish: false**. Notes with `publish: true` or no `publish` key export normally.

### Obsidian Comments

Standard Obsidian comment blocks (`%% … %%`) are left in place by default since they are invisible in Reading view. Enable **Strip all Obsidian comments** in settings to remove them from the export too.

### Custom Patterns

For custom secret markers, add regex patterns in **Settings → Extra secret patterns**. For example:

| Pattern | Matches |
|---|---|
| `%%SPOILER%%[\s\S]*?%%SPOILER%%` | `%%SPOILER%% … %%SPOILER%%` |
| `<!--gm:[\s\S]*?-->` | HTML-style GM comments |
| `\[\[.*?\]\]` | **All** wiki-links (strip instead of convert) |

Patterns are matched case-insensitively. Invalid regex strings are silently ignored.

---

## Export Profiles

Profiles let you save multiple named export configurations and switch between them in one click. Each profile stores its own:

- Output folder path
- Excluded folders list
- Inclusion tag
- Extra secret patterns
- Strip-all-comments toggle

**Use cases:**
- 📘 *"Session 0 intro"* — exports only notes tagged `#session-0`, to a `session0-export/` folder
- 🗺️ *"Full campaign wiki"* — exports everything except the `GM Notes/` folder
- 👥 *"Campaign B players"* — a completely separate profile targeting a different output folder

Create a new profile with the **New** button in the Profiles section of Settings. Profiles are duplicated from the currently active one, so you can clone-and-tweak rather than starting from scratch. The active profile name appears next to the export buttons.

---

## Selective Export

### Folder Exclusion

In **Settings → Content Filtering → Excluded folders**, click **Add Folder** and pick any vault folder. Every note inside that folder (and all sub-folders) will be excluded from the export — equivalent to putting `gm-only: true` in every note's front-matter, but without touching the notes.

```
Vault/
├── Player Notes/     ← exported normally
├── Lore/             ← exported normally
└── GM Notes/         ← add this to Excluded folders → entirely suppressed
    ├── Session 12.md
    └── Villain Plans.md
```

### Tag-Based Inclusion

Set an **Inclusion tag** in Settings (e.g. `#player-facing`) to restrict the export to only notes that carry that tag. Notes without it are silently skipped. Leave the field blank to export all notes (the default).

The tag can be set in any of the standard Obsidian locations:

```yaml
---
tags: [player-facing, npc]
---
```
```yaml
---
tags:
  - player-facing
---
```
```markdown
Body text with an inline #player-facing tag.
```

> **Tip:** combine folder exclusion _and_ an inclusion tag in the same profile for maximum control — excluded folders are checked first, then the tag filter.

### Dry Run

Run **Player Vault: Dry Run (preview export)** from the Command Palette, or click the **🐾 Dry Run** button in Settings, to open a preview modal showing:

- How many notes _would_ be exported
- How many notes _would_ be excluded, and the reason for each:
  - `publish: false` — note has `publish: false` in front-matter
  - `GM-only content` — `gm-only: true` in front-matter
  - `excluded folder` — note is inside a folder on the exclusion list
  - `missing inclusion tag` — note doesn't carry the required tag

No files are written. Use this to verify your profile settings before running the real export.

---

## Incremental Export

Enable **Incremental export** in Settings → Export (per-profile) to activate mtime-based caching.

**How it works:**

1. After the first full export, Player Vault writes `.pv-cache.json` in the output folder. It records the `mtime` (modification timestamp) for each exported note.
2. On the next export, notes whose `mtime` is unchanged are skipped — their existing `.html` files are left untouched.
3. If the **total note count** changes (a note was added or deleted), the entire cache is discarded and a full export runs so that the sidebar, index, and back-links stay accurate.

**Typical speed difference on a 400-note vault:**

| Scenario | Time |
|---|---|
| First export (full) | ~8 s |
| Re-export, 3 notes changed | ~0.3 s |

**To force a full re-export** at any time, simply delete `.pv-cache.json` from the output folder before exporting.

---

## Publish to Web

Player Vault can trigger a rebuild of your hosted static site with a single click or command.

### Supported providers

| Provider | How to get the URL |
|---|---|
| **Netlify** | Site → Deploy & notifications → Build hooks → Add build hook |
| **GitHub Actions** | Create a `repository_dispatch` workflow; use `https://api.github.com/repos/OWNER/REPO/dispatches` with a personal access token |
| **Vercel** | Project → Settings → Git → Deploy Hooks → Create Hook |

### Setup

1. Open **Settings → Player Vault → Publish to Web**.
2. Paste your deploy-hook URL into the **Deploy hook URL** field.
3. Click **Save** (the **Publish** button in the CTA row will become active).

### Triggering a deploy

- **Button:** Click **Publish** in the Settings CTA row (next to Export and Dry Run).
- **Command Palette:** Run **Player Vault: Publish to Web (trigger deploy hook)**.

The plugin POSTs to the URL and shows a Notice in Obsidian reporting success or the HTTP status code on failure. The export itself is **not** triggered automatically — run an export first, then publish.

---

## Settings

Open **Settings → Player Vault** to configure the plugin.

### Global settings (apply across all profiles)

| Setting | Default | Description |
|---|---|---|
| **Open folder after export** | Off | Reveals the output folder in the system file browser when export finishes. _(Desktop only.)_ |
| **Language** | `en` | Locale used for user-visible strings in the exported HTML (site title, search placeholder, "Linked from", etc.). Only `en` ships today; community locales can be added to `PV_STRINGS` in `exporter.ts`. |

### Per-profile settings

All other settings belong to the **active profile** and can differ between profiles.

| Setting | Default | Description |
|---|---|---|
| **Profile name** | `Default` | Display name shown in the profile dropdown and in the export hint. |
| **Output folder** | `player-vault-export` | Vault-relative path where the HTML wiki is written. Created automatically if it does not exist. |
| **Excluded folders** | _(none)_ | Vault folders whose contents are entirely suppressed. Click **Add Folder** to pick from a fuzzy-search list. |
| **Inclusion tag** | _(blank)_ | If set, only notes carrying this Obsidian tag are exported. Blank means export all surviving notes. |
| **Strip all Obsidian comments** | Off | When enabled, all `%% … %%` blocks are removed — not just `%%SECRET%%` / `%%GM%%` ones. |
| **Extra secret patterns** | _(none)_ | Custom regex patterns. Content matching any pattern is stripped on export. Live regex validation is shown as you type. |
| **Incremental export** | Off | After the first export, skip notes whose file modification time is unchanged. Dramatically speeds up repeated exports of large vaults. |
| **Deploy hook URL** | _(blank)_ | Paste a Netlify build-hook URL, a GitHub Actions `repository_dispatch` URL, or a Vercel deploy-hook URL here. Enables the **Publish** button and the **Player Vault: Publish to Web** command. |

---

## Export Output

After a successful export the output folder contains:

```
player-vault-export/
├── index.html                ← alphabetical list of all exported notes
├── styles.css                ← built-in dark-fantasy stylesheet
├── _export-manifest.json     ← timestamp, profile name, note list
├── search-index.js           ← pre-built search index (titles + content snippets)
├── search.js                 ← search runtime (no network required)
├── .pv-cache.json            ← incremental-export mtime cache (if enabled)
├── Note_Name.html            ← one file per exported note
├── Folder_SubNote.html       ← notes in sub-folders get path-prefixed filenames
└── …
```

**Export manifest** (`_export-manifest.json`) example:

```json
{
  "exportedAt": "2026-03-04T14:30:00.000Z",
  "profile": "Full Campaign Wiki",
  "noteCount": 42,
  "notes": [
    { "name": "Thornwall", "filename": "Thornwall.html", "path": "Lore/Thornwall.md" },
    { "name": "Mayor Aldric", "filename": "NPCs_Mayor_Aldric.html", "path": "NPCs/Mayor Aldric.md" }
  ]
}
```

**Filename generation:** each note's HTML filename is derived from its full vault path with path separators replaced by `_` and characters invalid on Windows/macOS removed. This ensures notes in different folders that happen to share the same basename each receive a unique file.

**Wiki-links:** `[[Note Name]]` links resolve to the correct filename. Links with an alias (`[[Note Name|Display Text]]`) use the display text. Links to notes that were excluded or don't exist in the vault become plain text.

**Supported Markdown:**

- Headings (`#` – `######`)
- Bold (`**text**`, `__text__`), italic (`*text*`, `_text_`), bold+italic (`***text***`)
- Inline code (`` `code` ``) and fenced code blocks (` ``` `)
- Block quotes (`> …`)
- Unordered lists (`-`, `*`, `+`) and ordered lists (`1.`, `2.`, …)
- Horizontal rules (`---`, `***`, `___`)
- Images (`![alt](src)`)
- Markdown links (`[text](url)`)
- Obsidian wiki-links (`[[Note]]`, `[[Note|Alias]]`)

---

## Security

Player Vault is designed to produce safely shareable HTML:

- **XSS prevention** — raw note text is HTML-escaped before any Markdown transform runs. Only tags generated by the converter itself appear in the output.
- **URL allowlisting** — only `http://`, `https://`, `mailto:`, and relative URLs are rendered as links. `javascript:`, `data:`, and other schemes are neutralized to plain text.
- **No external requests** — the exported wiki is entirely self-contained. No CDN fonts, no analytics, no remote scripts.
- **No eval / innerHTML** — the HTML is built by string concatenation with all user-controlled content escaped.

---

## Compatibility

- **Obsidian** ≥ 1.4.0
- **Desktop and mobile** — works on Obsidian for macOS, Windows, Linux, iOS, and Android. On mobile the "open folder" convenience step is skipped; exported files are accessible via your device's file-manager app.

---

## Development

```bash
# Clone
git clone https://github.com/tescolopio/Obsidian_PlayerVault.git
cd Obsidian_PlayerVault

# Install dependencies
npm ci

# Compile in watch mode (outputs main.js)
npm run dev

# Type-check + production build
npm run build

# Run tests
npm test
```

To work on the plugin inside Obsidian, symlink (or copy) your cloned folder into  
`<vault>/.obsidian/plugins/player-vault/` and enable it under Community plugins.

For a full technical breakdown see [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) and the [development roadmap](docs/ROADMAP.md).

---

## Contributing

Bug reports and pull requests are welcome! See [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) for the full guide including setup instructions, PR checklist, and style conventions.

**Security issues** — please do not open a public issue. Follow the process in [docs/SECURITY.md](docs/SECURITY.md).

---

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for a full version history.

---

## License

[MIT](LICENSE) © 2026 Tim Escolopio

