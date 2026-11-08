# Bounded TXT chapter book

`textBook.ts` adapts the TXT source model to the local foliate paginator without creating an EPUB or a whole-book DOM.

## Contracts

- `buildChapterHtml` emits a minimal HTML document. Every source slice is escaped (`&`, `<`, `>`, quotes) and placed in a `span.text-fragment` carrying its absolute source range. Raw TXT markup, scripts, links, and images remain literal text.
- Carriage returns are emitted as `&#13;` because the HTML parser normalizes raw CRLF/CR to LF before tokenization. The character reference keeps the CR in the DOM, so DOM text length and source length stay equal for offset mapping and highlighting.
- Consecutive fragments from one paragraph share one `p.text-fragment-group`. A group whose first fragment continues a previous chapter gets `continues-previous` so it receives no first-line indent.
- `createTextBook` creates one lazy section per source chapter. `load()` returns a blob URL for the chapter HTML; `unload()` and `destroy()` revoke it. A section only creates a URL when the paginator asks for it, so at most the current chapter document exists. After `destroy()`, `load()` returns an empty string so a paginator navigation that resumes after unmount cannot create an unreachable URL.
- `buildTextBookStyles` owns iframe typography, theme colors, paragraph spacing, indentation, and the in-document highlight rule. The paginator applies it to each loaded chapter. Parent `App.css` rules do not cross the iframe boundary.
- The book object exposes only `dir`, `sections`, and `destroy`; the TXT locator remains the source offset, not a CFI.

Failure to create or load a blob URL is left to the paginator's local view failure path; no source text is transmitted or synthesized.

Selected WenKai includes the verified session-blob @font-face for isolated paginator documents; ownership is defined in [optionalFont](optionalFont.md).
