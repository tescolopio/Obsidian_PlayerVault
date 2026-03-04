/**
 * WelcomeModal – a four-step onboarding wizard shown on first install.
 *
 * Intentionally has NO imports from other local plugin files to avoid
 * circular dependency chains (settings → onboarding → main → settings).
 * All inter-plugin coordination is handled via a plain async callback.
 */

import { App, Modal, setIcon } from "obsidian";

interface Step {
	title: string;
	icon: string;
	render: (el: HTMLElement) => void;
}

export class WelcomeModal extends Modal {
	private step = 0;
	private readonly onComplete: () => Promise<void>;
	private readonly steps: Step[];

	/**
	 * @param app        Obsidian App instance
	 * @param onComplete Called when the user clicks "Get Started" on the last step.
	 *                   Use this to persist `hasSeenWelcome = true`.
	 */
	constructor(app: App, onComplete: () => Promise<void>) {
		super(app);
		this.onComplete = onComplete;
		this.steps = this.buildSteps();
	}

	// ── Step definitions ───────────────────────────────────────────────────

	private buildSteps(): Step[] {
		return [
			{
				title: "Welcome to Player Vault",
				icon: "book-open",
				render: (el) => {
					el.createEl("p", {
						text: "Player Vault lets you share a clean, player-facing HTML wiki with your table — without exposing your GM notes, spoilers, or encounter tables.",
					});
					el.createEl("p", { text: "Here's the idea:" });
					const ul = el.createEl("ul", { cls: "pv-ob-list" });
					[
						"Write your campaign notes normally in Obsidian.",
						"Tag any GM-only content with a secret marker.",
						"Player Vault strips the secrets and exports a static HTML wiki.",
						"Share the folder, or host it free on GitHub Pages / Netlify.",
					].forEach((t) => ul.createEl("li", { text: t }));
					el.createEl("p", {
						cls: "pv-ob-hint",
						text: "No server needed. Players open index.html in any browser.",
					});
				},
			},
			{
				title: "Marking GM-Only Content",
				icon: "eye-off",
				render: (el) => {
					el.createEl("p", {
						text: "Three ways to tag content as GM-only — all stripped automatically on export:",
					});

					const methods: Array<{
						label: string;
						code: string;
						note: string;
					}> = [
						{
							label: "1 · Inline secret blocks",
							code: "%%SECRET%%\nSpoilers go here…\n%%SECRET%%",
							note: "Also works with %%GM%% … %%GM%%",
						},
						{
							label: "2 · GM-only callout",
							code: "> [!gm-only] DM Notes\n> All continuation lines are stripped too.",
							note: "Every > line after the opener is removed",
						},
						{
							label: "3 · Exclude whole notes",
							code: "---\ngm-only: true\n---",
							note: "Add to front-matter — the entire note is omitted from the export",
						},
					];

					for (const m of methods) {
						const block = el.createEl("div", { cls: "pv-ob-method" });
						block.createEl("p", {
							cls: "pv-ob-method-label",
							text: m.label,
						});
						block
							.createEl("pre", { cls: "pv-ob-pre" })
							.createEl("code", { text: m.code });
						block.createEl("span", {
							cls: "pv-ob-note",
							text: m.note,
						});
					}
				},
			},
			{
				title: "Settings at a Glance",
				icon: "sliders-horizontal",
				render: (el) => {
					el.createEl("p", {
						text: "Find all of these in Settings → Player Vault:",
					});

					const rows: Array<{ name: string; desc: string }> = [
						{
							name: "Output folder",
							desc: 'Vault-relative path where HTML files land. Default: "player-vault-export". Created automatically.',
						},
						{
							name: "Strip all Obsidian comments",
							desc: "Remove every %% … %% block — useful for work-in-progress notes you never want players to see.",
						},
						{
							name: "Extra secret patterns",
							desc: "Add your own regex tags (e.g. %%SPOILER%% … %%SPOILER%%). Each pattern is validated as you type.",
						},
						{
							name: "Open folder after export",
							desc: "Reveal the output folder in Explorer / Finder as soon as the export finishes.",
						},
					];

					const dl = el.createEl("dl", { cls: "pv-ob-dl" });
					for (const r of rows) {
						dl.createEl("dt", { text: r.name });
						dl.createEl("dd", { text: r.desc });
					}

					el.createEl("p", {
						cls: "pv-ob-hint",
						text: "Settings are saved the moment you change them — no Save button needed.",
					});
				},
			},
			{
				title: "You're Ready to Export!",
				icon: "circle-check",
				render: (el) => {
					el.createEl("p", { text: "Trigger an export any time via:" });
					const ul = el.createEl("ul", { cls: "pv-ob-list" });
					[
						'The book icon (📖) in the left sidebar ribbon, or',
						'Command Palette (Ctrl / Cmd + P) → "Export Player Vault to HTML", or',
						"Settings → Player Vault → Run Export Now button.",
					].forEach((t) => ul.createEl("li", { text: t }));

					el.createEl("p", {
						text: "The output is a self-contained folder of .html files. Open index.html locally, or drop the folder onto GitHub Pages / Netlify for a free shareable link.",
					});

					el.createEl("p", {
						cls: "pv-ob-hint",
						text: "You can reopen this guide any time from Settings → Player Vault → Show welcome guide.",
					});
				},
			},
		];
	}

	// ── Modal lifecycle ────────────────────────────────────────────────────

	onOpen(): void {
		this.modalEl.addClass("pv-onboarding-modal");
		this.render();
	}

	private render(): void {
		const { contentEl } = this;
		contentEl.empty();

		const step = this.steps[this.step];

		// ── Header ────────────────────────────────────────────────────────
		const header = contentEl.createEl("div", { cls: "pv-ob-header" });
		const iconWrap = header.createEl("div", { cls: "pv-ob-icon" });
		setIcon(iconWrap, step.icon);
		header.createEl("h2", { cls: "pv-ob-title", text: step.title });

		// ── Progress dots ─────────────────────────────────────────────────
		const progress = contentEl.createEl("div", { cls: "pv-ob-progress" });
		for (let i = 0; i < this.steps.length; i++) {
			const dot = progress.createEl("span", {
				cls:
					"pv-ob-dot" +
					(i === this.step ? " pv-ob-dot-active" : ""),
			});
			const idx = i;
			dot.addEventListener("click", () => {
				this.step = idx;
				this.render();
			});
		}

		// ── Body ──────────────────────────────────────────────────────────
		const body = contentEl.createEl("div", { cls: "pv-ob-body" });
		step.render(body);

		// ── Navigation ────────────────────────────────────────────────────
		const nav = contentEl.createEl("div", { cls: "pv-ob-nav" });
		nav.createEl("span", {
			cls: "pv-ob-step-count",
			text: `${this.step + 1} / ${this.steps.length}`,
		});

		const btnRow = nav.createEl("div", { cls: "pv-ob-btnrow" });

		if (this.step > 0) {
			const back = btnRow.createEl("button", {
				cls: "pv-ob-btn",
				text: "← Back",
			});
			back.addEventListener("click", () => {
				this.step--;
				this.render();
			});
		}

		const isLast = this.step === this.steps.length - 1;
		const next = btnRow.createEl("button", {
			cls: "pv-ob-btn pv-ob-btn-primary",
			text: isLast ? "Get Started" : "Next →",
		});
		next.addEventListener("click", async () => {
			if (isLast) {
				await this.onComplete();
				this.close();
			} else {
				this.step++;
				this.render();
			}
		});
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
