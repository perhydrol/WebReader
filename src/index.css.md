# Document canvas

Defines full-width document roots and a pre-React light/dark canvas with matching color-scheme. App owns the active inline canvas and browser theme color after mount, including manual reading themes. This background fills the safe-area regions; App.css continues to own layout insets.

Body, React root and the Konsta application wrapper explicitly inherit the document canvas color. This prevents transparent intermediate layers from providing a light backing surface when iOS samples page/overscroll backgrounds. Safe-area padding and viewport heights are unchanged; no device-specific height or screen-height compensation is added.

The default status-bar mode is retained after the translucent mode produced a device-reported bottom gutter. This is a compatibility fallback, not proof of native viewport correctness. WebKit reports [313800](https://bugs.webkit.org/show_bug.cgi?id=313800) and [301994](https://bugs.webkit.org/show_bug.cgi?id=301994) describe inaccessible standalone strips and cached background colors; the current device still needs acceptance after publication.
