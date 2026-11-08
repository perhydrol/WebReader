export const MAX_SYNTHETIC_TEXT_BYTES = 8 * 1024 * 1024;

export interface TextPayload {
  name: string;
  mimeType: string;
  buffer: Buffer;
  bytes: number;
  units: number;
}

export function textPayload(text: string, name = "synthetic-reader.txt", mimeType = "text/plain"): TextPayload {
  const buffer = Buffer.from(text, "utf8");
  return { name, mimeType, buffer, bytes: buffer.byteLength, units: text.length };
}

const SENTENCE = "这是 WebReader 自动化测试生成的合成文本，用于验证本地阅读、分页、搜索和进度恢复。";

export const SEARCH_MARKER = "终章检索标记";

export function multiParagraphText(paragraphs: number): string {
  const parts: string[] = [];
  for (let index = 0; index < paragraphs; index += 1) {
    parts.push(`第 ${index + 1} 段。${SENTENCE}${SENTENCE}`);
  }
  parts.push(`${SEARCH_MARKER} end-of-book marker`);
  return `${parts.join("\n\n")}\n`;
}

export function chapterText(chapters: number, paragraphsPerChapter = 4): string {
  const parts: string[] = [];
  for (let chapter = 0; chapter < chapters; chapter += 1) {
    parts.push(`第 ${chapter + 1} 章 合成章节`);
    for (let paragraph = 0; paragraph < paragraphsPerChapter; paragraph += 1) {
      parts.push(`第 ${chapter + 1}-${paragraph + 1} 段。${SENTENCE}`);
    }
  }
  parts.push(`${SEARCH_MARKER} end-of-book marker`);
  return `${parts.join("\n\n")}\n`;
}

export const BOUNDARY_MARKER = "边界标记ALPHA";
export const FRAGMENT_BOUNDARY_MARKER = "边界跨界检索";

export function fragmentBoundaryText(): string {
  return `${"前".repeat(3995)}${FRAGMENT_BOUNDARY_MARKER}${"后".repeat(200)}`;
}

export function longParagraphText(unitsPerHalf = 49_000): string {
  const half = "长".repeat(unitsPerHalf);
  return `${half}${BOUNDARY_MARKER}${half}\n\n${SEARCH_MARKER} end-of-book marker`;
}

export interface LargeSyntheticText {
  text: string;
  bytes: number;
  units: number;
}

function appendUntil(text: string, targetBytes: number, makeBlock: (index: number) => string): { text: string; index: number } {
  const parts: string[] = [text];
  let bytes = Buffer.byteLength(text, "utf8");
  let index = 0;
  while (bytes < targetBytes) {
    const block = makeBlock(index);
    const blockBytes = Buffer.byteLength(block, "utf8") + 2;
    if (bytes + blockBytes > targetBytes) break;
    parts.push(block);
    bytes += blockBytes;
    index += 1;
  }
  return { text: parts.join("\n\n"), index };
}

export function nearLimitMultiParagraphText(): LargeSyntheticText {
  const target = MAX_SYNTHETIC_TEXT_BYTES - 4096;
  let index = 0;
  const generated = appendUntil("", target, () => {
    index += 1;
    return `第 ${index} 段。${SENTENCE}${SENTENCE}`;
  });
  const text = `${generated.text}\n\n${SEARCH_MARKER} end-of-book marker`;
  return { text, bytes: Buffer.byteLength(text, "utf8"), units: text.length };
}

export function nearLimitSingleParagraphText(): LargeSyntheticText {
  const target = MAX_SYNTHETIC_TEXT_BYTES - 4096;
  const block = `${SENTENCE}${SENTENCE}${SENTENCE}`;
  const repeat = Math.max(1, Math.floor(target / Buffer.byteLength(block, "utf8")));
  const text = `${block.repeat(repeat)}${SEARCH_MARKER}`;
  return { text, bytes: Buffer.byteLength(text, "utf8"), units: text.length };
}
