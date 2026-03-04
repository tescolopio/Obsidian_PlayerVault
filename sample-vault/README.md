# Sample Vault

Copy these notes into an Obsidian vault, then run **Player Vault: Export Player Vault to HTML** to test the plugin.

## File Map

```
sample-vault/
├── Welcome.md                    ← All Markdown features (headings, lists, code, links, images, HR)
├── Thornwall.md                  ← %%SECRET%% and %%GM%% block stripping
├── The_Rusty_Flagon.md           ← > [!gm-only] callout stripping + Obsidian comments (%% … %%)
├── The_Dark_Forest.md            ← %%SECRET%% and %%GM%% blocks + wiki-links to excluded note
├── Mayor_Aldric.md               ← %%SECRET%%, [!gm-only] callout, and orphan link to excluded note
├── GM_Session_Notes.md           ← gm-only: true (entire note excluded — no HTML file produced)
├── Edge_Case_Tests.md            ← Security: disallowed URLs, raw <script>, XSS in bold/code
│
├── Characters/
│   ├── Lyra_Silverwind.md        ← Sub-folder note; tests path-based filename generation
│   └── Zorn_Blackthorn.md        ← Sub-folder note with %%SECRET%% block
│
├── NPCs/
│   └── Lyra_Silverwind.md        ← SAME basename as Characters/Lyra_Silverwind.md
│                                    → triggers console basename-collision warning
│
└── Lore/
    └── Ancient_Prophecy.md       ← Nested sub-folder note with %%SECRET%% block
```

## What to Check After Export

| What to verify | Where to look |
|---|---|
| `GM_Session_Notes.html` does **not** exist | Output folder |
| `%%SECRET%%` / `%%GM%%` content is gone from all notes | Any exported HTML |
| `> [!gm-only]` callout is gone from `The_Rusty_Flagon.html` | That HTML file |
| Links to `[[GM_Session_Notes]]` are plain text | `Mayor_Aldric.html`, `Thornwall.html` |
| `[[Grand Market]]` is plain text (orphan) | `Welcome.html` |
| `Characters_Lyra_Silverwind.html` and `NPCs_Lyra_Silverwind.html` both exist | Output folder |
| Basename collision warning in console (F12 → Console) | Dev tools |
| `javascript:` and `data:` links are plain text | `Edge_Case_Tests.html` |
| `<script>` in paragraph is `&lt;script&gt;` in source | `Edge_Case_Tests.html` source |
| Obsidian comment block is present with setting OFF; absent with setting ON | `The_Rusty_Flagon.html` |
