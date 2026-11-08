# LXGW WenKai Regular asset

This directory distributes LXGW WenKai Regular v1.530, converted without subsetting to WOFF2. It is an optional same-origin download, excluded from Workbox precaching. Runtime ownership and validation are defined in [optionalFont](../../src/lib/optionalFont.md).

- Upstream: https://github.com/lxgw/LxgwWenKai/releases/tag/v1.530
- Source: https://github.com/lxgw/LxgwWenKai/releases/download/v1.530/LXGWWenKai-Regular.ttf
- Source SHA-256: `2d73eea94ad808999d90c0000c239a84a33b09d4bc6ab6c5b8bbf1eda8a7fc8b`
- WOFF2 SHA-256: `81112edef5daa14ecd5706a59707fa61265d0261b4906f995ef1b6f05fbddf62`
- WOFF2 size: 8,098,872 bytes. Character map: 46,926 Unicode entries; glyph order: 47,336 glyphs. Both match the source.
- License and copyright: [SIL OFL 1.1 with upstream additional permission](OFL-LXGWWenKai.txt). The font remains under this license independently of application code.

## Regeneration

1. Download the pinned source to an ignored temporary directory and verify its source SHA-256.
2. Convert with `uv run --with 'fonttools[woff]==4.68.0' python -c 'from fontTools.ttLib import TTFont; f=TTFont("LXGWWenKai-Regular.ttf"); f.flavor="woff2"; f.save("LXGWWenKai-Regular.woff2")'` in that directory. Conversion may change the font modification timestamp, so a regenerated binary can have a different hash.
3. Reopen source and output with TTFont and compare `getBestCmap()` and `getGlyphOrder()` for equality. Compute the resulting file length and SHA-256.
4. Copy the generated WOFF2 here, update this provenance and the validator together, and retain the pinned upstream license. Never edit generated font bytes manually.
