# Virtualized TXT scroll view

`TextScrollView.tsx` renders the bounded Virtuoso window for TXT. Each list item is one 4000-unit source fragment; only the viewport plus a limited top/bottom pre-read is mounted.

## Contracts

- `goTo` binary-searches the fragment, asks Virtuoso for that index with start alignment, then corrects inside the fragment using a DOM `Range`. The correction targets the text top inset and retries while Virtuoso mounts or measures. A token prevents a stale correction from winning.
- While a restore runs, scroll callbacks do not write progress. When the restore finishes, the actual visible source offset is measured and reported once.
- Scroll progress is measured from the first visible text line with `caretRangeFromPoint` (or `caretPositionFromPoint`), then clamped to visible source ranges. If caret lookup is unavailable, the first mounted source element is the fallback. The end of the scroller reports the document end.
- The layout effect restores the last source offset after typography or panel changes. A `ResizeObserver` on the scroller restores it after viewport changes. Neither stores scroll pixels or item indexes in the locator.
- Highlighting is rendered inside the fragment source span. Removing a highlight does not change source ranges or copied text.
- `onReady` fires after the first successful restore. It is the view-ready signal consumed by `TextReader`.

## Selection boundary

The browser selection is native. Because offscreen items are unmounted, a selection whose nodes are virtualized away is lost, and `Ctrl+A` selects only mounted fragments. Chrome serializes the block boundary between mounted fragment items as a line break, so copying across a fragment boundary can insert a newline that is not in the source; the source characters themselves are unchanged. Full-book finding remains the in-book search. No custom selection editor or unbounded retained selection list is added here.
