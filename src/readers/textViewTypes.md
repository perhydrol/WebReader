# Shared TXT view contract

`textViewTypes.ts` defines the interface used by `TextReader` for both TXT views.

- `TextViewProps` carries the source model, preferences, initial source offset, active search range, layout revision, offset reporter, and readiness reporter.
- `TextViewHandle` exposes `goTo`, `previous`, and `next`. Both views implement it with native controls: Virtuoso scrolling or paginator page turns.
- `TextMatch` is an absolute source range, never a rendered page or character index.

Keep this file type-only. View-specific behavior belongs in the corresponding component.
