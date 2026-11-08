# Reader chrome acceptance

Production Chrome checks theme availability and invariant reading geometry when opening sheets and changing mode. Synthetic text only. Mobile viewport tests do not certify iPhone PWA rendering performance.

Dark appearance checks pale action labels and bounded neutral dark backgrounds, catching accidental fallback to saturated component accent colors.

Narrow-screen assertions cover header-before-mode order, bounded mode controls, three aligned search controls, neutral notifications and live system appearance with manual override. The iframe tap test waits in real time beyond the delayed tap, avoiding a false pass from frame clock differences.

Checks icon-only back navigation, default transparent segmented button surfaces, pane-confined blur and the 12px gap above the safe bottom.

The unified upload acceptance opens the native file chooser and imports a synthetic TXT, then drops a second synthetic file into the same area. The old title action must be absent.
