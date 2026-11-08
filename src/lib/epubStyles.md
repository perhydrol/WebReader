# EPUB appearance styles

Builds publication-scoped typography and paired foreground/background rules for text, surfaces and code. Publisher mode leaves font family intact; user typography overrides stay within reflowable-reader capabilities. Media and SVG are not recolored by text-surface rules.

WenKai injects a verified session-blob @font-face into the publication document only when selected. It introduces no remote publication font request. Font ownership is defined in [optionalFont](optionalFont.md).
