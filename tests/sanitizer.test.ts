import { sanitizeContent, isNoteFullySecret, isNoteExcludedByFolder, isNoteIncludedByTag, DEFAULT_SECRET_PATTERNS, isNotePublishBlocked } from "../src/sanitizer";

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

describe("isNoteExcludedByFolder", () => {
	it("returns false when excluded list is empty", () => {
		expect(isNoteExcludedByFolder("GM Notes/Session 1.md", [])).toBe(false);
	});

	it("returns true when the note path starts with an excluded folder", () => {
		expect(isNoteExcludedByFolder("GM Notes/Session 1.md", ["GM Notes"])).toBe(true);
	});

	it("returns false when the note is in a different folder", () => {
		expect(isNoteExcludedByFolder("Player Notes/Overview.md", ["GM Notes"])).toBe(false);
	});

	it("matches with a trailing slash on the excluded folder entry", () => {
		expect(isNoteExcludedByFolder("GM Notes/foo.md", ["GM Notes/"])).toBe(true);
	});

	it("does not match a partial folder name without a separator", () => {
		expect(isNoteExcludedByFolder("GM Notes Extended/note.md", ["GM Notes"])).toBe(false);
	});
});

describe("isNoteIncludedByTag", () => {
	it("returns true when the inclusion tag is empty (no filter)", () => {
		expect(isNoteIncludedByTag("Some content", "")).toBe(true);
	});

	it("matches an inline hashtag in the note body", () => {
		expect(isNoteIncludedByTag("Hello #player-facing world", "#player-facing")).toBe(true);
	});

	it("strips leading # from the tag before matching", () => {
		expect(isNoteIncludedByTag("Hello #player-facing world", "player-facing")).toBe(true);
	});

	it("matches a tag in a YAML inline array", () => {
		const content = "---\ntags: [player-facing, lore]\n---\nBody text";
		expect(isNoteIncludedByTag(content, "#player-facing")).toBe(true);
	});

	it("matches a tag in a YAML list format", () => {
		const content = "---\ntags:\n  - player-facing\n  - session\n---\nBody";
		expect(isNoteIncludedByTag(content, "#player-facing")).toBe(true);
	});

	it("returns false when the tag is not present in the note", () => {
		expect(isNoteIncludedByTag("No tags here at all", "#player-facing")).toBe(false);
	});
});

describe("isNotePublishBlocked", () => {
	it("returns true when front matter contains publish: false (boolean)", () => {
		const content = "---\npublish: false\ntags: [lore]\n---\nBody text";
		expect(isNotePublishBlocked(content)).toBe(true);
	});

	it("returns true when front matter contains publish: \"false\" (string)", () => {
		const content = "---\npublish: \"false\"\n---\nBody text";
		expect(isNotePublishBlocked(content)).toBe(true);
	});

	it("returns false when front matter contains publish: true", () => {
		const content = "---\npublish: true\n---\nBody text";
		expect(isNotePublishBlocked(content)).toBe(false);
	});

	it("returns false when note has no front matter", () => {
		const content = "Just a normal note with no YAML.";
		expect(isNotePublishBlocked(content)).toBe(false);
	});

	it("returns false when front matter has no publish key", () => {
		const content = "---\ntags: [player-facing]\ntitle: The Tavern\n---\nBody";
		expect(isNotePublishBlocked(content)).toBe(false);
	});
});
