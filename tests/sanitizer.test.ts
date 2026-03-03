import { sanitizeContent, isNoteFullySecret, DEFAULT_SECRET_PATTERNS } from "../src/sanitizer";

describe("sanitizeContent", () => {
	describe("%%SECRET%% blocks", () => {
		it("removes a single %%SECRET%% … %%SECRET%% block", () => {
			const input = "Before\n%%SECRET%%\nHidden text\n%%SECRET%%\nAfter";
			const result = sanitizeContent(input);
			expect(result).not.toContain("Hidden text");
			expect(result).toContain("Before");
			expect(result).toContain("After");
		});

		it("removes multiple %%SECRET%% blocks in the same note", () => {
			const input =
				"A%%SECRET%%hidden1%%SECRET%%B%%SECRET%%hidden2%%SECRET%%C";
			const result = sanitizeContent(input);
			expect(result).not.toContain("hidden1");
			expect(result).not.toContain("hidden2");
			expect(result).toContain("ABC");
		});

		it("is case-insensitive for %%secret%%", () => {
			const input = "%%secret%%hidden%%secret%%";
			const result = sanitizeContent(input);
			expect(result).not.toContain("hidden");
		});

		it("handles multiline secret blocks", () => {
			const input = "%%SECRET%%\nline 1\nline 2\n%%SECRET%%";
			const result = sanitizeContent(input);
			expect(result).toBe("");
		});
	});

	describe("%%GM%% blocks", () => {
		it("removes %%GM%% … %%GM%% blocks", () => {
			const input = "Public%%GM%%GM-only notes%%GM%%Public again";
			const result = sanitizeContent(input);
			expect(result).not.toContain("GM-only notes");
			expect(result).toContain("Public");
			expect(result).toContain("Public again");
		});
	});

	describe("> [!gm-only] callout blocks", () => {
		it("removes a gm-only callout and its continuation lines", () => {
			const input =
				"Before\n> [!gm-only] GM Title\n> This is secret\n> Still secret\nAfter";
			const result = sanitizeContent(input);
			expect(result).not.toContain("GM Title");
			expect(result).not.toContain("This is secret");
			expect(result).not.toContain("Still secret");
			expect(result).toContain("Before");
			expect(result).toContain("After");
		});

		it("removes a gm-only callout with no title suffix", () => {
			const input = "> [!gm-only]\n> secret content\n\nNormal text";
			const result = sanitizeContent(input);
			expect(result).not.toContain("secret content");
			expect(result).toContain("Normal text");
		});
	});

	describe("extraPatterns option", () => {
		it("strips content matching extra patterns", () => {
			const input = "%%HIDDEN%%my secret%%HIDDEN%% visible";
			const result = sanitizeContent(input, {
				extraPatterns: [/%%HIDDEN%%[\s\S]*?%%HIDDEN%%/gi],
			});
			expect(result).not.toContain("my secret");
			expect(result).toContain("visible");
		});
	});

	describe("stripAllComments option", () => {
		it("strips all %% … %% comments when enabled", () => {
			const input = "%%just a comment%%text%%another%%";
			const result = sanitizeContent(input, { stripAllComments: true });
			expect(result).not.toContain("just a comment");
			expect(result).not.toContain("another");
			expect(result).toContain("text");
		});
	});

	describe("blank-line collapsing", () => {
		it("collapses 3+ blank lines to 2", () => {
			const input = "line1\n\n\n\nline2";
			const result = sanitizeContent(input);
			expect(result).not.toMatch(/\n{3,}/);
		});
	});

	describe("content with no secrets", () => {
		it("returns original content unchanged (trimmed)", () => {
			const input = "  Hello world  ";
			expect(sanitizeContent(input)).toBe("Hello world");
		});
	});
});

describe("isNoteFullySecret", () => {
	it("returns true when front-matter contains gm-only: true", () => {
		const content = "---\ntitle: Hidden\ngm-only: true\n---\nContent";
		expect(isNoteFullySecret(content)).toBe(true);
	});

	it("returns false when gm-only is false", () => {
		const content = "---\ngm-only: false\n---\nContent";
		expect(isNoteFullySecret(content)).toBe(false);
	});

	it("returns false when there is no front-matter", () => {
		const content = "No front matter here.";
		expect(isNoteFullySecret(content)).toBe(false);
	});

	it("returns false when gm-only is absent from front-matter", () => {
		const content = "---\ntitle: Something\n---\nContent";
		expect(isNoteFullySecret(content)).toBe(false);
	});

	it("is case-insensitive for gm-only key", () => {
		const content = "---\nGM-ONLY: true\n---\nContent";
		expect(isNoteFullySecret(content)).toBe(true);
	});
});

describe("DEFAULT_SECRET_PATTERNS", () => {
	it("exports at least two patterns", () => {
		expect(DEFAULT_SECRET_PATTERNS.length).toBeGreaterThanOrEqual(2);
	});
});
