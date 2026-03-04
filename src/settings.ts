import { App, PluginSettingTab, Setting, setIcon } from "obsidian";
import { WelcomeModal } from "./onboarding";
import PlayerVaultPlugin from "./main";

/** Settings persisted in data.json */
export interface PlayerVaultSettings {
	/** Folder (relative to vault root) where the HTML export will be written */
	outputFolder: string;
	/**
	 * Extra secret-tag patterns entered by the user as regex strings.
	 * Stored as strings and compiled at runtime.
	 */
	extraSecretPatterns: string[];
	/** Whether to strip ALL Obsidian comment blocks (%% … %%), not just secret ones */
	stripAllComments: boolean;
	/** Whether to open the output folder in the system file browser after export */
	openAfterExport: boolean;
	/** Whether the user has already seen the first-run welcome wizard */
	hasSeenWelcome: boolean;
}

export const DEFAULT_SETTINGS: PlayerVaultSettings = {
	outputFolder: "player-vault-export",
	extraSecretPatterns: [],
	stripAllComments: false,
	openAfterExport: false,
	hasSeenWelcome: false,
};

/** Build the list of compiled extra patterns from settings strings. */
export function compileExtraPatterns(patterns: string[]): RegExp[] {
	return patterns
		.filter((p) => p.trim().length > 0)
		.map((p) => {
			try {
				return new RegExp(p, "gis");
			} catch {
				return null;
			}
		})
		.filter((r): r is RegExp => r !== null);
}

/** Settings tab rendered in Obsidian's "Plugin Options" panel */
export class PlayerVaultSettingTab extends PluginSettingTab {
	plugin: PlayerVaultPlugin;

	/** Export-path hint label — kept as a ref so it refreshes live */
	private exportHintEl: HTMLElement | null = null;
	/** Pattern-manager container — rebuilt in-place on every add/delete */
	private patternManagerEl: HTMLElement | null = null;

	constructor(app: App, plugin: PlayerVaultPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		// ── Banner ─────────────────────────────────────────────────────────
		const banner = containerEl.createEl("div", { cls: "pv-settings-banner" });
		const bannerIcon = banner.createEl("div", { cls: "pv-settings-banner-icon" });
		setIcon(bannerIcon, "book-open");
		const bannerText = banner.createEl("div");
		bannerText.createEl("div", {
			cls: "pv-settings-banner-title",
			text: "Player Vault",
		});
		bannerText.createEl("div", {
			cls: "pv-settings-banner-sub",
			text: "Export a secrets-stripped HTML wiki for your players",
		});

		// ── Quick export CTA ───────────────────────────────────────────────
		const exportRow = containerEl.createEl("div", { cls: "pv-export-row" });
		const exportBtn = exportRow.createEl("button", {
			cls: "pv-export-btn mod-cta",
			text: "⚡  Run Export Now",
		});
		exportBtn.addEventListener("click", () => this.plugin.runExport());
		this.exportHintEl = exportRow.createEl("span", {
			cls: "pv-export-hint",
			text: `Output: ${this.plugin.settings.outputFolder}/`,
		});

		// ══════════════════════════════════════════════════════════════════
		// Section: Export
		// ══════════════════════════════════════════════════════════════════
		this.sectionHeader(containerEl, "Export", "folder-output");

		new Setting(containerEl)
			.setName("Output folder")
			.setDesc(
				"Vault-relative path where HTML files are written. The folder is created automatically if it does not exist."
			)
			.addText((text) => {
				text.inputEl.style.width = "240px";
				text
					.setPlaceholder("player-vault-export")
					.setValue(this.plugin.settings.outputFolder)
					.onChange(async (value) => {
						this.plugin.settings.outputFolder =
							value.trim() || "player-vault-export";
						await this.plugin.saveSettings();
						if (this.exportHintEl) {
							this.exportHintEl.textContent = `Output: ${this.plugin.settings.outputFolder}/`;
						}
					});
			});

		new Setting(containerEl)
			.setName("Open folder after export")
			.setDesc(
				"Reveal the output folder in Explorer (Windows) or Finder (Mac) when the export finishes."
			)
			.addToggle((t) =>
				t
					.setValue(this.plugin.settings.openAfterExport)
					.onChange(async (v) => {
						this.plugin.settings.openAfterExport = v;
						await this.plugin.saveSettings();
					})
			);

		// ══════════════════════════════════════════════════════════════════
		// Section: Content Filtering
		// ══════════════════════════════════════════════════════════════════
		this.sectionHeader(containerEl, "Content Filtering", "filter");

		new Setting(containerEl)
			.setName("Strip all Obsidian comments")
			.setDesc(
				"When enabled, every %% … %% block is removed — not just %%SECRET%% and %%GM%% ones. " +
				"Useful for hiding work-in-progress notes or inline annotations."
			)
			.addToggle((t) =>
				t
					.setValue(this.plugin.settings.stripAllComments)
					.onChange(async (v) => {
						this.plugin.settings.stripAllComments = v;
						await this.plugin.saveSettings();
					})
			);

		// ── Custom pattern manager ─────────────────────────────────────────
		const patternLabel = containerEl.createEl("div", {
			cls: "pv-pattern-label",
		});
		patternLabel.createEl("span", {
			cls: "pv-pattern-label-name",
			text: "Extra secret patterns",
		});
		patternLabel.createEl("span", {
			cls: "pv-pattern-label-desc",
			text: "Custom regex patterns to strip on export. Add as many as you need — each is validated as you type.",
		});

		this.patternManagerEl = containerEl.createEl("div", {
			cls: "pv-pattern-manager",
		});
		this.renderPatternManager();

		// ══════════════════════════════════════════════════════════════════
		// Section: Help
		// ══════════════════════════════════════════════════════════════════
		this.sectionHeader(containerEl, "Help", "help-circle");

		new Setting(containerEl)
			.setName("Show welcome guide")
			.setDesc(
				"Reopen the step-by-step wizard that covers tagging methods and all settings."
			)
			.addButton((btn) =>
				btn.setButtonText("Open Guide").onClick(() => {
					new WelcomeModal(this.app, async () => {
						this.plugin.settings.hasSeenWelcome = true;
						await this.plugin.saveSettings();
					}).open();
				})
			);

		new Setting(containerEl)
			.setName("Documentation & source code")
			.setDesc("Full README, changelog, and issue tracker on GitHub.")
			.addButton((btn) =>
				btn.setButtonText("Open GitHub").onClick(() => {
					window.open(
						"https://github.com/tescolopio/Obsidian_PlayerVault",
						"_blank"
					);
				})
			);
	}

	// ── Private helpers ────────────────────────────────────────────────────

	/** Render a styled section divider with an icon and label. */
	private sectionHeader(
		parent: HTMLElement,
		text: string,
		icon: string
	): void {
		const row = parent.createEl("div", { cls: "pv-section-header" });
		const iconEl = row.createEl("span", { cls: "pv-section-icon" });
		setIcon(iconEl, icon);
		row.createEl("span", { text });
	}

	/**
	 * Build or rebuild the pattern management widget inside
	 * `this.patternManagerEl`. Called on initial display and after
	 * every add / delete action.
	 */
	private renderPatternManager(): void {
		const container = this.patternManagerEl;
		if (!container) return;
		container.empty();

		const patterns = this.plugin.settings.extraSecretPatterns;

		// ── Existing patterns ──────────────────────────────────────────
		if (patterns.length === 0) {
			container.createEl("p", {
				cls: "pv-pattern-empty",
				text: "No custom patterns — the built-in %%SECRET%%, %%GM%%, and > [!gm-only] markers are always active.",
			});
		} else {
			const list = container.createEl("div", { cls: "pv-pattern-list" });
			for (let i = 0; i < patterns.length; i++) {
				const row = list.createEl("div", { cls: "pv-pattern-row" });

				let valid = true;
				try {
					new RegExp(patterns[i], "gis");
				} catch {
					valid = false;
				}

				row.createEl("span", {
					cls: "pv-pattern-badge " + (valid ? "pv-badge-ok" : "pv-badge-err"),
					text: valid ? "✓" : "✗",
					attr: { title: valid ? "Valid regex" : "Invalid regex — will be ignored" },
				});
				row.createEl("code", {
					cls: "pv-pattern-text",
					text: patterns[i],
					attr: { title: patterns[i] },
				});

				const del = row.createEl("button", {
					cls: "pv-pattern-del",
					text: "×",
					attr: { "aria-label": "Remove this pattern" },
				});
				const idx = i;
				del.addEventListener("click", async () => {
					this.plugin.settings.extraSecretPatterns.splice(idx, 1);
					await this.plugin.saveSettings();
					this.renderPatternManager();
				});
			}
		}

		// ── Add-pattern row ────────────────────────────────────────────
		const addRow = container.createEl("div", { cls: "pv-pattern-add-row" });
		const input = addRow.createEl("input", {
			type: "text",
			cls: "pv-pattern-input",
		}) as HTMLInputElement;
		input.placeholder = "%%SPOILER%%[\\s\\S]*?%%SPOILER%%";

		const addBtn = addRow.createEl("button", {
			cls: "pv-pattern-add-btn",
			text: "Add",
		});
		const feedback = container.createEl("span", {
			cls: "pv-pattern-feedback",
		});

		// Live validation
		input.addEventListener("input", () => {
			const val = input.value.trim();
			if (!val) {
				feedback.textContent = "";
				feedback.className = "pv-pattern-feedback";
				return;
			}
			try {
				new RegExp(val, "gis");
				feedback.textContent = "✓ valid regex";
				feedback.className = "pv-pattern-feedback pv-feedback-ok";
			} catch (e) {
				feedback.textContent = `✗ ${(e as Error).message}`;
				feedback.className = "pv-pattern-feedback pv-feedback-err";
			}
		});

		const doAdd = async () => {
			const val = input.value.trim();
			if (!val) return;
			try {
				new RegExp(val, "gis");
				this.plugin.settings.extraSecretPatterns.push(val);
				await this.plugin.saveSettings();
				input.value = "";
				feedback.textContent = "";
				this.renderPatternManager();
			} catch (e) {
				feedback.textContent = `Cannot add — invalid regex: ${(e as Error).message}`;
				feedback.className = "pv-pattern-feedback pv-feedback-err";
			}
		};

		addBtn.addEventListener("click", doAdd);
		input.addEventListener("keydown", (e) => {
			if ((e as KeyboardEvent).key === "Enter") doAdd();
		});
	}
}
