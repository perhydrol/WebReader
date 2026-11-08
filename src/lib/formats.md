# Import format validation

`formats.ts` decides whether a selected file may enter the local library. It is the only import gate; the library must never receive a format that the reader cannot handle safely.

## Contracts

- Empty files and files over 250 MB are rejected before inspection.
- PDF requires the `%PDF-` signature plus a PDF media type or `.pdf` name. EPUB requires a ZIP signature plus an EPUB media type or `.epub` name, then the bounded container preflight.
- TXT accepts `text/plain` or a `.txt` name. TXT files over 8 MB are rejected with `textFileTooLarge`.
- Markdown is not supported. A `.md`/`.markdown` name or `text/markdown` media type is rejected with `unsupportedFormat` even when the other hint says plain text, so it cannot bypass the import restriction.
- `isLegacyMarkdownRecord` identifies old library rows that were stored as `format: "txt"` but carry a Markdown name or media type. The library keeps those rows and their source blobs, blocks opening, and allows deletion. No migration or automatic conversion runs.
- `displayTitle` derives a readable title for the supported extensions only.

Signature checks are deliberately kept alongside suffix/media hints; a `.md` rejection does not replace PDF/EPUB validation.
