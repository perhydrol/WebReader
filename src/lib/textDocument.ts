import type { ReaderOutlineItem } from "../types/reader";
import { findSourceRangeIndex, sourceOffsetForRange } from "./textPagination";

export const TEXT_FRAGMENT_MAX_UNITS = 4000;
export const TEXT_CHAPTER_MAX_UNITS = 48 * 1024;

export interface TextParagraph {
  id: string;
  start: number;
  end: number;
}

export interface TextFragment {
  id: string;
  paragraphId: string;
  start: number;
  end: number;
  continuesPrevious: boolean;
  continuesNext: boolean;
}

export interface TextChapter {
  id: string;
  start: number;
  end: number;
  fragments: TextFragment[];
}

export interface TextSourceModel {
  text: string;
  paragraphs: TextParagraph[];
  fragments: TextFragment[];
  chapters: TextChapter[];
  outline: ReaderOutlineItem[];
}

const CHAPTER_PATTERN = /^\s*(第\s*[〇零一二三四五六七八九十百千0-9]+\s*[章节回卷部篇]|chapter\s+[\divxlcdm]+\b)/i;

function isWhitespaceCode(code: number): boolean {
  return code === 0x20
    || (code >= 0x09 && code <= 0x0d)
    || code === 0xa0
    || code === 0x1680
    || (code >= 0x2000 && code <= 0x200a)
    || code === 0x2028
    || code === 0x2029
    || code === 0x202f
    || code === 0x205f
    || code === 0x3000
    || code === 0xfeff;
}

function isBlank(text: string, start: number, end: number): boolean {
  for (let index = start; index < end; index += 1) {
    if (!isWhitespaceCode(text.charCodeAt(index))) return false;
  }
  return true;
}

function trimParagraphEnd(text: string, start: number, end: number): number {
  while (end > start && isWhitespaceCode(text.charCodeAt(end - 1))) end -= 1;
  return end;
}

function isHighSurrogate(code: number): boolean {
  return code >= 0xd800 && code <= 0xdbff;
}

function isLowSurrogate(code: number): boolean {
  return code >= 0xdc00 && code <= 0xdfff;
}

export function splitTextParagraphs(text: string): TextParagraph[] {
  const paragraphs: TextParagraph[] = [];

  const pushParagraph = (start: number, end: number) => {
    if (start < 0) return;
    const actualEnd = trimParagraphEnd(text, start, end);
    if (actualEnd <= start) return;
    paragraphs.push({ id: `paragraph:${start}:${actualEnd}`, start, end: actualEnd });
  };

  let lineStart = 0;
  while (lineStart < text.length) {
    let contentEnd = lineStart;
    while (contentEnd < text.length) {
      const code = text.charCodeAt(contentEnd);
      if (code === 0x0a || code === 0x0d) break;
      contentEnd += 1;
    }

    if (!isBlank(text, lineStart, contentEnd)) pushParagraph(lineStart, contentEnd);

    if (contentEnd >= text.length) break;
    if (text.charCodeAt(contentEnd) === 0x0d) {
      contentEnd += 1;
      if (text.charCodeAt(contentEnd) === 0x0a) contentEnd += 1;
    } else {
      contentEnd += 1;
    }
    lineStart = contentEnd;
  }

  return paragraphs;
}

function chooseFragmentEnd(text: string, start: number, limit: number, paragraphEnd: number): number {
  if (limit >= paragraphEnd) return paragraphEnd;
  let cut = limit;

  for (let index = limit - 1; index > start; index -= 1) {
    if (isWhitespaceCode(text.charCodeAt(index))) {
      cut = index + 1;
      break;
    }
  }

  if (cut < paragraphEnd && text.charCodeAt(cut - 1) === 0x0d && text.charCodeAt(cut) === 0x0a) {
    cut -= 1;
  } else if (cut < paragraphEnd
    && isHighSurrogate(text.charCodeAt(cut - 1))
    && isLowSurrogate(text.charCodeAt(cut))) {
    cut -= 1;
  }

  if (cut <= start) cut = limit;
  if (cut < paragraphEnd && text.charCodeAt(cut - 1) === 0x0d && text.charCodeAt(cut) === 0x0a) {
    cut -= 1;
  }
  if (cut < paragraphEnd
    && isHighSurrogate(text.charCodeAt(cut - 1))
    && isLowSurrogate(text.charCodeAt(cut))) {
    cut -= 1;
  }
  return Math.max(start + 1, cut);
}

export function splitTextFragments(text: string, paragraphs: TextParagraph[]): TextFragment[] {
  const fragments: TextFragment[] = [];
  for (const paragraph of paragraphs) {
    let start = paragraph.start;
    while (start < paragraph.end) {
      const end = chooseFragmentEnd(text, start, Math.min(paragraph.end, start + TEXT_FRAGMENT_MAX_UNITS), paragraph.end);
      fragments.push({
        id: `fragment:${start}:${end}`,
        paragraphId: paragraph.id,
        start,
        end,
        continuesPrevious: start > paragraph.start,
        continuesNext: end < paragraph.end,
      });
      start = end;
    }
  }
  return fragments;
}

export function buildTextChapters(fragments: TextFragment[]): TextChapter[] {
  const chapters: TextChapter[] = [];
  let current: TextFragment[] = [];

  const flush = () => {
    if (current.length === 0) return;
    const start = current[0]!.start;
    const end = current[current.length - 1]!.end;
    chapters.push({ id: `chapter:${start}:${end}`, start, end, fragments: current });
    current = [];
  };

  for (const fragment of fragments) {
    if (current.length > 0 && fragment.end - current[0]!.start > TEXT_CHAPTER_MAX_UNITS) flush();
    current.push(fragment);
  }
  flush();
  return chapters;
}

function outlineFromParagraphs(text: string, paragraphs: TextParagraph[]): ReaderOutlineItem[] {
  const items: ReaderOutlineItem[] = [];
  for (const paragraph of paragraphs) {
    let lineEnd = paragraph.start;
    while (lineEnd < paragraph.end) {
      const code = text.charCodeAt(lineEnd);
      if (code === 0x0a || code === 0x0d) break;
      lineEnd += 1;
    }
    const line = text.slice(paragraph.start, lineEnd);
    if (!CHAPTER_PATTERN.test(line)) continue;
    items.push({
      id: `chapter-${paragraph.start}`,
      label: line.trim(),
      target: String(paragraph.start),
      children: [],
    });
  }
  return items;
}

export function buildTextSourceModel(source: string): TextSourceModel {
  const text = source.startsWith("﻿") ? source.slice(1) : source;
  const paragraphs = splitTextParagraphs(text);
  const fragments = splitTextFragments(text, paragraphs);
  return {
    text,
    paragraphs,
    fragments,
    chapters: buildTextChapters(fragments),
    outline: outlineFromParagraphs(text, paragraphs),
  };
}

export function findParagraphIndex(paragraphs: ReadonlyArray<TextParagraph>, offset: number): number {
  return findSourceRangeIndex(paragraphs, offset);
}

export function findFragmentIndex(fragments: ReadonlyArray<TextFragment>, offset: number): number {
  return findSourceRangeIndex(fragments, offset);
}

export function findChapterIndex(chapters: ReadonlyArray<TextChapter>, offset: number): number {
  return findSourceRangeIndex(chapters, offset);
}

function normalizeBoundaryOffset(text: string, offset: number): number {
  let normalized = Math.min(text.length, Math.max(0, offset));
  if (normalized > 0
    && isHighSurrogate(text.charCodeAt(normalized - 1))
    && isLowSurrogate(text.charCodeAt(normalized))) {
    normalized -= 1;
  }
  if (normalized > 0
    && text.charCodeAt(normalized - 1) === 0x0d
    && text.charCodeAt(normalized) === 0x0a) {
    normalized -= 1;
  }
  return normalized;
}

export function clampToVisibleOffset(model: Pick<TextSourceModel, "text" | "paragraphs">, offset: number): number {
  if (!Number.isFinite(offset) || model.paragraphs.length === 0) return 0;
  const clamped = normalizeBoundaryOffset(
    model.text,
    Math.min(model.text.length, Math.max(0, Math.floor(offset))),
  );
  return sourceOffsetForRange(model.paragraphs, clamped)?.offset ?? 0;
}

export function paragraphAtOffset(
  model: Pick<TextSourceModel, "text" | "paragraphs">,
  offset: number,
): TextParagraph | undefined {
  if (model.paragraphs.length === 0) return undefined;
  const normalized = clampToVisibleOffset(model, offset);
  return model.paragraphs[findParagraphIndex(model.paragraphs, normalized)];
}

export function visibleOverlaps(
  source: Pick<TextSourceModel, "text" | "paragraphs"> | string,
  start: number,
  end: number,
): Array<{ start: number; end: number }> {
  if (!(end > start)) return [];
  const paragraphs = typeof source === "string" ? splitTextParagraphs(source) : source.paragraphs;
  if (paragraphs.length === 0) return [];
  const overlaps: Array<{ start: number; end: number }> = [];
  let index = findParagraphIndex(paragraphs, start);
  let paragraph = paragraphs[index];
  while (paragraph && paragraph.start < end) {
    const overlapStart = Math.max(start, paragraph.start);
    const overlapEnd = Math.min(end, paragraph.end);
    if (overlapStart < overlapEnd) overlaps.push({ start: overlapStart, end: overlapEnd });
    index += 1;
    paragraph = paragraphs[index];
  }
  return overlaps;
}
