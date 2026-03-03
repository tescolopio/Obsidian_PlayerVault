import {
	App,
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
	ExportedNoteSet,
} from "./exporter";

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
		const notice = new Notice("Player Vault: starting export…", 0);

		try {
			await this.exportVault();
			notice.hide();
			new Notice("Player Vault: export complete! ✅", 4000);

			if (this.settings.openAfterExport) {
				// Use Electron shell to open the output folder
				const outputPath = normalizePath(
					`${(this.app.vault.adapter as any).basePath}/${this.settings.outputFolder}`
				);
				(window as any).require("electron").shell.openPath(outputPath);
			}
		} catch (err) {
			notice.hide();
			console.error("Player Vault export error:", err);
			new Notice(
				`Player Vault: export failed – ${(err as Error).message}`,
				6000
			);
		}
	}

	/** Full vault export implementation */
	async exportVault() {
		const { vault } = this.app;
		const outputFolder = normalizePath(this.settings.outputFolder);

		// Gather all markdown files
		const allFiles = vault.getMarkdownFiles();

		// ── Pass 1: determine which notes survive sanitization ─────────────
		const survivingNotes: Map<string, { file: TFile; sanitized: string }> =
			new Map();

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

			// Use the note name (without extension) as the key
			survivingNotes.set(file.basename, { file, sanitized });
		}

		// ── Build the exported-note set (lower-cased) ──────────────────────
		const exportedNoteSet: ExportedNoteSet = new Set(
			Array.from(survivingNotes.keys()).map((n) => n.toLowerCase())
		);

		// ── Ensure output folder exists ────────────────────────────────────
		if (!(await vault.adapter.exists(outputFolder))) {
			await vault.adapter.mkdir(outputFolder);
		}

		// ── Pass 2: convert each note to HTML and write ────────────────────
		const sortedNames: string[] = [];

		for (const [name, { sanitized }] of survivingNotes) {
			const htmlBody = markdownToHtml(sanitized, exportedNoteSet);
			const fullPage = wrapInPage(name, htmlBody);
			const outPath = normalizePath(`${outputFolder}/${name}.html`);
			await vault.adapter.write(outPath, fullPage);
			sortedNames.push(name);
		}

		sortedNames.sort((a, b) => a.localeCompare(b));

		// ── Write index page ───────────────────────────────────────────────
		const indexHtml = buildIndexPage(sortedNames);
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
