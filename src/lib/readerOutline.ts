import type { ReaderOutlineItem } from "../types/reader";

/** Numeric targets are ordered source offsets (TXT) or page numbers (PDF); hrefs match exactly. */
export function currentOutlineItem(items: ReaderOutlineItem[], currentTarget?: string): ReaderOutlineItem | undefined {
  if (currentTarget === undefined) return undefined;
  const position = /^\d+$/.test(currentTarget) ? Number(currentTarget) : undefined;
  let exact: ReaderOutlineItem | undefined;
  let preceding: ReaderOutlineItem | undefined;
  let precedingPosition = -1;
  const visit = (entries: ReaderOutlineItem[]) => {
    for (const item of entries) {
      if (item.target === currentTarget && !exact) exact = item;
      if (position !== undefined && item.target !== undefined && /^\d+$/.test(item.target)) {
        const target = Number(item.target);
        if (target <= position && target > precedingPosition) {
          preceding = item;
          precedingPosition = target;
        }
      }
      visit(item.children);
    }
  };
  visit(items);
  return exact ?? preceding;
}
