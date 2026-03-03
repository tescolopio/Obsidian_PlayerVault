import { App, PluginSettingTab, Setting } from "obsidian";
import PlayerVaultPlugin from "./main";

/** Settings persisted in data.json */
export interface PlayerVaultSettings {
	/** Folder (relative to vault root) where the HTML export will be written */
	outputFolder: string;
	/**
	 * Extra secret-tag patterns entered by the user as regex strings.
	 * Each entry is stored as a string and compiled into a RegExp at runtime.
	 */
	extraSecretPatterns: string[];
	/** Whether to strip ALL Obsidian comment blocks (%% … %%), not just secret ones */
	stripAllComments: boolean;
	/** Whether to open the output folder in the system file browser after export */
	openAfterExport: boolean;
}

export const DEFAULT_SETTINGS: PlayerVaultSettings = {
	outputFolder: "player-vault-export",
	extraSecretPatterns: [],
	stripAllComments: false,
	openAfterExport: false,
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

	constructor(app: App, plugin: PlayerVaultPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl("h2", { text: "Player Vault Settings" });

		// ── Output folder ────────────────────────────────────────────────────
		new Setting(containerEl)
			.setName("Output folder")
			.setDesc(
				"Folder path (relative to vault root) where the HTML wiki will be exported."
			)
			.addText((text) =>
				text
					.setPlaceholder("player-vault-export")
					.setValue(this.plugin.settings.outputFolder)
					.onChange(async (value) => {
						this.plugin.settings.outputFolder = value.trim() || "player-vault-export";
						await this.plugin.saveSettings();
					})
			);

		// ── Extra secret patterns ────────────────────────────────────────────
		new Setting(containerEl)
			.setName("Extra secret patterns")
			.setDesc(
				"Comma-separated regular expressions. Any text matching these patterns will be stripped from the export. " +
				"Example: %%HIDDEN%%[\\s\\S]*?%%HIDDEN%%"
			)
			.addTextArea((ta) =>
				ta
					.setPlaceholder("%%HIDDEN%%[\\s\\S]*?%%HIDDEN%%")
					.setValue(this.plugin.settings.extraSecretPatterns.join(", "))
					.onChange(async (value) => {
						this.plugin.settings.extraSecretPatterns = value
							.split(",")
							.map((s) => s.trim())
							.filter((s) => s.length > 0);
						await this.plugin.saveSettings();
					})
			);

		// ── Strip all comments ───────────────────────────────────────────────
		new Setting(containerEl)
			.setName("Strip all Obsidian comments")
			.setDesc(
				"When enabled, all %% … %% comment blocks are removed from the export, not just secret ones."
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.stripAllComments)
					.onChange(async (value) => {
						this.plugin.settings.stripAllComments = value;
						await this.plugin.saveSettings();
					})
			);

		// ── Open after export ────────────────────────────────────────────────
		new Setting(containerEl)
			.setName("Open folder after export")
			.setDesc("Reveal the output folder in the system file browser once the export finishes.")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.openAfterExport)
					.onChange(async (value) => {
						this.plugin.settings.openAfterExport = value;
						await this.plugin.saveSettings();
					})
			);
	}
}
