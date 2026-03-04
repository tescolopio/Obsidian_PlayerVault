# Sample Vault

Copy these notes into an Obsidian vault, then run **Player Vault: Export Player Vault to HTML** to test the plugin.

## File Map

```
sample-vault/
├── Welcome.md                     ← All Markdown features (headings, lists, code, links, images, HR)
├── Thornwall.md                   ← %%SECRET%% and %%GM%% block stripping
├── The_Rusty_Flagon.md            ← > [!gm-only] callout stripping + Obsidian comments (%% … %%)
├── The_Dark_Forest.md             ← %%SECRET%% and %%GM%% blocks + wiki-links to excluded note
├── Mayor_Aldric.md                ← %%SECRET%%, [!gm-only] callout, and orphan link to excluded note
├── GM_Session_Notes.md            ← gm-only: true (entire note excluded via front-matter)
├── Player_Bulletin.md             ← tags: [player-facing]  ← v1.2 tag-based inclusion demo
├── Edge_Case_Tests.md             ← Security: disallowed URLs, raw <script>, XSS in bold/code
│
├── Characters/
│   ├── Lyra_Silverwind.md         ← Sub-folder note; tests path-based filename generation
│   └── Zorn_Blackthorn.md         ← Sub-folder note with %%SECRET%% block
│
├── GM Notes/                      ← v1.2: add this folder to "Excluded folders" in Settings
│   ├── Session_12_Prep.md         ← Excluded by folder (no per-note flag needed)
│   └── Villain_Plans.md           ← Excluded by folder (has tags but still suppressed)
│
├── Lore/
│   ├── Ancient_Compact.md         ← tags: [player-facing] + %%SECRET%%/%%GM%% blocks  ← v1.2
│   └── Ancient_Prophecy.md        ← Nested sub-folder note with %%SECRET%% block
│
└── NPCs/
    └── Lyra_Silverwind.md         ← SAME basename as Characters/Lyra_Silverwind.md
                                     → triggers console basename-collision warning
```

---

## What to Check After Export

### v1.0 / v1.1 baseline checks

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

---

## v1.2 Scenario Walkthroughs

### Scenario A — Folder Exclusion

> Goal: suppress everything in `GM Notes/` without touching the notes themselves.

1. Open **Settings → Player Vault → Content Filtering**.
2. Click **Add Folder** and select `GM Notes`.
3. Run **🐾 Dry Run** — verify `Session_12_Prep` and `Villain_Plans` appear in the **Excluded** list with reason `excluded folder`.
4. Run the full export. Confirm neither `GM_Notes_Session_12_Prep.html` nor `GM_Notes_Villain_Plans.html` exists in the output folder.

### Scenario B — Tag-Based Inclusion

> Goal: export only notes tagged `#player-facing` (e.g. for a handout-only build).

1. Open **Settings → Player Vault → Content Filtering → Inclusion tag**.
2. Type `#player-facing` and press Tab.
3. Run **🐾 Dry Run** — only `Player_Bulletin` and `Lore/Ancient_Compact` should appear as **Exported**.
4. Run the full export. Confirm only those two HTML files (plus `index.html`, `styles.css`, `_export-manifest.json`) are produced.

### Scenario C — Profiles (two-audience setup)

> Goal: maintain separate configs for "full campaign wiki" and "session handouts".

1. The **Default** profile: no inclusion tag, `GM Notes/` excluded. This exports every note except the GM folder.
2. Click **New** to duplicate the Default profile. Rename the copy to **Session Handouts**.
3. On the Session Handouts profile, set Inclusion tag to `#player-facing` and change Output folder to `session-handouts/`.
4. Switch between the two profiles using the dropdown and run the respective exports. The `_export-manifest.json` in each output folder records which profile was used.

### Scenario D — Export Manifest

After any export, open `<output-folder>/_export-manifest.json` in a text editor. It should contain:

```json
{
  "exportedAt": "2026-03-04T14:30:00.000Z",
  "profile": "Default",
  "noteCount": 10,
  "notes": [
    { "name": "Ancient Compact", "filename": "Lore_Ancient_Compact.html", "path": "Lore/Ancient_Compact.md" }
  ]
}
```

