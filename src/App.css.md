# Application layout and reader styles

`App.css` owns the shelf shell, reader shell, toolbar, panels, PDF and text stages, dialogs, reader themes, and responsive breakpoints.

## TXT stages

- `.text-stage-scroll` is a non-scrolling host. `react-virtuoso` owns `.text-scroll-list`; `.text-scroll-item` centers a content-width column inside fixed side padding. The list's top and bottom padding belongs to scroll content, so a restored mid-document target sits at the viewport top edge while the very start of the document keeps the inset.
- `.text-stage-paged` hosts `.text-paginator`. The foliate paginator renders inside its own iframe, so parent `article`/`p` styles do not apply. Typography, theme color, paragraph spacing, indentation, and the in-document highlight rule come from `buildTextBookStyles`.
- `.text-fragment` keeps source newlines with `pre-wrap` and permits long unbroken text to wrap. Paragraph spacing is padding on the last fragment; continuation fragments add no indent or spacing. There are no Markdown block classes.
- `.text-status` is the only loading/empty state inside the stage. It must remain centered without adding scrollable content.
- Scroll highlights use the global `.text-search-highlight`. Paged highlights reuse the class inside the generated document without padding so marking text cannot reflow the paginator.
- Theme selectors on `.text-stage` color scroll content; paged content reads the same colors from `TEXT_THEME_COLORS` because it cannot inherit from the parent document.

## Safe-area contract

- `:root` publishes `--safe-area-top`, `--safe-area-right`, `--safe-area-bottom`, and `--safe-area-left` from `env(safe-area-inset-*, 0px)`. The browser reports the sizes; the stylesheet does not detect device models or hard-code status-bar heights.
- The reader shell is the single reader-level consumer. It uses border-box `height: 100vh` with a `100dvh` override and one four-edge safe padding. A single `minmax(0, 1fr)` workspace fills the safe rectangle. The floating bottom toolbar never changes it. Sheet geometry consumes the same safe rectangle independently as a fixed overlay; reading stages add no safe padding.
- The shelf applies its own insets. In the two-column desktop layout the left column consumes the left inset and the main column consumes the right inset; the `<= 760px` row layout consumes both horizontal insets in the top bar and the content column. Heights use `100vh` with a `100dvh` override. Do not add the top inset to both the mobile top bar and the content below it.
- Fixed overlays cannot inherit shell padding. `.dialog-backdrop` still covers the viewport and pads its content by all four insets; `.dialog` scrolls internally when tall. `.page-status` lifts by the bottom inset.
- Reader theme backgrounds paint the padded reader strips; the shelf and recovery surfaces use their own backgrounds. Safe-area padding is never repeated on individual stages or panels.

## Viewport height

Dynamic viewport units track Safari's collapsing toolbar. `100dvh` is a viewport size, not a soft-keyboard API; keyboard visibility is checked separately in real-device acceptance. Browsers without `dvh` keep the `100vh` fallback.

The automated suite overrides the custom properties with synthetic values. It verifies layout rules only and does not prove that Safari reports the same numbers on a device.

See [Designing Websites for iPhone X](https://webkit.org/blog/7929/designing-websites-for-iphone-x/) and [WebKit dynamic viewport units](https://webkit.org/blog/12445/new-webkit-features-in-safari-15-4/).

## Component layers

Legacy rules live in the base layer so Konsta utilities can apply their published appearance. Unlayered layout rules govern: the invariant reading viewport, floating chrome, sheet visual-viewport rectangle, and dialog centering. Sheet translation is neutralized because its bottom position already places it in the visible rectangle.

Neutral shelf actions opt into ShelfButton, which uses public Konsta colors and rounded props. No broad .k-button appearance override applies to segmented controls. This stylesheet retains local layout, neutral notice colors, night reader icon foregrounds and destructive-action red.

Settings keep their title and close action above the mode control, within one scroll owner. Search uses three bounded columns for field, clear and submit. Shelf notices, language selections and reader selection rings use neutral colors. Continue-reading headings retain separation from their action; book metadata shares one centered column.
