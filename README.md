# Player Vault

> **An Obsidian plugin for GMs who share world-lore with players.**
>
> Player Vault sanitizes your vault — stripping GM-only secrets, hidden callouts, and orphan links — then compiles every surviving note into a self-contained, dark-themed static HTML wiki you can hand off to your players.

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
- [Settings](#settings)
- [Export Output](#export-output)
- [Security](#security)
- [Compatibility](#compatibility)
- [Development](#development)
- [Contributing](#contributing)
- [License](#license)

---

## Features

| Feature | Details |
|---|---|
| **Secret stripping** | Removes `%%SECRET%% … %%SECRET%%`, `%%GM%% … %%GM%%`, and `> [!gm-only]` callout blocks automatically |
| **Whole-note exclusion** | Notes with `gm-only: true` in front-matter are omitted entirely |
| **Custom patterns** | Supply extra regex patterns (e.g. `%%HIDDEN%%[\s\S]*?%%HIDDEN%%`) to strip additional private content |
| **Orphan links** | Wiki-links to notes that weren't exported are demoted to plain text — no broken `<a>` tags |
| **Static HTML output** | Zero server, zero JavaScript dependencies — every note is a standalone `.html` file |
| **Index page** | An auto-generated `index.html` lists and links every exported note |
| **Dark fantasy theme** | Built-in CSS gives the wiki a clean, readable dark-theme out of the box |
| **Collision-safe filenames** | Notes in different folders that share a basename receive unique filenames derived from their full vault path |
| **Safe URL rendering** | Only `http`, `https`, `mailto`, and relative URLs are rendered as links — `javascript:` and `data:` schemes are neutralized to plain text |

---

## How It Works

Player Vault runs a two-pass pipeline every time you trigger an export:

1. **Pass 1 – Sanitize**  
   Every Markdown file in your vault is read. Notes flagged with `gm-only: true` in front-matter are skipped entirely. All remaining notes have GM-only sections removed and are added to the surviving set.

2. **Pass 2 – Convert & Write**  
   Each surviving note is converted from Obsidian-flavoured Markdown to an HTML fragment, wrapped in a full HTML5 page, and written to the output folder. Wiki-links that point to exported notes become clickable `<a>` tags; those pointing to excluded or missing notes become plain text.

3. **Index & CSS**  
   An `index.html` listing all exported notes and a `styles.css` file are written alongside the notes.

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

Trigger an export any time via either of these methods:

- **Ribbon icon** — click the open-book icon (`📖`) in the left sidebar.
- **Command palette** — run **Player Vault: Export Player Vault to HTML** (`Ctrl/Cmd + P`).

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

## Settings

Open **Settings → Player Vault** to configure the plugin.

| Setting | Default | Description |
|---|---|---|
| **Output folder** | `player-vault-export` | Vault-relative path where the HTML wiki is written. The folder is created if it does not exist. |
| **Extra secret patterns** | _(empty)_ | Comma-separated regex strings. Content matching any pattern is stripped before export. |
| **Strip all Obsidian comments** | Off | When enabled, all `%% … %%` blocks are removed, not just those containing secret tags. |
| **Open folder after export** | Off | Reveals the output folder in the system file browser when export finishes. _(Desktop only — requires a filesystem vault.)_ |

---

## Export Output

After a successful export the output folder contains:

```
player-vault-export/
├── index.html          ← alphabetical list of all exported notes
├── styles.css          ← built-in dark-fantasy stylesheet
├── Note_Name.html      ← one file per exported note
├── Folder_SubNote.html ← notes in sub-folders get path-prefixed filenames
└── …
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
- **Desktop only** — the plugin uses the Electron shell to open the output folder and writes files directly to the filesystem. It will not function in Obsidian Mobile.

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

## License

[MIT](LICENSE) © 2026 Tim Escolopio

