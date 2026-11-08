import { describe, expect, it } from "vitest";
import { decodeText } from "./textDecode";

function file(bytes: number[], name = "book.txt"): File {
  return new File([new Uint8Array(bytes)], name, { type: "text/plain" });
}

describe("TXT decoding", () => {
  it("prefers strict UTF-8", async () => {
    await expect(decodeText(file([...new TextEncoder().encode("中文文本")]))).resolves.toBe("中文文本");
  });

  it("falls back to GB18030 after invalid UTF-8", async () => {
    await expect(decodeText(file([0xc4, 0xe3, 0xba, 0xc3]))).resolves.toBe("你好");
  });

  it("removes a leading UTF-8 BOM", async () => {
    const bytes = [...new TextEncoder().encode("﻿Alpha")];
    await expect(decodeText(file(bytes))).resolves.toBe("Alpha");
  });
});
