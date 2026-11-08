# Optional font acceptance

Uses the actual bundled WOFF2 asset and Chrome font decoder. Covers no initial font request, explicit download, network failure and retry, visible loading state, persisted availability and reading preference across offline reload. Browser storage and synthetic TXT inputs are isolated per test. This is a desktop browser check, not an iPhone hardware measurement.

Checks actual loaded FontFace records inside TXT and EPUB paginator documents, host scroll typography, unavailable-option hiding and rejection/removal of corrupt downloads and cache entries.
