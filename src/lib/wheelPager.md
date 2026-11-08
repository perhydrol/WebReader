# Wheel pagination helpers

`wheelPager.ts` turns accumulated wheel movement into one page-turn intent per gesture.

- `WheelGesture` accumulates deltas in one direction and locks after crossing the threshold. A quiet period or a direction change starts a new gesture. An ineligible scroll boundary prevents a turn until the next gesture.
- `normalizedWheelDelta` converts line/page delta modes into pixels so mouse, trackpad, and page-mode wheels behave consistently.
- `shouldIgnoreWheel` skips modified, prevented, editable-control, and active-selection wheels. It uses structural checks (`closest`, `ownerDocument.getSelection`) rather than parent-realm `instanceof`, because wheel events can originate inside the same-origin paginator iframe.

The helper is used by the EPUB and TXT paged readers. Scrollable article modes decide boundary eligibility before calling it.
