# Application shell

`App.tsx` coordinates the local shelf, import/delete flows, reader toolbar and panels, preferences, shortcuts, and format dispatch. It owns no file parsing or reading DOM.

## Contracts

- Import validates through `detectBookFormat`, fingerprints locally, detects duplicates, writes metadata plus source blob in one transaction, and refreshes the shelf. Rejected files never create a row.
- `openBook` first checks `isLegacyMarkdownRecord`. A legacy Markdown row shows `markdownUnsupported`, does not load its blob, and remains deletable from the shelf. Other books load their blob and mount the format-specific reader.
- The TXT reader is keyed by book id and receives the shared `onKeyDown` handler so keys pressed inside the paginator iframe still reach reader shortcuts. It also receives the current reading profile, preferences, locator, and progress callbacks.
- Progress and preference writes use the coalescing queue and are flushed when leaving the reader or hiding the page. The reader profile is remembered per book and written through the same ordered profile queue.
- Capabilities from the active reader drive the outline/search buttons and the page-turn overlays. TXT advertises both reading profiles and search.

The shelf remains usable if a reader fails; the root error boundary provides a local recovery path. See `AGENTS.md` for the product boundary and persistence invariants.

Reader chrome and modal sheet behavior are delegated to ReaderToolbar, ReaderSheet and useReaderChrome. App retains storage and reader identity. TXT content emits session-scoped UI interactions; no panel or chrome state changes the reader key or viewport. LibraryView owns shelf presentation and local settings navigation.

The reader follows system appearance by default. App resolves followSystemTheme to a concrete night/white theme without changing reader identity; explicit manual theme selection opts out. System media listeners are removed on unmount.

The optional-font hook restores a cached font at application startup. Effective reader preferences temporarily fall back to serif until the verified font is ready, preserving the stored choice. Settings and library receive the shared availability state.

Reading settings receive stored preferences so edits to other fields cannot persist an effective font fallback. Rendering adapters continue to receive effective preferences.

App synchronizes the root canvas, CSS color-scheme and both browser theme-color meta tags with the current shelf or reading background. Layout effect updates before paint, depends only on resolved appearance and restores previous document values on cleanup. This changes the page behind system UI; it does not hide iOS status icons.

Feedback opens a guidance dialog with an explicit external GitHub Issues link. It collects no text, attaches no local data, and uses a new page with noopener/noreferrer.
