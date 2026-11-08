# TXT reader coordinator

`TextReader.tsx` owns TXT decoding, the source model, the progress/search controller, and dispatch between the scroll and paged views. It does not keep a second rendered copy of the document.

## Contracts

- Decoding keeps the existing strict UTF-8 path, then GB18030, then the platform fallback. The source model strips one leading BOM; all locators use the resulting UTF-16 offsets.
- The reading profile selects `TextScrollView` or `TextPagedView`. Both receive the same model, preferences, and current source offset. On a mode switch, the current offset ref is the handoff; no pixel, page, or fragment index is persisted.
- `activeProfileRef` gates offset/ready callbacks. A late callback from the previous view cannot overwrite the new view's progress.
- Progress is reported from visible source text, normalized against visible paragraphs, and written through the existing 250 ms debounce. Unmount flushes the pending locator. The stage publishes `data-source-offset` and `data-view-ready` for source-aware checks and the loading boundary.
- Search uses the complete source string and the bounded `findTextMatches`. `goToSearch` records the active range and asks the current view to restore it. Closing the search panel clears the active range.
- An empty or whitespace-only document reports the existing empty-text state; decode failure reports `textDecodeFailed`.

App keys this component by book id and blocks legacy Markdown records before it mounts, so a file change always starts from a fresh model.
