import { describe, expect, it } from "vitest";
import {
  TEXT_CHAPTER_MAX_UNITS,
  TEXT_FRAGMENT_MAX_UNITS,
  buildTextSourceModel,
  clampToVisibleOffset,
  findChapterIndex,
  findFragmentIndex,
  findParagraphIndex,
  visibleOverlaps,
  type TextSourceModel,
} from "./textDocument";

function fragmentText(model: TextSourceModel, index: number): string {
  const fragment = model.fragments[index]!;
  return model.text.slice(fragment.start, fragment.end);
}

describe("text paragraphs", () => {
  it("splits paragraphs while retaining exact source offsets", () => {
    const model = buildTextSourceModel("First paragraph.\n\nSecond paragraph.");
    expect(model.paragraphs).toEqual([
      { id: "paragraph:0:16", start: 0, end: 16 },
      { id: "paragraph:18:35", start: 18, end: 35 },
    ]);
    expect(model.text.slice(0, 16)).toBe("First paragraph.");
  });

  it("preserves CRLF offsets and trims only the paragraph end", () => {
    const model = buildTextSourceModel("A\r\n\r\nB\r\n");
    expect(model.paragraphs).toEqual([
      { id: "paragraph:0:1", start: 0, end: 1 },
      { id: "paragraph:5:6", start: 5, end: 6 },
    ]);
  });

  it("keeps leading whitespace and removes trailing whitespace", () => {
    const model = buildTextSourceModel("  A   \n\nB\n\n");
    expect(model.paragraphs.map(({ start, end }) => [start, end])).toEqual([[0, 3], [8, 9]]);
    expect(model.text.slice(0, 3)).toBe("  A");
  });

  it("skips whitespace-only content and strips a leading BOM", () => {
    expect(buildTextSourceModel(" \n\t\r\n").paragraphs).toEqual([]);
    const model = buildTextSourceModel("﻿Alpha");
    expect(model.text).toBe("Alpha");
    expect(model.paragraphs[0]).toMatchObject({ start: 0, end: 5 });
  });

  it("treats Markdown fences and HTML as literal paragraph text", () => {
    const source = "```\ncode\n\n# heading\n\n<script>alert(1)</script>";
    const model = buildTextSourceModel(source);
    expect(model.paragraphs.map(({ start, end }) => source.slice(start, end))).toEqual([
      "```\ncode",
      "# heading",
      "<script>alert(1)</script>",
    ]);
  });

  it("builds the automatic outline from the same paragraph ranges", () => {
    const source = "前言\n\n第一章 开始\n正文\n\nChapter 2 Next\nText";
    const model = buildTextSourceModel(source);
    expect(model.outline.map(({ label, target }) => ({ label, target }))).toEqual([
      { label: "第一章 开始", target: String(source.indexOf("第一章")) },
      { label: "Chapter 2 Next", target: String(source.indexOf("Chapter 2")) },
    ]);
  });

  it("keeps outline targets stable with CRLF line endings", () => {
    const model = buildTextSourceModel("第一章\r\n正文\r\n\r\n第二章 后续\r\n");
    expect(model.outline.map(({ target }) => target)).toEqual(["0", "11"]);
  });
});

describe("bounded display fragments", () => {
  it("splits a whitespace-free paragraph at the source-unit limit", () => {
    const source = "中".repeat(10_000);
    const model = buildTextSourceModel(source);
    expect(model.fragments.map((fragment) => fragment.end - fragment.start)).toEqual([4000, 4000, 2000]);
    expect(model.fragments.map((fragment) => fragment.continuesPrevious)).toEqual([false, true, true]);
    expect(model.fragments.map((fragment) => fragment.continuesNext)).toEqual([true, true, false]);
    expect(model.fragments.at(-1)!.end).toBe(source.length);
  });

  it("never splits a surrogate pair", () => {
    const source = "😀".repeat(2500);
    const model = buildTextSourceModel(source);
    for (const fragment of model.fragments) {
      expect(fragment.end - fragment.start).toBeLessThanOrEqual(TEXT_FRAGMENT_MAX_UNITS);
      const endCode = source.charCodeAt(fragment.end - 1);
      const startCode = source.charCodeAt(fragment.start);
      expect(endCode >= 0xd800 && endCode <= 0xdbff).toBe(false);
      expect(startCode >= 0xdc00 && startCode <= 0xdfff).toBe(false);
    }
    expect(model.fragments.map((fragment) => source.slice(fragment.start, fragment.end)).join("")).toBe(source);
  });

  it("prefers a whitespace boundary near the limit", () => {
    const source = `${"a".repeat(3990)} ${"b".repeat(100)}`;
    const model = buildTextSourceModel(source);
    expect(model.fragments[0]).toMatchObject({ start: 0, end: 3991 });
    expect(fragmentText(model, 0).endsWith(" ")).toBe(true);
    expect(fragmentText(model, 1).startsWith("b")).toBe(true);
  });

  it("keeps CRLF intact when the limit falls inside the pair", () => {
    const source = `${"a".repeat(3999)}\r\n${"b".repeat(20)}`;
    const model = buildTextSourceModel(source);
    expect(fragmentText(model, 0)).toBe("a".repeat(3999));
    expect(fragmentText(model, 1).startsWith("\r\n")).toBe(true);
  });

  it("does not drop or duplicate source text across fragments", () => {
    const source = `${"前言 ".repeat(2000)}\n\n${"无空白".repeat(3000)}`;
    const model = buildTextSourceModel(source);
    const joined = model.fragments.map((fragment) => source.slice(fragment.start, fragment.end)).join("");
    const visible = model.paragraphs.map((paragraph) => source.slice(paragraph.start, paragraph.end)).join("");
    expect(joined).toBe(visible);
    for (const fragment of model.fragments) {
      expect(fragment.end - fragment.start).toBeLessThanOrEqual(TEXT_FRAGMENT_MAX_UNITS);
    }
  });
});

describe("chapter packing", () => {
  it("keeps chapters inside the source-unit cap and preserves order", () => {
    const paragraph = `${"段落内容".repeat(500)}\n\n`;
    const model = buildTextSourceModel(paragraph.repeat(30));
    expect(model.chapters.length).toBeGreaterThan(1);
    for (const chapter of model.chapters) {
      expect(chapter.end - chapter.start).toBeLessThanOrEqual(TEXT_CHAPTER_MAX_UNITS);
    }
    const chapterFragments = model.chapters.flatMap((chapter) => chapter.fragments);
    expect(chapterFragments.map((fragment) => fragment.id)).toEqual(model.fragments.map((fragment) => fragment.id));
    for (const [index, chapter] of model.chapters.entries()) {
      expect(chapter.start).toBe(chapter.fragments[0]!.start);
      expect(chapter.end).toBe(chapter.fragments.at(-1)!.end);
      if (index > 0) expect(chapter.start).toBeGreaterThanOrEqual(model.chapters[index - 1]!.end);
    }
  });

  it("splits a single huge paragraph across chapters", () => {
    const source = "巨".repeat(TEXT_CHAPTER_MAX_UNITS * 2 + 123);
    const model = buildTextSourceModel(source);
    expect(model.paragraphs).toHaveLength(1);
    expect(model.chapters).toHaveLength(3);
    expect(model.chapters.map((chapter) => chapter.end - chapter.start)).toEqual([
      TEXT_FRAGMENT_MAX_UNITS * 12,
      TEXT_FRAGMENT_MAX_UNITS * 12,
      2427,
    ]);
    expect(model.chapters[1]!.fragments[0]!.continuesPrevious).toBe(true);
  });
});

describe("source offset navigation", () => {
  const model = buildTextSourceModel("Alpha\n\n   \n\nBeta");

  it("finds the containing paragraph, fragment, and chapter", () => {
    expect(findParagraphIndex(model.paragraphs, 0)).toBe(0);
    expect(findParagraphIndex(model.paragraphs, 6)).toBe(0);
    expect(findFragmentIndex(model.fragments, 8)).toBe(0);
    expect(findChapterIndex(model.chapters, 8)).toBe(0);
  });

  it("clamps gap positions to the next visible character and the tail to the last one", () => {
    expect(clampToVisibleOffset(model, 0)).toBe(0);
    expect(clampToVisibleOffset(model, 5)).toBe(5);
    expect(clampToVisibleOffset(model, 6)).toBe(12);
    expect(clampToVisibleOffset(model, 12)).toBe(12);
    expect(clampToVisibleOffset(model, 999)).toBe(16);
    expect(clampToVisibleOffset(buildTextSourceModel(""), 4)).toBe(0);
  });

  it("normalizes offsets inside surrogate pairs and CRLF pairs", () => {
    const surrogate = buildTextSourceModel("A😀B");
    expect(clampToVisibleOffset(surrogate, 2)).toBe(1);
    expect(clampToVisibleOffset(surrogate, 1)).toBe(1);
    expect(clampToVisibleOffset(surrogate, 3)).toBe(3);

    const crlf = buildTextSourceModel("A\r\nB");
    expect(clampToVisibleOffset(crlf, 2)).toBe(1);
    expect(clampToVisibleOffset(crlf, 1)).toBe(1);
    expect(clampToVisibleOffset(crlf, 3)).toBe(3);
  });

  it("reports only visible intersections for matches crossing paragraph gaps", () => {
    const source = "Alpha\n\nBeta";
    const offsets = visibleOverlaps(source, 3, 10).map(({ start, end }) => [start, end]);
    expect(offsets).toEqual([[3, 5], [7, 10]]);
    expect(visibleOverlaps(source, 5, 7)).toEqual([]);
    expect(visibleOverlaps(source, 0, source.length).map(({ start, end }) => [start, end]))
      .toEqual([[0, 5], [7, 11]]);
  });
});
