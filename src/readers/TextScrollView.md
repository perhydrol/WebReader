# Virtualized TXT scroll view

`TextScrollView.tsx` renders the bounded Virtuoso window for TXT. Each list item is one 4000-unit source fragment; only the viewport plus a limited top/bottom pre-read is mounted.

## Contracts

- `goTo` binary-searches the fragment, asks Virtuoso for that index with start alignment, then corrects inside the fragment using a DOM `Range`. The correction targets the text top inset and retries while Virtuoso mounts or measures. A token prevents a stale correction from winning.
- While a restore runs, scroll callbacks do not write progress. When the restore finishes, the actual visible source offset is measured and reported once.
- Scroll progress is measured from the first visible text line with `caretRangeFromPoint` (or `caretPositionFromPoint`), then clamped to visible source ranges. When caret lookup is unavailable or inert content cannot be hit-tested, a bounded binary search over source Range geometry finds the first visible character. Missing geometry retains the last known offset. The end of the scroller reports the document end.
- The layout effect restores the last source offset after typography or explicit layout revision changes; overlay panels do not supply a revision. A `ResizeObserver` on the scroller restores it after viewport changes. Neither stores scroll pixels or item indexes in the locator.
- Highlighting is rendered inside the fragment source span. Removing a highlight does not change source ranges or copied text.
- `onReady` fires after the first successful restore. It is the view-ready signal consumed by `TextReader`.

## Selection boundary

The browser selection is native. Because offscreen items are unmounted, a selection whose nodes are virtualized away is lost, and `Ctrl+A` selects only mounted fragments. Chrome serializes the block boundary between mounted fragment items as a line break, so copying across a fragment boundary can insert a newline that is not in the source; the source characters themselves are unchanged. Full-book finding remains the in-book search. No custom selection editor or unbounded retained selection list is added here.

One content interaction bridge is bound to the Virtuoso scroller. Callback refs avoid rebinding on chrome updates; scroller replacement/unmount removes listeners and releases session locks.
