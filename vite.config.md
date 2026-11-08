# Build configuration

React and Tailwind compile local components and Konsta theme classes. PWA precaching includes generated application resources only, without runtime caching. Relative asset paths preserve the Pages subpath. The prompt update strategy keeps active reading intact until activation.

The fonts directory is excluded from Workbox precaching. Optional font bytes are fetched only by the explicit download flow; licensing assets remain reachable as same-origin static files.

The installed manifest uses the light shelf background as its launch/theme fallback; live appearance is synchronized by App. iOS home-screen status-bar mode is declared in [the HTML entry](index.html.md).
