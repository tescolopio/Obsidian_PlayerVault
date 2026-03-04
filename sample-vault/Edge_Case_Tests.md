# Edge Case Tests

This note deliberately exercises the **security and edge-case behaviour** of the exporter.  
Check the rendered HTML to verify each item is handled correctly.

---

## URL Allowlisting

These links use **safe** schemes and should render as clickable `<a>` tags:

- [HTTPS link](https://obsidian.md)
- [HTTP link](http://example.com)
- [Mailto link](mailto:gm@example.com)
- [Relative link](./Welcome.html)
- [Fragment link](#section)

These links use **disallowed** schemes and should be **demoted to plain text** (the label is kept, the URL is dropped):

- [javascript link](javascript:alert('XSS'))
- [data URI link](data:text/html,<h1>injected</h1>)
- [vbscript link](vbscript:MsgBox(1))

---

## Image URL Allowlisting

Safe image — should render as `<img>`:

![Safe image](assets/crest.png)

Unsafe image (data URI) — should render as the **alt text only**, not an `<img>` tag:

![Unsafe image](data:image/svg+xml,<svg><script>alert(1)</script></svg>)

---

## Raw HTML in Note Text

The following line contains a raw `<script>` tag. It must appear **escaped** in the output (`&lt;script&gt;`), never as an executable tag:

A crafted line: <script>alert('stored XSS')</script>

---

## HTML in Formatting

Bold containing raw HTML — the HTML must be escaped, but `<strong>` must still wrap it:

**<evil-tag>dangerous content</evil-tag>**

Inline code containing raw HTML — the content must be escaped inside `<code>`:

`<script>alert(1)</script>`

---

## Orphan Wiki-Links

These wiki-links point to notes that are either GM-only or don't exist.
They should render as **plain text**, not `<a>` tags:

- Link to the fully-excluded GM note: [[GM_Session_Notes]]
- Link to a non-existent note: [[Dragon Lair Level 3]]
- Link with alias to non-existent note: [[Secret Passage|the hidden door]]

---

## Valid Wiki-Links

These should resolve to clickable links:

- [[Welcome]]
- [[Thornwall]]
- [[The Rusty Flagon|The Flagon]]
- [[Characters/Lyra Silverwind|Lyra]] ← sub-folder note via basename

---

## Obsidian Comment Block

The block below is an Obsidian comment. It is **invisible in Obsidian Reading view**.
It will appear in the exported HTML **unless** "Strip all Obsidian comments" is enabled.

%%
This content should only appear in the export if strip-all-comments is OFF.
Enable the setting and re-export to verify it disappears.
%%
