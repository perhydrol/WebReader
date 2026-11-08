import { afterEach, describe, expect, it, vi } from "vitest";
import { buildChapterHtml, buildTextBookStyles, createTextBook } from "./textBook";
import { buildTextSourceModel } from "./textDocument";
import { DEFAULT_PREFERENCES } from "../types/library";

afterEach(() => vi.restoreAllMocks());

describe("safe text chapter documents", () => {
  it("escapes source markup so TXT stays literal", () => {
    const source = '第一段 <script>alert("x")</script> & 安全\n\n第二段';
    const model = buildTextSourceModel(source);
    const html = buildChapterHtml(model, model.chapters[0]!);
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&amp;");
    expect(html).toContain('data-source-start="0"');
    expect(html).toContain(`data-source-end="${source.indexOf("\n\n")}"`);
  });

  it("groups continuation fragments inside one paragraph element", () => {
    const model = buildTextSourceModel("a".repeat(5000));
    const html = buildChapterHtml(model, model.chapters[0]!);
    expect(model.fragments).toHaveLength(2);
    expect(html.match(/<p /g)).toHaveLength(1);
    expect(html.match(/<span /g)).toHaveLength(2);
    expect(html).not.toContain("continues-previous");
  });

  it("marks a paragraph continued into a later chapter", () => {
    const model = buildTextSourceModel("b".repeat(100_000));
    expect(model.chapters.length).toBeGreaterThan(1);
    const second = buildChapterHtml(model, model.chapters[1]!);
    expect(second).toContain('<p class="text-fragment-group continues-previous">');
    expect(model.chapters[1]!.fragments[0]!.continuesPrevious).toBe(true);
  });

  it("builds theme and typography styles from preferences", () => {
    const styles = buildTextBookStyles({
      ...DEFAULT_PREFERENCES,
      theme: "night",
      fontSizePercent: 140,
      lineHeight: 1.9,
      paragraphIndent: 2,
    });
    expect(styles).toContain("background: transparent");
    expect(styles).toContain("color: #e5e8e2");
    expect(styles).toContain("font-size: 140%");
    expect(styles).toContain("line-height: 1.9");
    expect(styles).toContain("text-indent: 2em");
    expect(styles).toContain("background: #e7c65c");
  });
});

describe("text book lifecycle", () => {
  it("creates one lazy section per chapter and revokes URLs on unload", () => {
    const model = buildTextSourceModel(`${"段落".repeat(20_000)}\n\n${"尾段".repeat(1000)}`);
    const book = createTextBook(model);
    expect(book.sections).toHaveLength(model.chapters.length);
    expect(book.dir).toBe("ltr");
    const section = book.sections[0]!;
    expect(section.id).toBe(model.chapters[0]!.id);
    expect(section.linear).toBe("yes");

    const revoke = vi.spyOn(URL, "revokeObjectURL");
    const first = section.load();
    expect(first.startsWith("blob:")).toBe(true);
    section.load();
    expect(revoke).toHaveBeenCalledWith(first);
    section.unload();
    book.destroy();
    expect(revoke).toHaveBeenCalled();
  });
});
