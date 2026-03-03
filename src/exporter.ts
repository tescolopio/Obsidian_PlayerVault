/**
 * Converts Obsidian-flavoured Markdown to a minimal, self-contained HTML
 * fragment.  This deliberately avoids heavy Markdown libraries so the plugin
 * has no extra runtime dependencies beyond what Obsidian already bundles.
 *
 * Supported transforms:
 *  - Headings (# … ######)
 *  - Bold (**text** or __text__)
 *  - Italic (*text* or _text_)
 *  - Bold+italic (***text***)
 *  - Inline code (`code`)
 *  - Code blocks (``` … ```)
 *  - Block quotes (> …)
 *  - Unordered lists (- or * or +)
 *  - Ordered lists (1. …)
 *  - Horizontal rules (---, ***, ___)
 *  - [[Wiki links]] → <a> tags (resolved via the exported-notes map)
 *  - [text](url) Markdown links
 *  - Images ![alt](src)
 *  - Paragraphs
 */

/** Set of exported note base-names (without extension, lower-cased) */
export type ExportedNoteSet = Set<string>;

/**
 * Convert a note slug to an HTML filename.
 * e.g. "My Note" → "My Note.html"
 *
 * The slug is sanitized to be safe as a cross-platform filename:
 *  - path separators and invalid characters are replaced with "_"
 *  - trailing dots/spaces (invalid on Windows) are removed
 */
export function slugToFilename(slug: string): string {
	// Disallow path separators and characters invalid on Windows/macOS.
	// Also strip control characters.
	const INVALID_FILENAME_CHARS = /[<>:"/\\|?*\u0000-\u001F]/g;

	let base = slug.trim().replace(INVALID_FILENAME_CHARS, "_");

	// Collapse consecutive spaces/underscores to a single underscore to keep names readable.
	base = base.replace(/[ _]+/g, "_");

	// Remove trailing dots or spaces which are not allowed in Windows filenames.
	base = base.replace(/[. ]+$/g, "");

	// Fallback in case everything was stripped.
	if (!base) {
		base = "note";
	}

	return `${base}.html`;
}

/** Escape special HTML characters */
function escapeHtml(text: string): string {
	return text
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

/**
 * Convert inline Markdown syntax to HTML within a single line of text.
 * Wiki-links that point to notes absent from `exportedNotes` are rendered
 * as plain text (the link is dropped).
 */
export function convertInline(
	text: string,
	exportedNotes: ExportedNoteSet
): string {
	// Images ![alt](src)
	text = text.replace(
		/!\[([^\]]*)\]\(([^)]+)\)/g,
		(_, alt, src) => `<img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}">`
	);

	// Markdown links [text](url)
	text = text.replace(
		/\[([^\]]+)\]\(([^)]+)\)/g,
		(_, label, href) =>
			`<a href="${escapeHtml(href)}">${escapeHtml(label)}</a>`
	);

	// Wiki links with alias [[Note|Alias]] or plain [[Note]]
	text = text.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, target, alias) => {
		const label = alias ? alias.trim() : target.trim();
		const key = target.trim().toLowerCase();
		if (exportedNotes.has(key)) {
			return `<a href="${escapeHtml(slugToFilename(target.trim()))}">${escapeHtml(label)}</a>`;
		}
		// Orphan link – render as plain text
		return escapeHtml(label);
	});

	// Bold + italic ***text***
	text = text.replace(/\*{3}(.+?)\*{3}/g, "<strong><em>$1</em></strong>");

	// Bold **text** or __text__
	text = text.replace(/\*{2}(.+?)\*{2}/g, "<strong>$1</strong>");
	text = text.replace(/_{2}(.+?)_{2}/g, "<strong>$1</strong>");

	// Italic *text* or _text_
	text = text.replace(/\*(.+?)\*/g, "<em>$1</em>");
	text = text.replace(/_(.+?)_/g, "<em>$1</em>");

	// Inline code `code`
	text = text.replace(/`([^`]+)`/g, "<code>$1</code>");

	return text;
}

/**
 * Convert a full Markdown document to an HTML fragment (no <html>/<body> wrappers).
 *
 * @param markdown      Raw (already sanitized) markdown content
 * @param exportedNotes Set of lower-cased note names that are part of the export;
 *                      wiki-links to notes not in this set are demoted to plain text.
 */
export function markdownToHtml(
	markdown: string,
	exportedNotes: ExportedNoteSet
): string {
	const lines = markdown.split("\n");
	const htmlParts: string[] = [];

	let inCodeBlock = false;
	let codeLang = "";
	let codeLines: string[] = [];

	let inBlockquote = false;
	let blockquoteLines: string[] = [];

	let inUnorderedList = false;
	let inOrderedList = false;
	let listLines: string[] = [];

	let paragraphLines: string[] = [];

	const flushParagraph = () => {
		if (paragraphLines.length === 0) return;
		const inner = paragraphLines
			.map((l) => convertInline(l, exportedNotes))
			.join(" ");
		htmlParts.push(`<p>${inner}</p>`);
		paragraphLines = [];
	};

	const flushBlockquote = () => {
		if (blockquoteLines.length === 0) return;
		const inner = blockquoteLines
			.map((l) => convertInline(l, exportedNotes))
			.join("\n");
		htmlParts.push(`<blockquote>${inner}</blockquote>`);
		blockquoteLines = [];
	};

	const flushList = () => {
		if (listLines.length === 0) return;
		const tag = inUnorderedList ? "ul" : "ol";
		const items = listLines
			.map((l) => `<li>${convertInline(l, exportedNotes)}</li>`)
			.join("");
		htmlParts.push(`<${tag}>${items}</${tag}>`);
		listLines = [];
		inUnorderedList = false;
		inOrderedList = false;
	};

	for (const rawLine of lines) {
		// ── Code block fence ──────────────────────────────────────────────────
		if (/^```/.test(rawLine)) {
			if (inCodeBlock) {
				const langAttr = codeLang ? ` class="language-${escapeHtml(codeLang)}"` : "";
				htmlParts.push(
					`<pre><code${langAttr}>${codeLines.join("\n")}</code></pre>`
				);
				codeLines = [];
				codeLang = "";
				inCodeBlock = false;
			} else {
				flushParagraph();
				flushBlockquote();
				flushList();
				inCodeBlock = true;
				codeLang = rawLine.slice(3).trim();
			}
			continue;
		}

		if (inCodeBlock) {
			codeLines.push(escapeHtml(rawLine));
			continue;
		}

		const line = rawLine;

		// ── Horizontal rule ───────────────────────────────────────────────────
		if (/^(---+|\*\*\*+|___+)\s*$/.test(line)) {
			flushParagraph();
			flushBlockquote();
			flushList();
			htmlParts.push("<hr>");
			continue;
		}

		// ── Headings ──────────────────────────────────────────────────────────
		const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
		if (headingMatch) {
			flushParagraph();
			flushBlockquote();
			flushList();
			const level = headingMatch[1].length;
			const text = convertInline(headingMatch[2], exportedNotes);
			htmlParts.push(`<h${level}>${text}</h${level}>`);
			continue;
		}

		// ── Block quote ───────────────────────────────────────────────────────
		const bqMatch = line.match(/^>\s?(.*)$/);
		if (bqMatch) {
			flushParagraph();
			flushList();
			inBlockquote = true;
			blockquoteLines.push(bqMatch[1]);
			continue;
		}
		if (inBlockquote) {
			flushBlockquote();
			inBlockquote = false;
		}

		// ── Unordered list ────────────────────────────────────────────────────
		const ulMatch = line.match(/^[-*+]\s+(.+)$/);
		if (ulMatch) {
			flushParagraph();
			if (inOrderedList) flushList();
			inUnorderedList = true;
			listLines.push(ulMatch[1]);
			continue;
		}

		// ── Ordered list ──────────────────────────────────────────────────────
		const olMatch = line.match(/^\d+\.\s+(.+)$/);
		if (olMatch) {
			flushParagraph();
			if (inUnorderedList) flushList();
			inOrderedList = true;
			listLines.push(olMatch[1]);
			continue;
		}
		if (inUnorderedList || inOrderedList) {
			flushList();
		}

		// ── Blank line ────────────────────────────────────────────────────────
		if (line.trim() === "") {
			flushParagraph();
			continue;
		}

		// ── Plain paragraph text ──────────────────────────────────────────────
		paragraphLines.push(line);
	}

	// Flush any open state
	if (inCodeBlock && codeLines.length > 0) {
		htmlParts.push(`<pre><code>${codeLines.join("\n")}</code></pre>`);
	}
	flushParagraph();
	flushBlockquote();
	flushList();

	return htmlParts.join("\n");
}

/**
 * Wrap an HTML fragment in a full HTML5 page.
 *
 * @param title    Page title shown in the browser tab
 * @param body     Inner HTML content
 * @param cssPath  Optional relative path to a CSS stylesheet
 */
export function wrapInPage(title: string, body: string, cssPath = "styles.css"): string {
	return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <link rel="stylesheet" href="${escapeHtml(cssPath)}">
</head>
<body>
  <article class="note-content">
    ${body}
  </article>
</body>
</html>`;
}

/**
 * Build the index page that lists all exported notes.
 *
 * @param noteNames  Sorted array of note names (without .html extension)
 * @param cssPath    Optional relative path to a CSS stylesheet
 */
export function buildIndexPage(noteNames: string[], cssPath = "styles.css"): string {
	const items = noteNames
		.map(
			(name) =>
				`    <li><a href="${escapeHtml(slugToFilename(name))}">${escapeHtml(name)}</a></li>`
		)
		.join("\n");

	const body = `<h1>Player Wiki</h1>\n<ul class="note-index">\n${items}\n</ul>`;
	return wrapInPage("Player Wiki – Index", body, cssPath);
}
