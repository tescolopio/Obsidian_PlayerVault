/** Default secret tag patterns used to identify GM-only content */
export const DEFAULT_SECRET_PATTERNS = [
	/%%SECRET%%[\s\S]*?%%SECRET%%/gi,
	/%%GM%%[\s\S]*?%%GM%%/gi,
];

/** Matches > [!gm-only] callout blocks (all indented lines after the opener) */
const GM_ONLY_CALLOUT_RE =
	/^> \[!gm-only\][^\n]*(?:\n>(?:[^\n]*)?)*/gim;

/** Matches Obsidian comment blocks: %% ... %% */
const OBSIDIAN_COMMENT_RE = /%%[\s\S]*?%%/g;

/**
 * Options for the sanitizer.
 */
export interface SanitizerOptions {
	/** Additional regex patterns whose matching content should be stripped */
	extraPatterns?: RegExp[];
	/** Whether to strip all Obsidian comments (%% ... %%) regardless of content */
	stripAllComments?: boolean;
}

/**
 * Sanitize the content of a note by removing GM-only / secret sections.
 *
 * Removes:
 * - `%%SECRET%% … %%SECRET%%` blocks
 * - `%%GM%% … %%GM%%` blocks
 * - `> [!gm-only]` callout blocks (all continuation lines included)
 * - Any extra patterns supplied via `options.extraPatterns`
 * - Optionally, all Obsidian comment blocks (`%% … %%`)
 *
 * @param content  Raw markdown content of the note
 * @param options  Optional extra patterns and flags
 * @returns        Sanitized markdown
 */
export function sanitizeContent(
	content: string,
	options: SanitizerOptions = {}
): string {
	let result = content;

	// Strip default secret tag pairs
	for (const pattern of DEFAULT_SECRET_PATTERNS) {
		result = result.replace(new RegExp(pattern.source, pattern.flags), "");
	}

	// Strip > [!gm-only] callout blocks
	result = result.replace(GM_ONLY_CALLOUT_RE, "");

	// Strip extra caller-supplied patterns
	if (options.extraPatterns) {
		for (const pattern of options.extraPatterns) {
			result = result.replace(
				new RegExp(pattern.source, pattern.flags),
				""
			);
		}
	}

	// Optionally strip all remaining Obsidian comments
	if (options.stripAllComments) {
		result = result.replace(OBSIDIAN_COMMENT_RE, "");
	}

	// Collapse 3+ blank lines down to 2 (tidy up the gaps left by removal)
	result = result.replace(/\n{3,}/g, "\n\n");

	return result.trim();
}

/**
 * Returns `true` when the note's entire content should be excluded from the
 * export (i.e. the whole note is tagged as secret).
 *
 * A note is considered fully secret when its front-matter contains
 * `gm-only: true` (case-insensitive, optional spaces around the colon).
 */
export function isNoteFullySecret(content: string): boolean {
	const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
	if (!fmMatch) return false;
	return /^gm-only\s*:\s*true\s*$/im.test(fmMatch[1]);
}
