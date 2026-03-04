import {
	App,
	FileSystemAdapter,
	Modal,
	Notice,
	Platform,
	Plugin,
	TFile,
	normalizePath,
} from "obsidian";
import {
	PlayerVaultSettings,
	ExportProfile,
	DEFAULT_SETTINGS,
	DEFAULT_PROFILE,
	PlayerVaultSettingTab,
	getActiveProfile,
	compileExtraPatterns,
} from "./settings";
import { sanitizeContent, isNoteFullySecret, isNoteExcludedByFolder, isNoteIncludedByTag, isNotePublishBlocked } from "./sanitizer";
import {
	markdownToHtml,
	wrapInPage,
	buildIndexPage,
	filePathToOutputName,
	ExportedNoteMap,
	buildBackLinksMap,
	buildSidebarEntries,
	buildSearchIndexJs,
	SEARCH_JS,
	SearchEntry,
	PvLocale,
} from "./exporter";
import { WelcomeModal } from "./onboarding";

// ── v2.0 Incremental export cache ─────────────────────────────────────────────

/**
 * Persisted as `.pv-cache.json` in the output folder.
 * Records the mtime (ms) of each surviving note at the time it was last
 * converted, plus the total surviving-note count so the cache is auto-
 * invalidated when notes are added or removed from the export set.
 */
interface ExportCache {
	version: 2;
	/** Number of notes in the last successful export. */
	noteCount: number;
	/** Maps vault file path → mtime (ms) from TFile.stat.mtime. */
	entries: Record<string, number>;
}

/** CSS embedded in the export output folder as styles.css */
const EXPORT_CSS = `/* Player Vault – exported wiki styles (v2.0) */
*, *::before, *::after { box-sizing: border-box; }
body {
  font-family: Georgia, "Times New Roman", serif;
  background: #1a1a2e;
  color: #e0e0e0;
  margin: 0;
  padding: 0;
}

/* ── Header ──────────────────────────────────────────────────────────── */
.pv-header {
  position: sticky;
  top: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  background: #16213e;
  padding: 0.6rem 1.5rem;
  border-bottom: 2px solid #e94560;
}
.pv-header-left { display: flex; flex-direction: column; gap: 0.15rem; }
.pv-header-right { display: flex; align-items: center; gap: 0.75rem; }
.pv-site-title { color: #e94560; font-size: 1.2rem; font-weight: bold; text-decoration: none; }
.pv-site-title:hover { text-decoration: underline; }

/* ── Breadcrumb ──────────────────────────────────────────────────────── */
.pv-breadcrumb { font-size: 0.78rem; color: #a8dadc; display: flex; align-items: center; gap: 0.3rem; flex-wrap: wrap; }
.pv-breadcrumb a { color: #a8dadc; text-decoration: none; }
.pv-breadcrumb a:hover { text-decoration: underline; }
.pv-bc-sep { color: #e94560; user-select: none; }

/* ── Search ──────────────────────────────────────────────────────────── */
.pv-search-wrap { position: relative; }
#pv-search {
  background: #0f3460;
  border: 1px solid #e94560;
  border-radius: 4px;
  color: #e0e0e0;
  font-size: 0.85rem;
  padding: 0.3rem 0.6rem;
  width: 200px;
  outline: none;
}
#pv-search::placeholder { color: #888; }
.pv-search-dropdown {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  background: #16213e;
  border: 1px solid #e94560;
  border-radius: 4px;
  z-index: 200;
  max-height: 260px;
  overflow-y: auto;
}
.pv-search-result {
  display: block;
  padding: 0.4rem 0.7rem;
  color: #a8dadc;
  text-decoration: none;
  font-size: 0.85rem;
}
.pv-search-result:hover { background: #0f3460; }

/* ── Theme toggle ────────────────────────────────────────────────────── */
#pv-theme-btn {
  background: transparent;
  border: 1px solid #e94560;
  border-radius: 4px;
  color: #e0e0e0;
  cursor: pointer;
  font-size: 1rem;
  padding: 0.2rem 0.5rem;
}
#pv-theme-btn:hover { background: #0f3460; }

/* ── Layout ──────────────────────────────────────────────────────────── */
.layout { display: flex; min-height: calc(100vh - 50px); }
aside.sidebar {
  width: 240px;
  min-width: 200px;
  position: sticky;
  top: 50px;
  max-height: calc(100vh - 50px);
  background: #16213e;
  padding: 1rem;
  border-right: 1px solid #0f3460;
  overflow-y: auto;
  flex-shrink: 0;
}
aside.sidebar h2 { color: #e94560; font-size: 1rem; margin-top: 0; }
aside.sidebar ul { list-style: none; padding: 0; margin: 0 0 0.5rem 0; }
aside.sidebar ul li a {
  display: block;
  padding: 0.3rem 0.5rem;
  color: #a8dadc;
  text-decoration: none;
  border-radius: 4px;
  font-size: 0.88rem;
}
aside.sidebar ul li a:hover { background: #0f3460; }
aside.sidebar ul li a.pv-sidebar-active { background: #0f3460; color: #e94560; font-weight: bold; }

/* ── Collapsible folder groups ────────────────────────────────────────── */
.pv-folder-group { margin-bottom: 0.25rem; }
.pv-folder-group > summary {
  cursor: pointer;
  list-style: none;
  color: #e94560;
  font-size: 0.85rem;
  font-weight: bold;
  padding: 0.25rem 0.3rem;
  border-radius: 3px;
  user-select: none;
}
.pv-folder-group > summary:hover { background: #0f3460; }
.pv-folder-group > summary::before { content: "\\25B6\\FE0E  "; font-size: 0.6rem; }
.pv-folder-group[open] > summary::before { content: "\\25BC\\FE0E  "; }

/* ── Main content ─────────────────────────────────────────────────────── */
main { flex: 1; padding: 2rem; max-width: 860px; }

article.note-content h1,
article.note-content h2,
article.note-content h3 { color: #e94560; }
article.note-content a { color: #a8dadc; }
article.note-content blockquote {
  border-left: 4px solid #e94560;
  margin: 1rem 0;
  padding: 0.5rem 1rem;
  background: #0f3460;
  border-radius: 0 4px 4px 0;
}
article.note-content code {
  background: #0f3460;
  padding: 0.1em 0.4em;
  border-radius: 3px;
  font-family: "Courier New", monospace;
}
article.note-content pre {
  background: #0f3460;
  padding: 1rem;
  border-radius: 6px;
  overflow-x: auto;
}
article.note-content pre code { background: none; padding: 0; }
article.note-content hr { border: none; border-top: 1px solid #e94560; margin: 1.5rem 0; }

/* ── Tables ──────────────────────────────────────────────────────────── */
article.note-content table {
  border-collapse: collapse;
  width: 100%;
  margin: 1rem 0;
  font-size: 0.9rem;
}
article.note-content th,
article.note-content td {
  border: 1px solid #0f3460;
  padding: 0.45rem 0.75rem;
  text-align: left;
}
article.note-content th { background: #0f3460; color: #e94560; }
article.note-content tr:nth-child(even) td { background: rgba(15,52,96,0.35); }

/* ── Back-links footer ─────────────────────────────────────────────────── */
.pv-backlinks {
  margin-top: 3rem;
  padding-top: 1rem;
  border-top: 1px solid #0f3460;
  font-size: 0.85rem;
}
.pv-backlinks h3 { color: #e94560; margin-bottom: 0.5rem; }
.pv-backlinks ul { list-style: none; padding: 0; margin: 0; display: flex; flex-wrap: wrap; gap: 0.4rem; }
.pv-backlinks ul li a {
  color: #a8dadc;
  text-decoration: none;
  background: #0f3460;
  padding: 0.15rem 0.5rem;
  border-radius: 3px;
}
.pv-backlinks ul li a:hover { text-decoration: underline; }

/* ── Index page ──────────────────────────────────────────────────────── */
ul.note-index { list-style: none; padding: 0; }
ul.note-index li { margin: 0.4rem 0; }
ul.note-index li a { color: #a8dadc; text-decoration: none; }
ul.note-index li a:hover { text-decoration: underline; }

/* ── Light theme overrides ───────────────────────────────────────────── */
html[data-theme="light"] body { background: #f5f5f5; color: #1a1a2e; }
html[data-theme="light"] .pv-header { background: #fff; border-bottom-color: #e94560; }
html[data-theme="light"] aside.sidebar { background: #fff; border-right-color: #ddd; }
html[data-theme="light"] aside.sidebar ul li a { color: #1a1a2e; }
html[data-theme="light"] aside.sidebar ul li a:hover { background: #eee; }
html[data-theme="light"] aside.sidebar ul li a.pv-sidebar-active { background: #eee; }
html[data-theme="light"] .pv-folder-group > summary { color: #e94560; }
html[data-theme="light"] .pv-folder-group > summary:hover { background: #eee; }
html[data-theme="light"] article.note-content a { color: #0050a0; }
html[data-theme="light"] article.note-content blockquote { background: #eee; }
html[data-theme="light"] article.note-content code { background: #eee; color: #1a1a2e; }
html[data-theme="light"] article.note-content pre { background: #eee; color: #1a1a2e; }
html[data-theme="light"] article.note-content th { background: #ddd; }
html[data-theme="light"] article.note-content tr:nth-child(even) td { background: rgba(0,0,0,0.04); }
html[data-theme="light"] #pv-search { background: #fff; border-color: #e94560; color: #1a1a2e; }
html[data-theme="light"] .pv-search-dropdown { background: #fff; }
html[data-theme="light"] .pv-search-result { color: #1a1a2e; }
html[data-theme="light"] .pv-search-result:hover { background: #eee; }
html[data-theme="light"] #pv-theme-btn { color: #1a1a2e; }
html[data-theme="light"] #pv-theme-btn:hover { background: #eee; }
html[data-theme="light"] .pv-backlinks ul li a { background: #eee; color: #1a1a2e; }
html[data-theme="light"] ul.note-index li a { color: #0050a0; }
`;

/** Modal displayed while the export pipeline runs, showing a progress bar and the current note name. */
class ExportProgressModal extends Modal {
	private labelEl!: HTMLElement;
	private barFillEl!: HTMLElement;
	private countEl!: HTMLElement;

	constructor(app: App) {
		super(app);
		this.modalEl.addClass("pv-progress-modal");
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.createEl("h2", { text: "Exporting Player Vault…", cls: "pv-progress-title" });
		this.labelEl = contentEl.createEl("p", { cls: "pv-progress-label", text: "Preparing…" });
		const bar = contentEl.createEl("div", { cls: "pv-progress-bar" });
		this.barFillEl = bar.createEl("div", { cls: "pv-progress-fill" });
		this.countEl = contentEl.createEl("p", { cls: "pv-progress-count", text: "" });
	}

	setProgress(current: number, total: number, noteName: string) {
		if (this.labelEl) this.labelEl.textContent = noteName;
		if (this.countEl) this.countEl.textContent = `${current} / ${total}`;
		if (this.barFillEl)
			this.barFillEl.style.width = `${total > 0 ? Math.round((current / total) * 100) : 0}%`;
	}

	onClose() {
		this.contentEl.empty();
	}
}

type DryRunReason = "folder" | "tag" | "gm-only" | "publish";
interface DryRunNote { name: string; path: string; exported: boolean; reason?: DryRunReason; }

/** Modal that previews which notes would be exported without writing any files. */
class DryRunModal extends Modal {
	constructor(app: App, private notes: DryRunNote[], private profileName: string) {
		super(app);
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.createEl("h2", { text: `Dry Run — Profile: ${this.profileName}` });
		const exported = this.notes.filter((n) => n.exported);
		const excluded = this.notes.filter((n) => !n.exported);
		contentEl.createEl("p", { text: `✅ ${exported.length} notes would be exported` });
		contentEl.createEl("p", { text: `❌ ${excluded.length} notes would be excluded` });

		if (excluded.length > 0) {
			contentEl.createEl("h3", { text: "Excluded notes" });
			const ul = contentEl.createEl("ul");
			const REASON_LABEL: Record<DryRunReason, string> = {
				"gm-only": "GM-only content",
				"folder": "excluded folder",
				"tag": "missing inclusion tag",
				"publish": "publish: false",
			};
			for (const n of excluded) {
				const label = n.reason ? ` (${REASON_LABEL[n.reason]})` : "";
				ul.createEl("li", { text: `${n.name}${label}` });
			}
		}

		if (exported.length > 0) {
			contentEl.createEl("h3", { text: "Notes to export" });
			const ul2 = contentEl.createEl("ul");
			for (const n of exported) ul2.createEl("li", { text: n.name });
		}

		contentEl.createEl("button", { text: "Close", cls: "mod-cta" }).addEventListener("click", () => this.close());
	}

	onClose() { this.contentEl.empty(); }
}

export default class PlayerVaultPlugin extends Plugin {
	settings!: PlayerVaultSettings;

	async onload() {
		await this.loadSettings();

		// Ribbon icon
		this.addRibbonIcon("book-open", "Export Player Vault", () => {
			this.runExport();
		});

		// Command palette commands
		this.addCommand({
			id: "export-player-vault",
			name: "Export Player Vault to HTML",
			callback: () => { this.runExport(); },
		});

		this.addCommand({
			id: "dry-run-export",
			name: "Player Vault: Dry Run (preview export)",
			callback: () => { this.runDryRun(); },
		});

		this.addCommand({
			id: "publish-player-vault",
			name: "Player Vault: Publish to Web (trigger deploy hook)",
			callback: () => { this.runPublish(); },
		});

		// Settings tab
		this.addSettingTab(new PlayerVaultSettingTab(this.app, this));

		// Show the welcome wizard on first install, after the workspace is ready
		this.app.workspace.onLayoutReady(() => {
			if (!this.settings.hasSeenWelcome) {
				new WelcomeModal(this.app, async () => {
					this.settings.hasSeenWelcome = true;
					await this.saveSettings();
				}).open();
			}
		});
	}

	async loadSettings() {
		const data = await this.loadData();
		if (data && !data.profiles) {
			// Migrate from v1.1 flat settings to profile-based v1.2
			const legacyProfile: ExportProfile = {
				...DEFAULT_PROFILE,
				outputFolder: data.outputFolder ?? DEFAULT_PROFILE.outputFolder,
				extraSecretPatterns: data.extraSecretPatterns ?? [],
				stripAllComments: data.stripAllComments ?? false,
			};
			this.settings = {
				...DEFAULT_SETTINGS,
				profiles: [legacyProfile],
				activeProfileId: legacyProfile.id,
				openAfterExport: data.openAfterExport ?? false,
				hasSeenWelcome: data.hasSeenWelcome ?? false,
			};
		} else {
			this.settings = Object.assign({}, DEFAULT_SETTINGS, data);
		}
		// ── v2.0 profile field migration ────────────────────────────────────
		// Ensure every profile loaded from disk has the new v2.0 fields.
		for (const p of this.settings.profiles) {
			if (p.incrementalExport === undefined) p.incrementalExport = false;
			if (p.deployHookUrl === undefined) p.deployHookUrl = "";
		}
		// Ensure global locale field exists
		if (!this.settings.locale) this.settings.locale = "en";
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	/** Main export pipeline */
	async runExport() {
		const profile = getActiveProfile(this.settings);
		const progress = new ExportProgressModal(this.app);
		progress.open();

		try {
			await this.exportVault((current, total, name) => {
				progress.setProgress(current, total, name);
			});
			progress.close();
			new Notice("Player Vault: export complete! ✅", 4000);

			if (this.settings.openAfterExport && Platform.isDesktop) {
				const { adapter } = this.app.vault;
				if (!(adapter instanceof FileSystemAdapter)) {
					new Notice("Player Vault: cannot open folder – not a filesystem vault.", 4000);
					return;
				}
				const outputPath = normalizePath(
					`${adapter.getBasePath()}/${profile.outputFolder}`
				);
				try {
					(window as any).require("electron").shell.openPath(outputPath);
				} catch {
					new Notice("Player Vault: cannot open folder – Electron shell unavailable.", 4000);
				}
			}
		} catch (err) {
			progress.close();
			console.error("Player Vault export error:", err);
			new Notice(
				`Player Vault: export failed – ${(err as Error).message}`,
				6000
			);
		}
	}

	/** Dry-run: preview which notes would be exported without writing files. */
	async runDryRun() {
		const profile = getActiveProfile(this.settings);
		const { vault } = this.app;
		const allFiles = vault.getMarkdownFiles();
		const extraPatterns = compileExtraPatterns(profile.extraSecretPatterns);
		const results: DryRunNote[] = [];

		for (const file of allFiles) {
			const raw = await vault.read(file);
			if (isNotePublishBlocked(raw)) {
				results.push({ name: file.basename, path: file.path, exported: false, reason: "publish" });
				continue;
			}
			if (isNoteFullySecret(raw)) {
				results.push({ name: file.basename, path: file.path, exported: false, reason: "gm-only" });
				continue;
			}
			if (isNoteExcludedByFolder(file.path, profile.excludedFolders)) {
				results.push({ name: file.basename, path: file.path, exported: false, reason: "folder" });
				continue;
			}
			if (!isNoteIncludedByTag(raw, profile.inclusionTag)) {
				results.push({ name: file.basename, path: file.path, exported: false, reason: "tag" });
				continue;
			}
			results.push({ name: file.basename, path: file.path, exported: true });
		}

		new DryRunModal(this.app, results, profile.name).open();
	}

	/**
	 * POST to the configured deploy hook URL (Netlify build hook, GitHub Actions
	 * repository_dispatch, Vercel deploy hook, etc.).
	 *
	 * The deploy hook is profile-specific so teams can maintain separate
	 * staging / production pipelines per export profile.
	 */
	async runPublish() {
		const profile = getActiveProfile(this.settings);
		const url = profile.deployHookUrl.trim();
		if (!url) {
			new Notice(
				"Player Vault: no deploy hook URL configured.\n" +
				"Add one in Settings → Publish to Web.",
				5000,
			);
			return;
		}
		try {
			new Notice("Player Vault: triggering deploy…", 3000);
			const res = await fetch(url, { method: "POST" });
			if (res.ok) {
				new Notice("Player Vault: deploy triggered ✓  Your site will be live shortly.", 5000);
			} else {
				new Notice(
					`Player Vault: deploy hook returned HTTP ${res.status}. ` +
					"Double-check the URL in Settings → Publish to Web.",
					7000,
				);
			}
		} catch (err) {
			new Notice(
				`Player Vault: deploy request failed – ${(err as Error).message}`,
				7000,
			);
		}
	}

	/** Full vault export implementation */
	async exportVault(onProgress?: (current: number, total: number, name: string) => void) {
		const { vault } = this.app;
		const profile = getActiveProfile(this.settings);
		const outputFolder = normalizePath(profile.outputFolder);

		// Gather all markdown files
		const allFiles = vault.getMarkdownFiles();

		// ── Pass 1: determine which notes survive ────────────────────────────
		const survivingNotes: Map<
			string,
			{ file: TFile; sanitized: string; outputFilename: string }
		> = new Map();

		const extraPatterns = compileExtraPatterns(profile.extraSecretPatterns);

		for (const file of allFiles) {
			const raw = await vault.read(file);

			if (isNotePublishBlocked(raw)) continue;
			if (isNoteFullySecret(raw)) continue;
			if (isNoteExcludedByFolder(file.path, profile.excludedFolders)) continue;
			if (!isNoteIncludedByTag(raw, profile.inclusionTag)) continue;

			const sanitized = sanitizeContent(raw, {
				extraPatterns,
				stripAllComments: profile.stripAllComments,
			});

			const outputFilename = filePathToOutputName(file.path);
			survivingNotes.set(file.path, { file, sanitized, outputFilename });
		}

		// ── Build the exported-note map (lowercase basename → output filename) ──
		// Wiki-links reference notes by basename, so we map basename → filename.
		// When two notes share a basename the first encountered wins; both notes
		// are still exported, but wiki-links will only resolve to one of them.
		const exportedNoteMap: ExportedNoteMap = new Map();
		for (const { file, outputFilename } of survivingNotes.values()) {
			const key = file.basename.toLowerCase();
			if (exportedNoteMap.has(key)) {
				console.warn(
					`Player Vault: basename collision – "${file.path}" shares basename ` +
					`"${file.basename}" with another note. Wiki-links to this basename ` +
					`will resolve to the first-encountered note.`
				);
			} else {
				exportedNoteMap.set(key, outputFilename);
			}
		}

		// ── Ensure output folder exists ────────────────────────────────────
		if (!(await vault.adapter.exists(outputFolder))) {
			await vault.adapter.mkdir(outputFolder);
		}

		// ── Build v1.3 navigation data ─────────────────────────────────────
		const sidebarEntries = buildSidebarEntries(survivingNotes);
		const backLinksMap = buildBackLinksMap(survivingNotes, exportedNoteMap);
		const searchEntries: SearchEntry[] = [...survivingNotes.values()].map(({ file, sanitized }) => ({
			name: file.basename,
			filename: filePathToOutputName(file.path),
			text: sanitized
				.replace(/%%.*?%%/gs, "")
				.replace(/[#*_`>[\]!|]/g, "")
				.replace(/\s+/g, " ")
				.trim()
				.slice(0, 500),
		}));

		// ── v2.0 Incremental export cache ─────────────────────────────────
		const locale = (this.settings.locale ?? "en") as PvLocale;
		let prevCache: ExportCache | null = null;
		if (profile.incrementalExport) {
			try {
				const cachePath = normalizePath(`${outputFolder}/.pv-cache.json`);
				if (await vault.adapter.exists(cachePath)) {
					const raw = await vault.adapter.read(cachePath);
					const parsed = JSON.parse(raw);
					if (parsed.version === 2) prevCache = parsed as ExportCache;
				}
			} catch { /* ignore malformed cache */ }
		}
		// Invalidate if the surviving-note count changed (notes added/removed)
		const cacheValid = prevCache !== null && prevCache.noteCount === survivingNotes.size;

		// ── Pass 2: convert each note to HTML and write ────────────────────
		const indexEntries: Array<{ name: string; filename: string }> = [];
		let exportCount = 0;
		let incrementalSkipped = 0;
		const exportTotal = survivingNotes.size;

		for (const [, { file, sanitized, outputFilename }] of survivingNotes) {
			exportCount++;
			onProgress?.(exportCount, exportTotal, file.basename);

			// Incremental: skip if mtime unchanged
			if (cacheValid && prevCache!.entries[file.path] === file.stat.mtime) {
				indexEntries.push({ name: file.basename, filename: outputFilename });
				incrementalSkipped++;
				continue;
			}

			const htmlBody = markdownToHtml(sanitized, exportedNoteMap);
			const fullPage = wrapInPage(file.basename, htmlBody, {
				sidebarEntries,
				backLinks: backLinksMap.get(outputFilename) ?? [],
				vaultPath: file.path,
				customCss: profile.customCss,
				locale,
			});
			const outPath = normalizePath(`${outputFolder}/${outputFilename}`);
			await vault.adapter.write(outPath, fullPage);
			indexEntries.push({ name: file.basename, filename: outputFilename });
		}

		if (incrementalSkipped > 0) {
			console.log(`Player Vault: incremental export — skipped ${incrementalSkipped} unchanged note(s).`);
		}

		indexEntries.sort((a, b) => a.name.localeCompare(b.name));

		// ── Write index page ────────────────────────────────────────────────────
		const indexHtml = buildIndexPage(indexEntries, { sidebarEntries, customCss: profile.customCss, locale });
		await vault.adapter.write(
			normalizePath(`${outputFolder}/index.html`),
			indexHtml
		);

		// ── Write stylesheet & search scripts ─────────────────────────────
		await vault.adapter.write(
			normalizePath(`${outputFolder}/styles.css`),
			EXPORT_CSS
		);
		await vault.adapter.write(
			normalizePath(`${outputFolder}/search-index.js`),
			buildSearchIndexJs(searchEntries)
		);
		await vault.adapter.write(
			normalizePath(`${outputFolder}/search.js`),
			SEARCH_JS
		);
		// ── Write export manifest ─────────────────────────────────────
		const manifest = {
			exportedAt: new Date().toISOString(),
			profile: profile.name,
			noteCount: indexEntries.length,
			notes: indexEntries.map((e) => ({
				name: e.name,
				filename: e.filename,
				path: [...survivingNotes.values()].find((v) => v.outputFilename === e.filename)?.file.path ?? "",
			})),
		};
		await vault.adapter.write(
			normalizePath(`${outputFolder}/_export-manifest.json`),
			JSON.stringify(manifest, null, "\t")
		);

		// ── Write incremental cache ───────────────────────────────────────────
		if (profile.incrementalExport) {
			const newCache: ExportCache = {
				version: 2,
				noteCount: survivingNotes.size,
				entries: Object.fromEntries(
					[...survivingNotes.values()].map(({ file }) => [file.path, file.stat.mtime])
				),
			};
			await vault.adapter.write(
				normalizePath(`${outputFolder}/.pv-cache.json`),
				JSON.stringify(newCache, null, "\t")
			);
		}
	}
}
