import { App, FuzzySuggestModal, PluginSettingTab, Setting, TFolder, TextComponent, setIcon } from "obsidian";
import { WelcomeModal } from "./onboarding";
import PlayerVaultPlugin from "./main";

/** A named export configuration. All per-export options live here. */
export interface ExportProfile {
	id: string;
	name: string;
	/** Vault-relative output folder path */
	outputFolder: string;
	/** Vault folder paths whose contents are excluded entirely */
	excludedFolders: string[];
	/**
	 * Only export notes that carry this Obsidian tag (e.g. "#player-facing").
	 * Empty string = no filter, export all surviving notes.
	 */
	inclusionTag: string;
	/** Extra secret-tag regex strings stripped on export */
	extraSecretPatterns: string[];
	/** Strip ALL %% … %% blocks, not just %%SECRET%%/%%GM%% ones */
	stripAllComments: boolean;
}

/** Settings persisted in data.json */
export interface PlayerVaultSettings {
	profiles: ExportProfile[];
	activeProfileId: string;
	/** Whether to open the output folder in the system file browser after export */
	openAfterExport: boolean;
	/** Whether the user has already seen the first-run welcome wizard */
	hasSeenWelcome: boolean;
}

export const DEFAULT_PROFILE: ExportProfile = {
	id: "default",
	name: "Default",
	outputFolder: "player-vault-export",
	excludedFolders: [],
	inclusionTag: "",
	extraSecretPatterns: [],
	stripAllComments: false,
};

export const DEFAULT_SETTINGS: PlayerVaultSettings = {
	profiles: [{ ...DEFAULT_PROFILE }],
	activeProfileId: "default",
	openAfterExport: false,
	hasSeenWelcome: false,
};

/** Return the active profile, falling back to the first profile or a default. */
export function getActiveProfile(settings: PlayerVaultSettings): ExportProfile {
	return (
		settings.profiles.find((p) => p.id === settings.activeProfileId) ??
		settings.profiles[0] ??
		{ ...DEFAULT_PROFILE }
	);
}

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
	/** Excluded-folders manager container */
	private excludedFoldersEl: HTMLElement | null = null;

	constructor(app: App, plugin: PlayerVaultPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		const profile = getActiveProfile(this.plugin.settings);

		// ── Banner ─────────────────────────────────────────────────────────
		const banner = containerEl.createEl("div", { cls: "pv-settings-banner" });
		const bannerIcon = banner.createEl("div", { cls: "pv-settings-banner-icon" });
		setIcon(bannerIcon, "book-open");
		const bannerText = banner.createEl("div");
		bannerText.createEl("div", { cls: "pv-settings-banner-title", text: "Player Vault" });
		bannerText.createEl("div", {
			cls: "pv-settings-banner-sub",
			text: "Export a secrets-stripped HTML wiki for your players",
		});

		// ── Quick export CTA ───────────────────────────────────────────────
		const exportRow = containerEl.createEl("div", { cls: "pv-export-row" });
		const exportBtn = exportRow.createEl("button", { cls: "pv-export-btn mod-cta", text: "⚡  Run Export Now" });
		exportBtn.addEventListener("click", () => this.plugin.runExport());
		const dryRunBtn = exportRow.createEl("button", { cls: "pv-export-btn", text: "🐾  Dry Run" });
		dryRunBtn.addEventListener("click", () => this.plugin.runDryRun());
		this.exportHintEl = exportRow.createEl("span", {
			cls: "pv-export-hint",
			text: `Profile: ${profile.name} → ${profile.outputFolder}/`,
		});

		// ══════════════════════════════════════════════════════════════════
		// Section: Profiles
		// ══════════════════════════════════════════════════════════════════
		this.sectionHeader(containerEl, "Profiles", "layers");

		new Setting(containerEl)
			.setName("Active profile")
			.setDesc("Switch between named export configurations. Each profile has its own output folder, filters, and patterns.")
			.addDropdown((dd) => {
				for (const p of this.plugin.settings.profiles) dd.addOption(p.id, p.name);
				dd.setValue(this.plugin.settings.activeProfileId);
				dd.onChange(async (id) => {
					this.plugin.settings.activeProfileId = id;
					await this.plugin.saveSettings();
					this.display();
				});
			})
			.addButton((btn) =>
				btn.setButtonText("New").setTooltip("Duplicate current profile").onClick(async () => {
					const src = getActiveProfile(this.plugin.settings);
					const newId = `profile-${Date.now()}`;
					const copy: ExportProfile = { ...src, id: newId, name: `${src.name} (copy)`, excludedFolders: [...src.excludedFolders], extraSecretPatterns: [...src.extraSecretPatterns] };
					this.plugin.settings.profiles.push(copy);
					this.plugin.settings.activeProfileId = newId;
					await this.plugin.saveSettings();
					this.display();
				})
			)
			.addButton((btn) => {
				btn.setButtonText("Delete").setTooltip("Delete current profile").setDisabled(this.plugin.settings.profiles.length <= 1);
				btn.buttonEl.addClass("mod-warning");
				btn.onClick(async () => {
					if (this.plugin.settings.profiles.length <= 1) return;
					this.plugin.settings.profiles = this.plugin.settings.profiles.filter(
						(p) => p.id !== this.plugin.settings.activeProfileId
					);
					this.plugin.settings.activeProfileId = this.plugin.settings.profiles[0].id;
					await this.plugin.saveSettings();
					this.display();
				});
			});

		new Setting(containerEl)
			.setName("Profile name")
			.setDesc("Rename the active profile.")
			.addText((text) =>
				text.setValue(profile.name).onChange(async (v) => {
					profile.name = v.trim() || "Unnamed";
					await this.plugin.saveSettings();
				})
			);

		// ══════════════════════════════════════════════════════════════════
		// Section: Export
		// ══════════════════════════════════════════════════════════════════
		this.sectionHeader(containerEl, "Export", "folder-output");

		let folderText!: TextComponent;
		new Setting(containerEl)
			.setName("Output folder")
			.setDesc("Vault-relative path where HTML files are written. The folder is created automatically if it does not exist.")
			.addText((text) => {
				folderText = text;
				text.inputEl.style.width = "200px";
				text
					.setPlaceholder("player-vault-export")
					.setValue(profile.outputFolder)
					.onChange(async (value) => {
						profile.outputFolder = value.trim() || "player-vault-export";
						await this.plugin.saveSettings();
						if (this.exportHintEl)
							this.exportHintEl.textContent = `Profile: ${profile.name} → ${profile.outputFolder}/`;
					});
			})
			.addButton((btn) => {
				btn.setButtonText("Browse").setTooltip("Pick an existing vault folder").onClick(() => {
					new FolderSuggestModal(this.app, async (folder) => {
						const path = folder.path || "/";
						profile.outputFolder = path;
						await this.plugin.saveSettings();
						folderText.setValue(path);
						if (this.exportHintEl)
							this.exportHintEl.textContent = `Profile: ${profile.name} → ${path}/`;
					}).open();
				});
			});

		new Setting(containerEl)
			.setName("Open folder after export")
			.setDesc("Reveal the output folder in Explorer (Windows) or Finder (Mac) when the export finishes.")
			.addToggle((t) =>
				t.setValue(this.plugin.settings.openAfterExport).onChange(async (v) => {
					this.plugin.settings.openAfterExport = v;
					await this.plugin.saveSettings();
				})
			);

		// ══════════════════════════════════════════════════════════════════
		// Section: Content Filtering
		// ══════════════════════════════════════════════════════════════════
		this.sectionHeader(containerEl, "Content Filtering", "filter");

		new Setting(containerEl)
			.setName("Excluded folders")
			.setDesc("Notes inside these vault folders are excluded from the export entirely (treated as GM-only).")
			.addButton((btn) =>
				btn.setButtonText("Add Folder").onClick(() => {
					new FolderSuggestModal(this.app, async (folder) => {
						const path = folder.path || "/";
						if (!profile.excludedFolders.includes(path)) {
							profile.excludedFolders.push(path);
							await this.plugin.saveSettings();
							this.renderExcludedFoldersManager();
						}
					}).open();
				})
			);
		this.excludedFoldersEl = containerEl.createEl("div", { cls: "pv-pattern-manager" });
		this.renderExcludedFoldersManager();

		new Setting(containerEl)
			.setName("Inclusion tag")
			.setDesc("Only export notes that carry this tag (e.g. #player-facing). Leave blank to export all notes.")
			.addText((text) =>
				text
					.setPlaceholder("#player-facing")
					.setValue(profile.inclusionTag)
					.onChange(async (v) => {
						profile.inclusionTag = v.trim();
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Strip all Obsidian comments")
			.setDesc(
				"When enabled, every %% … %% block is removed — not just %%SECRET%% and %%GM%% ones. " +
				"Useful for hiding work-in-progress notes or inline annotations."
			)
			.addToggle((t) =>
				t.setValue(profile.stripAllComments).onChange(async (v) => {
					profile.stripAllComments = v;
					await this.plugin.saveSettings();
				})
			);

		// ── Custom pattern manager ─────────────────────────────────────────
		const patternLabel = containerEl.createEl("div", { cls: "pv-pattern-label" });
		patternLabel.createEl("span", { cls: "pv-pattern-label-name", text: "Extra secret patterns" });
		patternLabel.createEl("span", {
			cls: "pv-pattern-label-desc",
			text: "Custom regex patterns to strip on export. Add as many as you need — each is validated as you type.",
		});
		this.patternManagerEl = containerEl.createEl("div", { cls: "pv-pattern-manager" });
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
	private renderExcludedFoldersManager(): void {
		const container = this.excludedFoldersEl;
		if (!container) return;
		container.empty();
		const profile = getActiveProfile(this.plugin.settings);
		if (profile.excludedFolders.length === 0) {
			container.createEl("p", { cls: "pv-pattern-empty", text: "No excluded folders — all vault folders are included." });
			return;
		}
		const list = container.createEl("div", { cls: "pv-pattern-list" });
		for (let i = 0; i < profile.excludedFolders.length; i++) {
			const row = list.createEl("div", { cls: "pv-pattern-row" });
			row.createEl("code", { cls: "pv-pattern-text", text: profile.excludedFolders[i] });
			const del = row.createEl("button", { cls: "pv-pattern-del", text: "×", attr: { "aria-label": "Remove" } });
			const idx = i;
			del.addEventListener("click", async () => {
				profile.excludedFolders.splice(idx, 1);
				await this.plugin.saveSettings();
				this.renderExcludedFoldersManager();
			});
		}
	}

	private renderPatternManager(): void {
		const container = this.patternManagerEl;
		if (!container) return;
		container.empty();

		const profile = getActiveProfile(this.plugin.settings);
		const patterns = profile.extraSecretPatterns;

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
					getActiveProfile(this.plugin.settings).extraSecretPatterns.splice(idx, 1);
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
				getActiveProfile(this.plugin.settings).extraSecretPatterns.push(val);
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

/** Fuzzy folder picker opened by the Output folder Browse button. */
class FolderSuggestModal extends FuzzySuggestModal<TFolder> {
	private cb: (folder: TFolder) => void;

	constructor(app: App, cb: (folder: TFolder) => void) {
		super(app);
		this.cb = cb;
		this.setPlaceholder("Type to filter folders…");
	}

	getItems(): TFolder[] {
		const folders: TFolder[] = [];
		const walk = (folder: TFolder) => {
			folders.push(folder);
			for (const child of folder.children) {
				if (child instanceof TFolder) walk(child);
			}
		};
		walk(this.app.vault.getRoot());
		return folders.sort((a, b) => a.path.localeCompare(b.path));
	}

	getItemText(folder: TFolder): string {
		return folder.path || "/";
	}

	onChooseItem(folder: TFolder): void {
		this.cb(folder);
	}
}
