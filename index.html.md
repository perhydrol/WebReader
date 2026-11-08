# Application HTML entry

`index.html` declares the document viewport, theme color, description, content security policy, icon, and the root element mounted by `src/main.tsx`.

The viewport keeps `width=device-width` and `initial-scale=1.0` and adds `viewport-fit=cover` so iOS Safari and the installed home-screen app expose `env(safe-area-inset-*)` values to `src/App.css`. Without the cover fit the browser reports zero insets; do not replace it with device detection or fixed status-bar heights.

The content security policy, theme color, icon path, and module entry are independent of layout preferences. Keep asset paths relative so workers, the manifest, icons, and chunks resolve beneath the GitHub Pages repository subpath.

For the layout contract that consumes the reported insets, see [src/App.css.md](src/App.css.md). For authoritative WebKit behavior, see [Designing Websites for iPhone X](https://webkit.org/blog/7929/designing-websites-for-iphone-x/).
