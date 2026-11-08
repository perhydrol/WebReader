# Shared TXT display constants

`textDisplay.ts` holds values that must agree between the React scroll view and the paginator iframe document.

- `TEXT_FONT_STACK` keeps the three local font choices. No remote font is added here.
- `TEXT_CONTENT_WIDTH` is the narrow/standard/wide source-column width used by both views.
- `TEXT_THEME_COLORS` maps each reader theme to background, text, highlight, and highlight-text colors. The paginator iframe cannot inherit the parent theme, so it reads these values through `textBook.ts`.
- `textTypographyStyle` converts preferences into the inline style used by scroll fragments.

Change a preference or theme color here rather than duplicating it in the reader components.

WenKai uses the session-loaded WebReader WenKai family with local serif fallback; the host FontFace is owned by [optionalFont](optionalFont.md).
