# TXT source model

`textDocument.ts` is the single source of truth for TXT structure. It never stores a second copy of the book text; every paragraph, fragment, and chapter is a range over the BOM-stripped source string.

## Contracts

- Offsets are UTF-16 code units in the source after a leading BOM is removed. They are not bytes, code points, page numbers, or fragment indexes.
- Paragraph ranges come from one line scan. Every LF, CRLF, or CR starts a new paragraph without requiring a blank line; a paragraph's trailing whitespace is trimmed but its leading whitespace is preserved. Paragraph ranges are allowed to have gaps, and whitespace-only gaps are never rendered as paragraphs.
- Display fragments are at most 4000 source units. A split prefers the last whitespace before the limit, then avoids splitting a surrogate pair or a CRLF pair. Fragments keep exact source ranges and `continuesPrevious`/`continuesNext`; they never trim source text.
- Chapters pack fragments until the chapter's source span would exceed 48×1024 units. A single huge paragraph therefore crosses chapters. Chapter IDs and fragment IDs are derived from stable source ranges.
- `clampToVisibleOffset` maps a position inside an inter-paragraph gap to the next visible character. Positions after the last visible character clamp to its end; an empty document clamps to 0.
- The automatic outline is generated from the same paragraph scan and existing chapter-heading rule. Fragmenting must never change outline targets.
- Search uses the complete source string. `visibleOverlaps` returns only intersections with visible paragraph ranges, so a match crossing a gap highlights visible text without inventing whitespace.

## Boundaries

The model does not decode bytes, render DOM, paginate, or persist anything. `TextReader` owns decoding and persistence; `TextScrollView` and `TextPagedView` turn ranges into DOM. Markdown semantics are intentionally absent: fence markers, headings, and raw HTML stay literal TXT text.
