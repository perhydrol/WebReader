import { describe, expect, it } from "vitest";
import { findSourceRangeIndex, sourceOffsetForRange } from "./textPagination";

const ranges = [
  { start: 0, end: 10 },
  { start: 14, end: 24 },
  { start: 30, end: 40 },
];

describe("text source ranges", () => {
  it("finds source blocks without scanning from the beginning", () => {
    expect(findSourceRangeIndex(ranges, 0)).toBe(0);
    expect(findSourceRangeIndex(ranges, 18)).toBe(1);
    expect(findSourceRangeIndex(ranges, 100)).toBe(2);
  });

  it("normalizes offsets that fall between text blocks", () => {
    expect(sourceOffsetForRange(ranges, 8)).toEqual({ index: 0, offset: 8 });
    expect(sourceOffsetForRange(ranges, 12)).toEqual({ index: 1, offset: 14 });
    expect(sourceOffsetForRange(ranges, 100)).toEqual({ index: 2, offset: 40 });
  });

  it("clamps offsets before the first block and handles empty ranges", () => {
    expect(sourceOffsetForRange(ranges, -4)).toEqual({ index: 0, offset: 0 });
    expect(sourceOffsetForRange([], 4)).toBeUndefined();
  });
});
