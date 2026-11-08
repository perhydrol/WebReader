# Foliate declarations

`foliate.d.ts` declares the small parts of the installed `foliate-js` package used by the EPUB and TXT readers. The package ships JavaScript without TypeScript declarations.

- `foliate-view` is used only by `EpubReader`; its renderer exposes the foliate methods and properties used for mode changes, search, annotations, and cleanup.
- `foliate-paginator` is used directly by `TextPagedView`: `open`, `goTo`, `prev`, `next`, `setStyles`, `destroy`, and `getContents`. The paginator's shadow root is closed, so the declarations intentionally expose no shadow internals.
- The book/section shapes match the current installed version's lazy `load`/`unload` contract. Do not invent CFI or transform methods that the installed package does not provide.
- Before upgrading foliate-js, re-check its source for these methods, events, and the paginator's behavior; update the declarations and both readers together.

See `src/readers/TextPagedView.md` for the TXT-specific lifecycle.
