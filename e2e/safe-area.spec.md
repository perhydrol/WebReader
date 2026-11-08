# Safe-area regression suite

`safe-area.spec.ts` verifies the layout rules behind `viewport-fit=cover`. It runs in the desktop Chrome project and resizes the page within that project to synthetic portrait and landscape viewports; the inset numbers are test scenarios, not measurements of a particular device.

Coverage:

- The production HTML declares `width=device-width`, `initial-scale=1.0`, and `viewport-fit=cover`.
- Zero insets keep the 1440x900 shelf, dialog, and text reader geometry unchanged, and `:root` still publishes the safe-area custom properties.
- Portrait insets keep the shelf top bar, dialog (including full-viewport backdrop coverage), reader toolbar controls, reading surface, outline, search, and settings panels inside the safe rectangle. The floating toolbar does not consume a layout row, the workspace subtracts both vertical insets once, and a viewport change updates the reading area while keeping the current source block visible.
- Landscape insets protect both horizontal sides, keep the desktop sidebar and main column aligned, preserve the night-theme reader background, and lift the fixed PDF page indicator by the bottom inset.

The suite checks layout rules only. It does not replace Safari and home-screen PWA acceptance, and it does not prove the inset values Safari reports. See [src/App.css.md](../src/App.css.md) for the layout contract.
