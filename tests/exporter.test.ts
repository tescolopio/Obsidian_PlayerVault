import {
	convertInline,
	markdownToHtml,
	wrapInPage,
	buildIndexPage,
	slugToFilename,
	ExportedNoteSet,
} from "../src/exporter";

// Helper: a set containing a few exported notes
const notes = (names: string[]): ExportedNoteSet =>
	new Set(names.map((n) => n.toLowerCase()));

describe("slugToFilename", () => {
	it("appends .html to the slug", () => {
		expect(slugToFilename("My Note")).toBe("My Note.html");
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

	it("escapes HTML in link targets", () => {
		const html = convertInline('[xss](<script>)', exported);
		expect(html).not.toContain("<script>");
	});
});

describe("markdownToHtml", () => {
	const exported = notes(["Page"]);

	it("wraps a paragraph in <p> tags", () => {
		const html = markdownToHtml("Hello world", exported);
		expect(html).toContain("<p>Hello world</p>");
	});

	it("converts headings", () => {
		expect(markdownToHtml("# H1", exported)).toContain("<h1>H1</h1>");
		expect(markdownToHtml("## H2", exported)).toContain("<h2>H2</h2>");
		expect(markdownToHtml("### H3", exported)).toContain("<h3>H3</h3>");
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
		const html = buildIndexPage(["Alpha", "Beta", "Gamma"]);
		expect(html).toContain("Alpha.html");
		expect(html).toContain("Beta.html");
		expect(html).toContain("Gamma.html");
		expect(html).toContain(">Alpha<");
		expect(html).toContain(">Beta<");
	});

	it("escapes special characters in note names", () => {
		const html = buildIndexPage(['<script>"evil"</script>']);
		expect(html).not.toContain("<script>");
		expect(html).toContain("&lt;script&gt;");
	});
});
