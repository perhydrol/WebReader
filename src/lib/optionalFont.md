# Optional reading font

Owns the page-session font resource and `webreader-optional-fonts-v1` Cache Storage cache. Initialization reads only the versioned same-origin asset key from this cache; it never downloads a missing font. An explicit settings action downloads with a 120-second timeout. Concurrent initialization/download calls share one operation. HTTP, byte length, SHA-256, browser decoding and persistent cache writes must all succeed before publishing ready. Failed or corrupt cached entries become unavailable and can be downloaded again. Failures remain retryable.

The loaded FontFace serves the host document. A session-lifetime object URL serves the same verified bytes to the isolated TXT/EPUB iframe styles. It remains valid across reader mounts and is reclaimed by the browser with the page; failed persistence releases it and removes the face. Readers fall back without rewriting the stored font choice while the cache is unavailable or being restored. Cache eviction may require another explicit download. This cache contains only the public font, never book content. It is separate from Workbox application-shell caches and survives their cleanup.

Asset provenance, regeneration and licensing belong to [the font asset README](../../public/fonts/README.md).
