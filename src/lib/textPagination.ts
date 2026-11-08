export interface SourceRange {
  start: number;
  end: number;
}

export function findSourceRangeIndex(ranges: readonly SourceRange[], offset: number): number {
  if (ranges.length === 0) return -1;
  let low = 0;
  let high = ranges.length;
  while (low < high) {
    const middle = low + Math.floor((high - low) / 2);
    if (ranges[middle]!.start <= offset) low = middle + 1;
    else high = middle;
  }
  return Math.max(0, low - 1);
}

export function sourceOffsetForRange(
  ranges: readonly SourceRange[],
  offset: number,
): { index: number; offset: number } | undefined {
  if (ranges.length === 0) return undefined;
  const index = findSourceRangeIndex(ranges, offset);
  const range = ranges[index]!;
  if (offset <= range.end || index === ranges.length - 1) {
    return { index, offset: Math.min(range.end, Math.max(range.start, offset)) };
  }
  const next = ranges[index + 1]!;
  return { index: index + 1, offset: next.start };
}
