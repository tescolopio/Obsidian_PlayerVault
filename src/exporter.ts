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

// ── v1.3 Navigation & UX types ───────────────────────────────────────────────

/** One entry in the generated sidebar, derived from a surviving note. */
export interface SidebarEntry {
	name: string;
	filename: string;
	/** Vault folder path (e.g. "Characters") or "" for root-level notes. */
	folder: string;
}

/** A note that links to a given target note (used for the back-links footer). */
export interface BackLinkEntry {
	name: string;
	filename: string;
}

/** Maps an output filename to the list of notes that link to it. */
export type BackLinksMap = Map<string, BackLinkEntry[]>;

/** Plain-text search entry written to search-index.js. */
export interface SearchEntry {
	name: string;
	filename: string;
	/** First ~500 chars of plain text, used for full-text search matching. */
	text: string;
}

/**
 * Options for wrapInPage and buildIndexPage (v1.3+).
 * The third argument also accepts a bare string for backwards-compatibility
 * (treated as `cssPath`).
 */
export interface WrapPageOptions {
	/** Path to the stylesheet. Defaults to "styles.css". */
	cssPath?: string;
	/** Sorted sidebar entries for the navigation panel. */
	sidebarEntries?: SidebarEntry[];
	/** Notes that link to this page, shown in the back-links footer. */
	backLinks?: BackLinkEntry[];
	/** Vault-relative path of the current note (e.g. "Characters/Lyra.md"). */
	vaultPath?: string;
	/** Extra CSS injected as a <style> block in <head>. */
	customCss?: string;
}

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

// ── Internal layout helpers (v1.3) ────────────────────────────────────────────

function buildSidebarHtml(entries: SidebarEntry[], currentFilename?: string): string {
	const rootNotes = entries.filter((e) => e.folder === "");
	const byFolder = new Map<string, SidebarEntry[]>();
	for (const e of entries.filter((e) => e.folder !== "")) {
		const arr = byFolder.get(e.folder) ?? [];
		arr.push(e);
		byFolder.set(e.folder, arr);
	}

	let html = `<h2>Notes</h2>`;

	if (rootNotes.length) {
		html += `<ul>`;
		for (const e of rootNotes) {
			const active = e.filename === currentFilename ? ` class="pv-sidebar-active"` : ``;
			html += `<li><a href="${escapeHtml(e.filename)}"${active}>${escapeHtml(e.name)}</a></li>`;
		}
		html += `</ul>`;
	}

	for (const [folder, folderNotes] of byFolder) {
		html += `<details class="pv-folder-group" open><summary>${escapeHtml(folder)}</summary><ul>`;
		for (const e of folderNotes) {
			const active = e.filename === currentFilename ? ` class="pv-sidebar-active"` : ``;
			html += `<li><a href="${escapeHtml(e.filename)}"${active}>${escapeHtml(e.name)}</a></li>`;
		}
		html += `</ul></details>`;
	}

	return html;
}

function buildBreadcrumbHtml(vaultPath: string, title: string): string {
	const parts = vaultPath.replace(/\.md$/i, "").split("/");
	if (parts.length <= 1) {
		return `<nav class="pv-breadcrumb" aria-label="Breadcrumb"><a href="index.html">Home</a><span class="pv-bc-sep">›</span><span>${escapeHtml(title)}</span></nav>`;
	}
	const folders = parts
		.slice(0, -1)
		.map((f) => `<span>${escapeHtml(f)}</span>`)
		.join(`<span class="pv-bc-sep">›</span>`);
	return `<nav class="pv-breadcrumb" aria-label="Breadcrumb"><a href="index.html">Home</a><span class="pv-bc-sep">›</span>${folders}<span class="pv-bc-sep">›</span><span>${escapeHtml(title)}</span></nav>`;
}

function buildBackLinksHtml(backLinks: BackLinkEntry[]): string {
	if (backLinks.length === 0) return "";
	const items = backLinks
		.map((b) => `<li><a href="${escapeHtml(b.filename)}">${escapeHtml(b.name)}</a></li>`)
		.join("");
	return `<footer class="pv-backlinks"><h3>Linked from</h3><ul>${items}</ul></footer>`;
}

/**
 * Wrap an HTML fragment in a full HTML5 page with sidebar, breadcrumb,
 * search bar, theme toggle, and optional custom CSS (v1.3+).
 *
 * For backwards compatibility the third argument also accepts a bare string
 * (treated as `cssPath`).
 */
export function wrapInPage(title: string, body: string, optsOrCss: string | WrapPageOptions = {}): string {
	const opts: WrapPageOptions = typeof optsOrCss === "string" ? { cssPath: optsOrCss } : optsOrCss;
	const cssPath = opts.cssPath ?? "styles.css";
	const sidebarEntries = opts.sidebarEntries ?? [];
	const backLinks = opts.backLinks ?? [];
	const vaultPath = opts.vaultPath;
	const customCss = opts.customCss ?? "";

	const currentFilename = vaultPath ? filePathToOutputName(vaultPath) : undefined;
	const sidebarHtml = buildSidebarHtml(sidebarEntries, currentFilename);
	const breadcrumbHtml = vaultPath ? buildBreadcrumbHtml(vaultPath, title) : "";
	const backLinksHtml = buildBackLinksHtml(backLinks);
	const safeCss = customCss.trim().replace(/<\/style>/gi, "/* </style> */");
	const customCssBlock = safeCss ? `\n  <style>\n${safeCss}\n  </style>` : "";

	return `<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <link rel="stylesheet" href="${escapeHtml(cssPath)}">
  <script>try{document.documentElement.setAttribute("data-theme",localStorage.getItem("pv-theme")||"dark")}catch(e){}</script>${customCssBlock}
</head>
<body>
  <header class="pv-header">
    <div class="pv-header-left">
      <a href="index.html" class="pv-site-title">Player Wiki</a>${breadcrumbHtml ? `\n      ${breadcrumbHtml}` : ""}
    </div>
    <div class="pv-header-right">
      <div class="pv-search-wrap">
        <input type="search" id="pv-search" placeholder="Search notes\u2026" aria-label="Search notes">
        <div id="pv-search-dropdown" class="pv-search-dropdown" hidden></div>
      </div>
      <button id="pv-theme-btn" aria-label="Toggle theme">&#x2600;</button>
    </div>
  </header>
  <div class="layout">
    <aside class="sidebar">${sidebarHtml}</aside>
    <main>
      <article class="note-content">
        ${body}
      </article>${backLinksHtml ? `\n      ${backLinksHtml}` : ""}
    </main>
  </div>
  <script src="search-index.js"></script>
  <script src="search.js"></script>
</body>
</html>`;
}

/**
 * Build the index page that lists all exported notes.
 *
 * @param notes       Sorted array of `{name, filename}` pairs.
 * @param optsOrCss   WrapPageOptions (v1.3+) or a bare cssPath string (legacy).
 */
export function buildIndexPage(
	notes: Array<{ name: string; filename: string }>,
	optsOrCss: string | WrapPageOptions = {}
): string {
	const items = notes
		.map(
			({ name, filename }) =>
				`    <li><a href="${escapeHtml(filename)}">${escapeHtml(name)}</a></li>`
		)
		.join("\n");

	const body = `<h1>Player Wiki</h1>\n<ul class="note-index">\n${items}\n</ul>`;
	return wrapInPage("Player Wiki \u2013 Index", body, optsOrCss);
}

// ── v1.3 exported helpers ─────────────────────────────────────────────────────

/** Internal duck type — structurally compatible with the main.ts survivingNotes map. */
type SurvivingEntry = { file: { basename: string; path: string }; sanitized: string; outputFilename: string };

/**
 * Build a map from each note's output filename to the list of notes that
 * contain a wiki-link pointing to it.
 */
export function buildBackLinksMap(
	survivingNotes: Map<string, SurvivingEntry>,
	exportedNoteMap: ExportedNoteMap
): BackLinksMap {
	const map: BackLinksMap = new Map();
	const linkRe = /\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g;

	for (const { file, sanitized, outputFilename: sourceFilename } of survivingNotes.values()) {
		let match: RegExpExecArray | null;
		linkRe.lastIndex = 0;
		while ((match = linkRe.exec(sanitized)) !== null) {
			const target = match[1].trim().toLowerCase();
			const targetFilename = exportedNoteMap.get(target);
			if (!targetFilename || targetFilename === sourceFilename) continue;
			const existing = map.get(targetFilename) ?? [];
			if (!existing.some((e) => e.filename === sourceFilename)) {
				existing.push({ name: file.basename, filename: sourceFilename });
				map.set(targetFilename, existing);
			}
		}
	}
	return map;
}

/**
 * Derive sidebar entries from the surviving notes map.
 * Root notes (no parent folder) get `folder: ""`. Sub-folder notes get the
 * parent path as their folder (e.g. `"Characters"` or `"World/Cities"`).
 */
export function buildSidebarEntries(survivingNotes: Map<string, SurvivingEntry>): SidebarEntry[] {
	return [...survivingNotes.values()]
		.map(({ file, outputFilename }) => {
			const parts = file.path.replace(/\.md$/i, "").split("/");
			const folder = parts.length > 1 ? parts.slice(0, -1).join("/") : "";
			return { name: file.basename, filename: outputFilename, folder };
		})
		.sort((a, b) => {
			if (a.folder === "" && b.folder !== "") return -1;
			if (a.folder !== "" && b.folder === "") return 1;
			const fc = a.folder.localeCompare(b.folder);
			return fc !== 0 ? fc : a.name.localeCompare(b.name);
		});
}

/**
 * Generate the contents of `search-index.js`.
 * Sets `window.PV_SEARCH_INDEX` to an array of `{name, filename, text}` objects.
 */
export function buildSearchIndexJs(entries: SearchEntry[]): string {
	const safe = JSON.stringify(entries)
		.replace(/</g, "\\u003c")
		.replace(/>/g, "\\u003e");
	return `window.PV_SEARCH_INDEX = ${safe};`;
}

/**
 * The contents of `search.js` — handles theme toggle and live search.
 * Written as a standalone IIFE so it works on every page without any build
 * step or module system (also works on file:// protocol).
 */
export const SEARCH_JS = `(function () {
  // Theme toggle
  var applyTheme = function (t) {
    document.documentElement.setAttribute("data-theme", t);
    try { localStorage.setItem("pv-theme", t); } catch (_) {}
    var btn = document.getElementById("pv-theme-btn");
    if (btn) btn.textContent = t === "dark" ? "\u2600" : "\u263d";
  };
  var stored = null;
  try { stored = localStorage.getItem("pv-theme"); } catch (_) {}
  applyTheme(stored || document.documentElement.getAttribute("data-theme") || "dark");
  var themeBtn = document.getElementById("pv-theme-btn");
  if (themeBtn) {
    themeBtn.addEventListener("click", function () {
      var cur = document.documentElement.getAttribute("data-theme");
      applyTheme(cur === "dark" ? "light" : "dark");
    });
  }

  // Search
  var input = document.getElementById("pv-search");
  var dropdown = document.getElementById("pv-search-dropdown");
  if (!input || !dropdown || typeof window.PV_SEARCH_INDEX === "undefined") return;

  input.addEventListener("input", function () {
    var q = this.value.trim().toLowerCase();
    dropdown.innerHTML = "";
    if (!q) { dropdown.hidden = true; return; }
    var hits = window.PV_SEARCH_INDEX.filter(function (n) {
      return n.name.toLowerCase().indexOf(q) !== -1 ||
             n.text.toLowerCase().indexOf(q) !== -1;
    }).slice(0, 12);
    if (!hits.length) { dropdown.hidden = true; return; }
    hits.forEach(function (r) {
      var a = document.createElement("a");
      a.href = r.filename;
      a.className = "pv-search-result";
      a.textContent = r.name;
      dropdown.appendChild(a);
    });
    dropdown.hidden = false;
  });

  document.addEventListener("click", function (e) {
    var wrap = document.querySelector(".pv-search-wrap");
    if (wrap && !wrap.contains(e.target)) dropdown.hidden = true;
  });

  input.addEventListener("keydown", function (e) {
    if (e.key === "Escape") { dropdown.hidden = true; input.value = ""; }
  });
}());
`;
