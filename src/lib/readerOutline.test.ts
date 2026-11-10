import { describe, expect, it } from "vitest";
import { currentOutlineItem } from "./readerOutline";
import type { ReaderOutlineItem } from "../types/reader";
const item = (id: string, target: string, children: ReaderOutlineItem[] = []): ReaderOutlineItem => ({ id, target, label: id, children });
describe("currentOutlineItem", () => {
  it("keeps a numeric chapter current through its body and across boundaries", () => {
    const items = [item("first", "10"), item("second", "100"), item("third", "200")];
    expect(currentOutlineItem(items, "9")).toBeUndefined();
    expect(currentOutlineItem(items, "10")?.id).toBe("first");
    expect(currentOutlineItem(items, "99")?.id).toBe("first");
    expect(currentOutlineItem(items, "100")?.id).toBe("second");
    expect(currentOutlineItem(items, "999")?.id).toBe("third");
  });
  it("finds nested entries without depending on traversal order", () => {
    const items = [item("later", "100"), item("parent", "10", [item("child", "30")])];
    expect(currentOutlineItem(items, "50")?.id).toBe("child");
  });
  it("matches publication hrefs exactly without guessing their order", () => {
    const items = [item("chapter", "book.xhtml#part")];
    expect(currentOutlineItem(items, "book.xhtml#part")?.id).toBe("chapter");
    expect(currentOutlineItem(items, "other.xhtml")).toBeUndefined();
    expect(currentOutlineItem(items, undefined)).toBeUndefined();
    expect(currentOutlineItem([], "20")).toBeUndefined();
  });
});
