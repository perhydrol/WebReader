# TXT DOM source mapping

`textDom.ts` maps between rendered TXT DOM and absolute source offsets. Both TXT views mark every visible source slice with `data-source-start` and `data-source-end` whose text is exactly the corresponding source range.

## Contracts

- `sourceOffsetFromDomPoint` walks to the nearest source element and measures the text between its start and the point. It does not depend on a text node index, so adding or removing search marks does not invalidate the mapping.
- `sourceOffsetFromDomRange` is used for paginator visible ranges. If the start is inside a source element, including a search `<mark>` or the span itself, it measures from the span start. If the start is on an ancestor such as a paragraph or body, it falls back to the first source element at or inside the range (`Range.comparePoint`). Both paths are required by foliate's visible ranges.
- Paged chapter HTML keeps CRLF as DOM text through the `&#13;` encoding in `textBook.ts`, so source and DOM lengths agree and no separate CRLF offset map is needed.
- `rangeForLocalOffset` and `rangeRectForLocalOffset` walk the current text nodes, so they remain valid after highlight wrapping. `rangeRectForLocalOffset` falls back to the preceding character for an end-of-element offset.
- `wrapSourceOverlap` highlights one source element at a time. It never wraps a range across elements. `clearHighlightMarks` unwraps marks and normalizes the parent.
- Callers must clamp offsets with the source model before using these helpers; gaps have no DOM counterpart.

Ephemeral marks are safe to remove at any time. Do not cache `Text` node references across a highlight change.
