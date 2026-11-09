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

  it("renders CRLF-separated lines as paragraphs with exact source ranges", () => {
    const source = "第一行\r\n第二行\r\n\r\n第三行";
    const model = buildTextSourceModel(source);
    const html = buildChapterHtml(model, model.chapters[0]!);
    expect(html).not.toContain("\r");
    expect(html.match(/<p /g)).toHaveLength(3);
    expect(html).toContain('data-source-start="5" data-source-end="8">第二行</span>');
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
    const model = buildTextSourceModel("段落".repeat(30_000));
    expect(model.chapters.length).toBeGreaterThan(1);
    const book = createTextBook(model);
    expect(book.sections).toHaveLength(model.chapters.length);
    expect(book.sections).toHaveLength(2);
    expect(book.dir).toBe("ltr");
    expect(book.sections[0]!.id).toBe(model.chapters[0]!.id);
    expect(book.sections[0]!.linear).toBe("yes");

    const revoke = vi.spyOn(URL, "revokeObjectURL");
    const first = book.sections[0]!.load();
    const second = book.sections[1]!.load();
    expect(first.startsWith("blob:")).toBe(true);
    expect(second.startsWith("blob:")).toBe(true);
    expect(second).not.toBe(first);
    book.sections[0]!.load();
    expect(revoke).toHaveBeenCalledWith(first);
    book.sections[1]!.unload();
    expect(revoke).toHaveBeenCalledWith(second);
    book.destroy();
    expect(revoke).toHaveBeenCalled();
  });

  it("does not create a chapter URL after the book is destroyed", () => {
    const model = buildTextSourceModel("late initialization ".repeat(4_000));
    const book = createTextBook(model);
    const create = vi.spyOn(URL, "createObjectURL");
    book.destroy();
    expect(book.sections[0]!.load()).toBe("");
    expect(create).not.toHaveBeenCalled();
  });
});
