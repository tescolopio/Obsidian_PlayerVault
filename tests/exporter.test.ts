import {
	convertInline,
	markdownToHtml,
	wrapInPage,
	buildIndexPage,
	slugToFilename,
	filePathToOutputName,
	ExportedNoteMap,
	buildBackLinksMap,
	buildSidebarEntries,
	buildSearchIndexJs,
	SidebarEntry,
	SearchEntry,
} from "../src/exporter";

// Helper: build an ExportedNoteMap from a list of bare note names.
// Each name becomes a key (lower-cased) mapped to "Name.html".
const notes = (names: string[]): ExportedNoteMap =>
	new Map(names.map((n) => [n.toLowerCase(), `${n}.html`]));

describe("slugToFilename", () => {
	it("appends .html to the slug", () => {
		expect(slugToFilename("My Note")).toBe("My_Note.html");
		expect(slugToFilename("dragon")).toBe("dragon.html");
	});
});

describe("convertInline", () => {
	const exported = notes(["Home", "Tavern"]);

	it("converts bold text", () => {
		expect(convertInline("**bold**", exported)).toBe("<strong>bold</strong>");
	});

	it("converts italic text", () => {
		expect(convertInline("*italic*", exported)).toBe("<em>italic</em>");
	});

	it("converts inline code", () => {
		expect(convertInline("`code`", exported)).toBe("<code>code</code>");
	});

	it("converts a wiki link for an exported note", () => {
		const html = convertInline("[[Tavern]]", exported);
		expect(html).toContain('<a href="Tavern.html">Tavern</a>');
	});

	it("converts a wiki link with alias for an exported note", () => {
		const html = convertInline("[[Home|Start Page]]", exported);
		expect(html).toContain('<a href="Home.html">Start Page</a>');
	});

	it("renders an orphan wiki link as plain text", () => {
		const html = convertInline("[[MissingNote]]", exported);
		expect(html).not.toContain("<a");
		expect(html).toContain("MissingNote");
	});

	it("converts Markdown links", () => {
		const html = convertInline("[Click](https://example.com)", exported);
		expect(html).toContain('<a href="https://example.com">Click</a>');
	});

	it("converts images", () => {
		const html = convertInline("![dragon](dragon.png)", exported);
		expect(html).toContain('<img src="dragon.png" alt="dragon">');
	});

	it("strips disallowed link schemes to plain text", () => {
		const html = convertInline("[xss](<script>)", exported);
		expect(html).not.toContain("<script>");
		expect(html).toContain("xss");
	});

	it("strips javascript: links to plain text", () => {
		const html = convertInline("[click](javascript:alert(1))", exported);
		expect(html).not.toContain("javascript:");
		expect(html).toContain("click");
	});

	it("strips data: image src to plain text", () => {
		const html = convertInline("![img](data:text/html,<h1>hi</h1>)", exported);
		expect(html).not.toContain("data:");
		expect(html).not.toContain("<h1>");
	});

	it("escapes raw HTML in plain text", () => {
		const html = convertInline("<script>alert(1)</script>", exported);
		expect(html).not.toContain("<script>");
		expect(html).toContain("&lt;script&gt;");
	});

	it("escapes HTML inside bold formatting", () => {
		const html = convertInline("**<evil>**", exported);
		expect(html).not.toContain("<evil>");
		expect(html).toContain("&lt;evil&gt;");
		expect(html).toContain("<strong>");
	});

	it("escapes HTML inside inline code", () => {
		const html = convertInline("`<script>`", exported);
		expect(html).not.toContain("<script>");
		expect(html).toContain("&lt;script&gt;");
		expect(html).toContain("<code>");
	});

	it("converts strikethrough", () => {
		const html = convertInline("~~deleted~~", exported);
		expect(html).toBe("<s>deleted</s>");
	});

	it("escapes HTML inside strikethrough", () => {
		const html = convertInline("~~<evil>~~", exported);
		expect(html).not.toContain("<evil>");
		expect(html).toContain("&lt;evil&gt;");
		expect(html).toContain("<s>");
	});
});

describe("markdownToHtml", () => {
	const exported = notes(["Page"]);

	it("wraps a paragraph in <p> tags", () => {
		const html = markdownToHtml("Hello world", exported);
		expect(html).toContain("<p>Hello world</p>");
	});

	it("converts headings", () => {
		expect(markdownToHtml("# H1", exported)).toContain(">H1</h1>");
		expect(markdownToHtml("## H2", exported)).toContain(">H2</h2>");
		expect(markdownToHtml("### H3", exported)).toContain(">H3</h3>");
	});

	it("gives headings id anchors derived from text", () => {
		expect(markdownToHtml("## My Section", exported)).toContain('id="my-section"');
		expect(markdownToHtml("# Hello World", exported)).toContain('id="hello-world"');
		expect(markdownToHtml("### Combat & Tactics!", exported)).toContain('id="combat-tactics"');
	});

	it("converts unordered lists", () => {
		const html = markdownToHtml("- item one\n- item two", exported);
		expect(html).toContain("<ul>");
		expect(html).toContain("<li>item one</li>");
		expect(html).toContain("<li>item two</li>");
	});

	it("converts ordered lists", () => {
		const html = markdownToHtml("1. first\n2. second", exported);
		expect(html).toContain("<ol>");
		expect(html).toContain("<li>first</li>");
	});

	it("converts block quotes", () => {
		const html = markdownToHtml("> A quote", exported);
		expect(html).toContain("<blockquote>");
		expect(html).toContain("A quote");
	});

	it("converts horizontal rules", () => {
		const html = markdownToHtml("---", exported);
		expect(html).toContain("<hr>");
	});

	it("converts fenced code blocks", () => {
		const md = "```javascript\nconsole.log('hi');\n```";
		const html = markdownToHtml(md, exported);
		expect(html).toContain("<pre><code");
		expect(html).toContain("console.log");
	});

	it("strips orphan wiki links to plain text", () => {
		const html = markdownToHtml("Go to [[Missing]]", exported);
		expect(html).not.toContain("<a");
		expect(html).toContain("Missing");
	});

	it("renders exported wiki links as anchors", () => {
		const html = markdownToHtml("See [[Page]]", exported);
		expect(html).toContain('<a href="Page.html">Page</a>');
	});

	it("converts a GFM pipe table with header row", () => {
		const md = "| Name | Role |\n|------|------|\n| Lyra | Ranger |";
		const html = markdownToHtml(md, exported);
		expect(html).toContain("<table>");
		expect(html).toContain("<thead>");
		expect(html).toContain("<th>");
		expect(html).toContain("Name");
		expect(html).toContain("Role");
		expect(html).toContain("<tbody>");
		expect(html).toContain("<td>");
		expect(html).toContain("Lyra");
		expect(html).toContain("Ranger");
	});

	it("converts a table without separator as body-only", () => {
		const md = "| A | B |\n| 1 | 2 |";
		const html = markdownToHtml(md, exported);
		expect(html).toContain("<table>");
		expect(html).toContain("<td>");
		expect(html).not.toContain("<th>");
	});

	it("escapes HTML inside table cells", () => {
		const md = "| Col |\n|-----|\n| <script>evil</script> |";
		const html = markdownToHtml(md, exported);
		expect(html).not.toContain("<script>");
		expect(html).toContain("&lt;script&gt;");
	});
});

describe("wrapInPage", () => {
	it("produces a complete HTML5 document", () => {
		const html = wrapInPage("My Title", "<p>body</p>");
		expect(html).toContain("<!DOCTYPE html>");
		expect(html).toContain("<title>My Title</title>");
		expect(html).toContain("<p>body</p>");
		expect(html).toContain('<link rel="stylesheet"');
	});

	it("uses a custom css path when provided", () => {
		const html = wrapInPage("T", "<p/>", "../custom.css");
		expect(html).toContain("../custom.css");
	});
});

describe("buildIndexPage", () => {
	it("lists all note names as links", () => {
		const html = buildIndexPage([
			{ name: "Alpha", filename: "Alpha.html" },
			{ name: "Beta", filename: "Beta.html" },
			{ name: "Gamma", filename: "Gamma.html" },
		]);
		expect(html).toContain("Alpha.html");
		expect(html).toContain("Beta.html");
		expect(html).toContain("Gamma.html");
		expect(html).toContain(">Alpha<");
		expect(html).toContain(">Beta<");
	});

	it("escapes special characters in note names and filenames", () => {
		const html = buildIndexPage([
			{ name: '<script>"evil"</script>', filename: "safe_name.html" },
		]);
		// The raw XSS payload must not appear verbatim (note: page itself has <script> tags for search)
		expect(html).not.toContain('<script>"evil"</script>');
		expect(html).toContain("&lt;script&gt;");
		expect(html).toContain("safe_name.html");
	});
});

describe("filePathToOutputName", () => {
	it("strips .md and appends .html", () => {
		expect(filePathToOutputName("dragon.md")).toBe("dragon.html");
	});

	it("replaces path separators with underscores", () => {
		expect(filePathToOutputName("Characters/Lyra.md")).toBe("Characters_Lyra.html");
	});

	it("handles nested paths", () => {
		expect(filePathToOutputName("World/Locations/Tavern.md")).toBe(
			"World_Locations_Tavern.html"
		);
	});

	it("produces distinct filenames for notes that share a basename", () => {
		const a = filePathToOutputName("Characters/Lyra.md");
		const b = filePathToOutputName("NPCs/Lyra.md");
		expect(a).not.toBe(b);
	});
});

// ── v1.3 helpers ──────────────────────────────────────────────────────────────

/** Minimal duck-type entry matching the SurvivingEntry shape in exporter.ts */
const mkEntry = (path: string, sanitized = "") => ({
	file: { basename: path.split("/").pop()!.replace(/\.md$/i, ""), path },
	sanitized,
	outputFilename: filePathToOutputName(path),
});

describe("buildBackLinksMap", () => {
	it("returns an empty map when there are no notes", () => {
		const map = buildBackLinksMap(new Map(), new Map());
		expect(map.size).toBe(0);
	});

	it("records a back-link when note B links to note A", () => {
		const noteA = mkEntry("Alpha.md");
		const noteB = mkEntry("Beta.md", "See [[Alpha]] for details.");
		const survivingNotes = new Map([
			["Alpha.md", noteA],
			["Beta.md", noteB],
		]);
		const exportedNoteMap: ExportedNoteMap = new Map([
			["alpha", filePathToOutputName("Alpha.md")],
			["beta", filePathToOutputName("Beta.md")],
		]);
		const result = buildBackLinksMap(survivingNotes, exportedNoteMap);
		const linksToAlpha = result.get(filePathToOutputName("Alpha.md"));
		expect(linksToAlpha).toBeDefined();
		expect(linksToAlpha!.length).toBe(1);
		expect(linksToAlpha![0].name).toBe("Beta");
	});

	it("does not record self-links", () => {
		const noteA = mkEntry("Alpha.md", "Reference: [[Alpha]].");
		const survivingNotes = new Map([["Alpha.md", noteA]]);
		const exportedNoteMap: ExportedNoteMap = new Map([["alpha", filePathToOutputName("Alpha.md")]]);
		const result = buildBackLinksMap(survivingNotes, exportedNoteMap);
		expect(result.size).toBe(0);
	});
});

describe("buildSidebarEntries", () => {
	it("assigns folder=\"\" for root-level notes", () => {
		const map = new Map([["note.md", mkEntry("note.md")]]);
		const entries = buildSidebarEntries(map);
		expect(entries.length).toBe(1);
		expect(entries[0].folder).toBe("");
	});

	it("assigns the parent path as folder for sub-folder notes", () => {
		const map = new Map([
			["root.md", mkEntry("root.md")],
			["Characters/Lyra.md", mkEntry("Characters/Lyra.md")],
		]);
		const entries = buildSidebarEntries(map);
		const lyra = entries.find((e) => e.name === "Lyra");
		expect(lyra).toBeDefined();
		expect(lyra!.folder).toBe("Characters");
		// root notes sort before folder notes
		expect(entries[0].folder).toBe("");
	});
});

describe("buildSearchIndexJs", () => {
	it("produces a JavaScript variable assignment", () => {
		const result = buildSearchIndexJs([{ name: "Lyra", filename: "Lyra.html", text: "elf ranger" }]);
		expect(result).toMatch(/^window\.PV_SEARCH_INDEX\s*=/);
		expect(result).toContain("Lyra");
	});

	it("escapes < and > to prevent injection", () => {
		const result = buildSearchIndexJs([{ name: "<script>", filename: "x.html", text: ">" }]);
		expect(result).not.toContain("<script>");
		expect(result).toContain("\\u003c");
	});
});

describe("wrapInPage with v1.3 options", () => {
	const sidebar: SidebarEntry[] = [
		{ name: "Alpha", filename: "Alpha.html", folder: "" },
		{ name: "Beta", filename: "Beta.html", folder: "Characters" },
	];

	it("includes sidebar note links in the output", () => {
		const html = wrapInPage("Test", "<p>body</p>", { sidebarEntries: sidebar });
		expect(html).toContain("Alpha.html");
		expect(html).toContain("Beta.html");
	});

	it("includes breadcrumb when vaultPath is supplied", () => {
		const html = wrapInPage("Lyra", "<p/>", { vaultPath: "Characters/Lyra.md" });
		expect(html).toContain("pv-breadcrumb");
		expect(html).toContain("Characters");
	});

	it("includes back-links footer when backLinks are supplied", () => {
		const html = wrapInPage("Target", "<p/>", {
			backLinks: [{ name: "Source", filename: "Source.html" }],
		});
		expect(html).toContain("pv-backlinks");
		expect(html).toContain("Source.html");
	});

	it("injects custom CSS inside a <style> block", () => {
		const html = wrapInPage("T", "<p/>", { customCss: "body { color: red; }" });
		expect(html).toContain("<style>");
		expect(html).toContain("color: red");
	});
});
