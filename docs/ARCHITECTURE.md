# Player Vault — Architecture

A technical reference for contributors and maintainers.

---

## Repository Layout

```
PlayerVault/
├── src/
│   ├── main.ts          # Plugin entry point, export pipeline orchestration
│   ├── exporter.ts      # Markdown → HTML, link resolution, heading anchors, tables, strikethrough
│   ├── sanitizer.ts     # GM-content stripping (regex-based)
│   ├── settings.ts      # Settings interface, defaults, settings tab UI
│   └── onboarding.ts    # First-run WelcomeModal (4-step wizard)
├── tests/
│   ├── exporter.test.ts # Unit tests for exporter.ts
│   ├── sanitizer.test.ts# Unit tests for sanitizer.ts
│   └── __mocks__/
│       └── obsidian.ts  # Minimal Obsidian API stub for Jest
├── docs/                # Developer documentation (this directory)
├── sample-vault/        # Example notes covering all plugin features
├── .github/workflows/
│   └── release.yml      # CI/CD — runs tests, builds, publishes GitHub Release
├── esbuild.config.mjs   # Production bundler config
├── tsconfig.json        # TypeScript config for esbuild (bundler mode, noEmit)
├── tsconfig.jest.json   # TypeScript config override for ts-jest (CommonJS mode)
├── manifest.json        # Obsidian plugin manifest
└── styles.css           # Plugin UI styles (settings tab, onboarding modal)
```

---

## Build Pipeline

```
TypeScript source (src/)
        │
        ▼ tsc --noEmit --skipLibCheck   (type-check only, no output)
        │
        ▼ esbuild (esbuild.config.mjs)
        │   • entry: src/main.ts
        │   • format: cjs
        │   • target: es2018
        │   • externals: obsidian, electron, node builtins
        │   • production: minify + no sourcemap
        │
        ▼ main.js  (Obsidian loads this at runtime)
```

The two-step approach means TypeScript errors are caught before bundling while esbuild handles the actual emit — giving fast builds without needing `tsc` to produce output files.

---

## Export Pipeline (`main.ts`)

The export runs in two sequential passes over the vault.

```
Trigger (ribbon click, command, or Settings button)
        │
        ▼
  [Pass 1 — Filter & Sanitise]
  For every .md file in the vault:
    ├── Skip if gm-only: true in front-matter
    ├── Skip if file.path matches any excludedFolders entry (profile)
    ├── Skip if inclusionTag is set and note does not carry that tag (profile)
    ├── sanitizeContent(raw, { extraPatterns, stripAllComments })  ← from profile
    └── Add to survivingNotes: Map<filePath, { file, sanitized, outputFilename }>
        │
        ▼
  Build ExportedNoteMap: Map<basename.lower, outputFilename>
    └── filePathToOutputName(path) → "Folder_Note.html"
        (path separators → "_", invalid chars stripped, collisions warned)
        │
        ▼
  [Pass 2 — Convert & Write]
  For each surviving note:
    ├── markdownToHtml(content, exportedNoteMap)
    │     └── convertInline(text, exportedNoteMap)   ← XSS-safe
    ├── wrapInPage(title, htmlFragment, cssPath)
    └── adapter.write(outputPath, fullPage)
        │
        ▼
  Write index.html  (buildIndexPage)
  Write styles.css  (embedded CSS string)
  Write _export-manifest.json  (timestamp, profile name, note list)
        │
        ▼
  [Optional] Open output folder in system explorer
```

---

## XSS Prevention in `convertInline`

Raw note text is untrusted. The function uses a **placeholder-slot pattern** to prevent injected HTML from ever touching the DOM unescaped:

```
1. Extract structured Markdown (code spans, links, wiki-links, images) → replace with
   @@SLOT_n@@ placeholders, store originals in a slots Map
2. escapeHtml() the remaining raw text  (& < > " ' → entities)
3. Apply bold / italic / strikethrough regexes on the now-safe text
4. Restore @@SLOT_n@@ slots with their pre-built safe HTML strings
```

This means `$1` capture groups in bold/italic patterns can only ever contain already-escaped text, preventing patterns like `**<script>**` from emitting a live `<script>` tag.

---

## Supported Markdown (`markdownToHtml` + `convertInline`)

| Syntax | Output |
|---|---|
| `# Heading` … `###### Heading` | `<h1 id="heading">` … `<h6>` with auto-generated anchor |
| `**bold**` / `__bold__` | `<strong>` |
| `*italic*` / `_italic_` | `<em>` |
| `***bold italic***` | `<strong><em>` |
| `~~strike~~` | `<s>` |
| `` `code` `` | `<code>` (content escaped) |
| ```` ``` lang … ``` ```` | `<pre><code class="language-lang">` |
| `> quote` | `<blockquote>` |
| `- item` / `* item` / `+ item` | `<ul><li>` |
| `1. item` | `<ol><li>` |
| `---` / `***` / `___` | `<hr>` |
| `\| col \| col \|` (GFM pipe table) | `<table>` with `<thead>` / `<tbody>` |
| `[[Note]]` / `[[Note\|Alias]]` | `<a href="Note.html">` (orphan → plain text) |
| `[text](url)` | `<a href>` (safe-URL checked) |
| `![alt](src)` | `<img>` (safe-URL checked) |

---

## URL Safety (`isSafeUrl`)

| Input scheme | Result |
|---|---|
| Relative (no `://`) | Passed through unchanged |
| `http:` / `https:` / `mailto:` | Passed through unchanged |
| `javascript:` / `data:` / anything else | Rendered as escaped plain text, not an `<a>` tag |

---

## Key Types

```typescript
// Maps lowercase note basename → output HTML filename
type ExportedNoteMap = Map<string, string>;

// Output filename derived from vault path
// "Characters/Lyra Silverwind.md" → "Characters_Lyra_Silverwind.html"
function filePathToOutputName(filePath: string): string;

// Filter helpers (src/sanitizer.ts)
function isNoteExcludedByFolder(filePath: string, excludedFolders: string[]): boolean;
function isNoteIncludedByTag(content: string, inclusionTag: string): boolean;
```

`ExportedNoteMap` is built in a dedicated pass rather than incrementally so that every note can resolve links to every other note at conversion time, regardless of processing order.

---

## Settings Schema

Defined in `src/settings.ts`:

```typescript
/** A named export configuration. All per-export options live here. */
interface ExportProfile {
  id: string;               // unique key ("default" or "profile-<timestamp>")
  name: string;             // display name shown in the UI dropdown
  outputFolder: string;     // default: "player-vault-export"
  excludedFolders: string[];// vault paths excluded entirely
  inclusionTag: string;     // only export notes with this tag; "" = no filter
  extraSecretPatterns: string[]; // user-supplied regex strings
  stripAllComments: boolean;// strip all %% … %% blocks
}

interface PlayerVaultSettings {
  profiles: ExportProfile[]; // always ≥ 1 profile
  activeProfileId: string;   // id of the currently active profile
  openAfterExport: boolean;  // reveal output folder in OS file browser
  hasSeenWelcome: boolean;   // cleared after onboarding
}
```

`getActiveProfile(settings)` resolves the active profile with a safe fallback chain:  
`profiles.find(id match) ?? profiles[0] ?? DEFAULT_PROFILE`.

**Migration:** `loadSettings()` detects the legacy v1.1 flat format (`!data.profiles`) and auto-converts `outputFolder` / `extraSecretPatterns` / `stripAllComments` into a single `ExportProfile`, preserving all prior user settings without any manual action.

---

## Testing

```bash
npm test          # run all tests (Jest + ts-jest, tsconfig.jest.json)
npm run build     # type-check + production bundle
```

- **`tsconfig.json`** — used by esbuild and the IDE; `moduleResolution: bundler`, `module: ESNext`, `noEmit: true`
- **`tsconfig.jest.json`** — extends base but overrides to `moduleResolution: node`, `module: CommonJS` so ts-jest can compile for Node without bundler-mode assumptions

Tests use a minimal `tests/__mocks__/obsidian.ts` stub so the Obsidian API does not need to be installed in the test environment.

---

## Release Process

1. Update `manifest.json` and `versions.json` with the new version.
2. Commit with message `feat: release X.Y.Z`.
3. `git tag -a X.Y.Z -m "Release X.Y.Z"`
4. `git push origin main --follow-tags`

The `release.yml` workflow triggers on the tag push, runs `npm ci && npm test && npm run build`, verifies the tag matches `manifest.json`, then publishes a GitHub Release with `main.js`, `manifest.json`, and `styles.css` attached.
