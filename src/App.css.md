# Application layout and reader styles

`App.css` owns the shelf shell, reader shell, toolbar, panels, PDF and text stages, dialogs, reader themes, and responsive breakpoints.

## Safe-area contract

- `:root` publishes `--safe-area-top`, `--safe-area-right`, `--safe-area-bottom`, and `--safe-area-left` from `env(safe-area-inset-*, 0px)`. The browser reports the sizes; the stylesheet does not detect device models or hard-code status-bar heights.
- The reader shell is the single reader-level consumer. It uses border-box `height: 100vh` with a `100dvh` override and one four-edge safe padding. The 58px toolbar row and `minmax(0, 1fr)` workspace remain unchanged, so the workspace height equals viewport height minus both vertical insets minus 58px. Toolbar, workspace, panels, and reading stages add no safe padding of their own.
- The shelf applies its own insets. In the two-column desktop layout the left column consumes the left inset and the main column consumes the right inset; the `<= 760px` row layout consumes both horizontal insets in the top bar and the content column. Heights use `100vh` with a `100dvh` override. Do not add the top inset to both the mobile top bar and the content below it.
- Fixed overlays cannot inherit shell padding. `.dialog-backdrop` still covers the viewport and pads its content by all four insets; `.dialog` scrolls internally when tall. `.page-status` lifts by the bottom inset.
- Reader theme backgrounds paint the padded reader strips; the shelf and recovery surfaces use their own backgrounds. Safe-area padding is never repeated on individual stages or panels.

## Viewport height

Dynamic viewport units track Safari's collapsing toolbar. `100dvh` is a viewport size, not a soft-keyboard API; keyboard visibility is checked separately in real-device acceptance. Browsers without `dvh` keep the `100vh` fallback.

The automated suite overrides the custom properties with synthetic values. It verifies layout rules only and does not prove that Safari reports the same numbers on a device.

See [Designing Websites for iPhone X](https://webkit.org/blog/7929/designing-websites-for-iphone-x/) and [WebKit dynamic viewport units](https://webkit.org/blog/12445/new-webkit-features-in-safari-15-4/).
