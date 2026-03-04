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
 *  - Strikethrough (~~text~~)
 *  - Horizontal rules (---, ***, ___)
 *  - Tables (GFM pipe tables)
 *  - [[Wiki links]] → <a> tags (resolved via the exported-notes map)
 *  - [text](url) Markdown links
 *  - Images ![alt](src)
 *  - Paragraphs
 */

/**
 * Map of exported notes used for wiki-link resolution.
 * Key:   lower-cased note basename (without extension)
 * Value: output HTML filename (e.g. "Characters_Lyra.html")
 */
export type ExportedNoteMap = Map<string, string>;

/**
 * Derive a safe, unique output filename from a vault file path.
 * Path separators and characters that are invalid in filenames are replaced
 * with "_", so notes in sub-folders produce distinct, collision-free filenames.
 * e.g. "Characters/Lyra.md" → "Characters_Lyra.html"
 */
export function filePathToOutputName(filePath: string): string {
	const INVALID = /[<>:"/\\|?*\u0000-\u001F]/g;
	const withoutExt = filePath.replace(/\.md$/i, "");
	let base = withoutExt.trim().replace(INVALID, "_");
	base = base.replace(/[ _]+/g, "_");
	base = base.replace(/[. ]+$/g, "");
	if (!base) base = "note";
	return `${base}.html`;
}

/**
 * Returns true when the URL is safe to emit into an href or src attribute.
 *
 * Relative URLs (those lacking a scheme) are always considered safe — they
 * resolve within the exported wiki and cannot load arbitrary code.
 * For absolute URLs the scheme must be http, https, or mailto.
 * Everything else (javascript:, data:, vbscript:, etc.) is disallowed.
 */
function isSafeUrl(url: string): boolean {
	const trimmed = url.trim();
	// Detect whether the URL carries a scheme: the colon must come before
	// the first path separator, query character, or fragment.
	const colonIdx = trimmed.indexOf(":");
	const firstDelim = trimmed.search(/[/?#]/);
	const hasScheme =
		colonIdx !== -1 && (firstDelim === -1 || colonIdx < firstDelim);
	if (!hasScheme) return true; // relative URL – always safe
	return /^(https?:|mailto:)/i.test(trimmed);
}

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
 *
 * XSS-safety strategy:
 *  1. Structured patterns (images, links, wiki-links, inline code) are matched
 *     first and converted to safe HTML fragments stored in placeholder slots.
 *  2. The remaining raw text is HTML-escaped, so stray tags like <script> can
 *     never survive into the output.
 *  3. Bold/italic regexes then run over the fully-escaped text, so their
 *     capture groups can never contain unescaped HTML.
 *  4. Placeholder slots are substituted back with the pre-built HTML fragments.
 *
 * Only http/https/mailto, fragment (#), and relative URLs are permitted in
 * href/src attributes; disallowed schemes (javascript:, data:, …) cause the
 * link/image to degrade to escaped plain text.
 *
 * Wiki-links that point to notes absent from `exportedNotes` are rendered
 * as plain text (the link is dropped).
 */
export function convertInline(
	text: string,
	exportedNotes: ExportedNoteMap
): string {
	// Slot storage for safe HTML fragments extracted before HTML-escaping.
	const slots: string[] = [];
	const ph = (html: string): string => {
		const idx = slots.length;
		slots.push(html);
		return `\x02${idx}\x03`;
	};

	// ── Images ![alt](src) ────────────────────────────────────────────────
	text = text.replace(
		/!\[([^\]]*)\]\(([^)]+)\)/g,
		(_, alt, src) =>
			ph(
				isSafeUrl(src)
					? `<img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}">`
					: escapeHtml(alt)
			)
	);

	// ── Markdown links [text](url) ────────────────────────────────────────
	text = text.replace(
		/\[([^\]]+)\]\(([^)]+)\)/g,
		(_, label, href) =>
			ph(
				isSafeUrl(href)
					? `<a href="${escapeHtml(href)}">${escapeHtml(label)}</a>`
					: escapeHtml(label)
			)
	);

	// ── Wiki links [[Note|Alias]] or [[Note]] ─────────────────────────────
	text = text.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, target, alias) => {
		const label = alias ? alias.trim() : target.trim();
		const key = target.trim().toLowerCase();
		const outFile = exportedNotes.get(key);
		if (outFile) {
			return ph(`<a href="${escapeHtml(outFile)}">${escapeHtml(label)}</a>`);
		}
		// Orphan link – render as plain text
		return ph(escapeHtml(label));
	});

	// ── Inline code `code` ────────────────────────────────────────────────
	// Extracted before escapeHtml so the backtick syntax still matches and
	// the code content is individually escaped.
	text = text.replace(/`([^`]+)`/g, (_, code) => ph(`<code>${escapeHtml(code)}</code>`));

	// ── Escape remaining raw text ─────────────────────────────────────────
	text = escapeHtml(text);

	// ── Bold + italic ***text*** ──────────────────────────────────────────
	text = text.replace(/\*{3}(.+?)\*{3}/g, "<strong><em>$1</em></strong>");

	// ── Bold **text** or __text__ ─────────────────────────────────────────
	text = text.replace(/\*{2}(.+?)\*{2}/g, "<strong>$1</strong>");
	text = text.replace(/_{2}(.+?)_{2}/g, "<strong>$1</strong>");

	// ── Italic *text* or _text_ ───────────────────────────────────────────
	text = text.replace(/\*(.+?)\*/g, "<em>$1</em>");
	text = text.replace(/_(.+?)_/g, "<em>$1</em>");

	// ── Strikethrough ~~text~~ ────────────────────────────────────────────
	text = text.replace(/~~(.+?)~~/g, "<s>$1</s>");

	// ── Re-insert extracted HTML fragments ────────────────────────────────
	text = text.replace(/\x02(\d+)\x03/g, (_, i) => slots[+i]);

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
	exportedNotes: ExportedNoteMap
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

	let inTable = false;
	let tableRows: string[][] = [];
	let tableSeparatorIdx = -1;

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

	const flushTable = () => {
		if (tableRows.length === 0) { inTable = false; return; }
		let html = "<table>";
		if (tableSeparatorIdx >= 0) {
			const headerRows = tableRows.slice(0, tableSeparatorIdx);
			const bodyRows = tableRows.slice(tableSeparatorIdx);
			if (headerRows.length > 0) {
				html += "<thead>";
				for (const row of headerRows) {
					html += "<tr>" + row.map((c) => `<th>${convertInline(c.trim(), exportedNotes)}</th>`).join("") + "</tr>";
				}
				html += "</thead>";
			}
			if (bodyRows.length > 0) {
				html += "<tbody>";
				for (const row of bodyRows) {
					html += "<tr>" + row.map((c) => `<td>${convertInline(c.trim(), exportedNotes)}</td>`).join("") + "</tr>";
				}
				html += "</tbody>";
			}
		} else {
			html += "<tbody>";
			for (const row of tableRows) {
				html += "<tr>" + row.map((c) => `<td>${convertInline(c.trim(), exportedNotes)}</td>`).join("") + "</tr>";
			}
			html += "</tbody>";
		}
		html += "</table>";
		htmlParts.push(html);
		tableRows = [];
		tableSeparatorIdx = -1;
		inTable = false;
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
				flushTable();
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

		// ── Table row ─────────────────────────────────────────────────────────
		if (line.trim().startsWith("|") && line.trim().endsWith("|")) {
			flushParagraph();
			flushBlockquote();
			flushList();
			inTable = true;
			const cells = line.trim().replace(/^\||\|$/g, "").split("|");
			const isSep = cells.every((c) => /^[\s:]*-+[\s:]*$/.test(c));
			if (!isSep) {
				tableRows.push(cells);
			} else if (tableSeparatorIdx < 0) {
				tableSeparatorIdx = tableRows.length;
			}
			continue;
		}
		if (inTable) {
			flushTable();
		}

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
			const rawHeadingText = headingMatch[2];
			const headingId = rawHeadingText
				.toLowerCase()
				.replace(/[^\w\s-]/g, "")
				.trim()
				.replace(/\s+/g, "-");
			const text = convertInline(rawHeadingText, exportedNotes);
			htmlParts.push(`<h${level} id="${escapeHtml(headingId)}">${text}</h${level}>`);
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
	flushTable();

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
 * @param notes    Sorted array of `{name, filename}` pairs – `name` is the
 *                 display label, `filename` is the relative HTML file to link to.
 * @param cssPath  Optional relative path to a CSS stylesheet
 */
export function buildIndexPage(
	notes: Array<{ name: string; filename: string }>,
	cssPath = "styles.css"
): string {
	const items = notes
		.map(
			({ name, filename }) =>
				`    <li><a href="${escapeHtml(filename)}">${escapeHtml(name)}</a></li>`
		)
		.join("\n");

	const body = `<h1>Player Wiki</h1>\n<ul class="note-index">\n${items}\n</ul>`;
	return wrapInPage("Player Wiki – Index", body, cssPath);
}
