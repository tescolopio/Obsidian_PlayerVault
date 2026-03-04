import {
	App,
	FileSystemAdapter,
	Modal,
	Notice,
	Plugin,
	TFile,
	normalizePath,
} from "obsidian";
import {
	PlayerVaultSettings,
	DEFAULT_SETTINGS,
	PlayerVaultSettingTab,
	compileExtraPatterns,
} from "./settings";
import { sanitizeContent, isNoteFullySecret } from "./sanitizer";
import {
	markdownToHtml,
	wrapInPage,
	buildIndexPage,
	filePathToOutputName,
	ExportedNoteMap,
} from "./exporter";
import { WelcomeModal } from "./onboarding";

/** CSS embedded in the export output folder as styles.css */
const EXPORT_CSS = `/* Player Vault – exported wiki styles */
*, *::before, *::after { box-sizing: border-box; }
body {
  font-family: Georgia, "Times New Roman", serif;
  background: #1a1a2e;
  color: #e0e0e0;
  margin: 0;
  padding: 0;
}
header {
  background: #16213e;
  padding: 1rem 2rem;
  border-bottom: 2px solid #e94560;
}
header h1 { margin: 0; color: #e94560; font-size: 1.4rem; }
header nav a {
  color: #a8dadc;
  text-decoration: none;
  margin-right: 1rem;
}
header nav a:hover { text-decoration: underline; }
.layout { display: flex; min-height: 100vh; }
aside.sidebar {
  width: 240px;
  background: #16213e;
  padding: 1rem;
  border-right: 1px solid #0f3460;
  overflow-y: auto;
}
aside.sidebar h2 { color: #e94560; font-size: 1rem; margin-top: 0; }
aside.sidebar ul { list-style: none; padding: 0; margin: 0; }
aside.sidebar ul li a {
  display: block;
  padding: 0.3rem 0.5rem;
  color: #a8dadc;
  text-decoration: none;
  border-radius: 4px;
}
aside.sidebar ul li a:hover { background: #0f3460; }
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
ul.note-index { list-style: none; padding: 0; }
ul.note-index li { margin: 0.4rem 0; }
ul.note-index li a { color: #a8dadc; text-decoration: none; }
ul.note-index li a:hover { text-decoration: underline; }
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

export default class PlayerVaultPlugin extends Plugin {
	settings!: PlayerVaultSettings;

	async onload() {
		await this.loadSettings();

		// Ribbon icon
		this.addRibbonIcon("book-open", "Export Player Vault", () => {
			this.runExport();
		});

		// Command palette command
		this.addCommand({
			id: "export-player-vault",
			name: "Export Player Vault to HTML",
			callback: () => {
				this.runExport();
			},
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
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData()
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	/** Main export pipeline */
	async runExport() {
		const progress = new ExportProgressModal(this.app);
		progress.open();

		try {
			await this.exportVault((current, total, name) => {
				progress.setProgress(current, total, name);
			});
			progress.close();
			new Notice("Player Vault: export complete! ✅", 4000);

			if (this.settings.openAfterExport) {
				const { adapter } = this.app.vault;
				if (!(adapter instanceof FileSystemAdapter)) {
					new Notice("Player Vault: cannot open folder – not a filesystem vault.", 4000);
					return;
				}
				const outputPath = normalizePath(
					`${adapter.getBasePath()}/${this.settings.outputFolder}`
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

	/** Full vault export implementation */
	async exportVault(onProgress?: (current: number, total: number, name: string) => void) {
		const { vault } = this.app;
		const outputFolder = normalizePath(this.settings.outputFolder);

		// Gather all markdown files
		const allFiles = vault.getMarkdownFiles();

		// ── Pass 1: determine which notes survive sanitization ─────────────
		const survivingNotes: Map<
			string,
			{ file: TFile; sanitized: string; outputFilename: string }
		> = new Map();

		const extraPatterns = compileExtraPatterns(
			this.settings.extraSecretPatterns
		);

		for (const file of allFiles) {
			const raw = await vault.read(file);

			if (isNoteFullySecret(raw)) continue;

			const sanitized = sanitizeContent(raw, {
				extraPatterns,
				stripAllComments: this.settings.stripAllComments,
			});

			// Key by full path (unique) to prevent basename collisions.
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

		// ── Pass 2: convert each note to HTML and write ────────────────────
		const indexEntries: Array<{ name: string; filename: string }> = [];
			let exportCount = 0;
			const exportTotal = survivingNotes.size;

			for (const [, { file, sanitized, outputFilename }] of survivingNotes) {
				exportCount++;
				onProgress?.(exportCount, exportTotal, file.basename);
			const htmlBody = markdownToHtml(sanitized, exportedNoteMap);
			const fullPage = wrapInPage(file.basename, htmlBody);
			const outPath = normalizePath(`${outputFolder}/${outputFilename}`);
			await vault.adapter.write(outPath, fullPage);
			indexEntries.push({ name: file.basename, filename: outputFilename });
		}

		indexEntries.sort((a, b) => a.name.localeCompare(b.name));

		// ── Write index page ────────────────────────────────────────────────────
		const indexHtml = buildIndexPage(indexEntries);
		await vault.adapter.write(
			normalizePath(`${outputFolder}/index.html`),
			indexHtml
		);

		// ── Write stylesheet ───────────────────────────────────────────────
		await vault.adapter.write(
			normalizePath(`${outputFolder}/styles.css`),
			EXPORT_CSS
		);
	}
}
