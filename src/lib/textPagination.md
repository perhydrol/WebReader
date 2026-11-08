# TXT source range utilities

`textPagination.ts` now contains only range lookup still used by the TXT source model. The former whole-book column geometry, page extent, and page-index assumptions were removed when paged TXT moved to the local foliate paginator.

- `findSourceRangeIndex` binary-searches the last range whose start is at or before an offset.
- `sourceOffsetForRange` clamps an offset into a range, maps a gap to the next range start, and clamps past the end to the last range end.
- Ranges are `{ start, end }` in source UTF-16 units. Display extents and page numbers are not part of this module.
