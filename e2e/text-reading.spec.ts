import { changeReaderMode, showReaderToolbar } from "./readerControls";
import { expect, test } from "@playwright/test";
import path from "node:path";
import { isInjectedBrowserRequest } from "./browserNoise";
import { multiParagraphText, SEARCH_MARKER, textPayload } from "./syntheticText";

const emptyFixture = path.join(import.meta.dirname, "fixtures", "empty-reader.txt");
const invalidEpubFixture = path.join(import.meta.dirname, "fixtures", "invalid.epub");
const readerName = "synthetic reader";

test("renders single newlines as paragraphs with wider scroll text on desktop and mobile", async ({ page }) => {
  await page.goto("/");
  await page.locator('input[type="file"]').setInputFiles(textPayload("第一段\r\n第二段\n第三段"));
  await page.getByRole("button", { name: `打开《${readerName}》` }).click();
  await changeReaderMode(page, "滚动");
  const paragraphs = page.locator(".text-scroll-item p");
  await expect(paragraphs).toHaveText(["第一段", "第二段", "第三段"]);
  await expect(paragraphs.nth(1)).toHaveAttribute("data-fragment-start", "5");
  await expect(page.locator(".text-scroll-item").first()).toHaveCSS("padding-left", "64px");
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator(".text-scroll-item").first()).toHaveCSS("padding-left", "36px");
  await expect(paragraphs).toHaveText(["第一段", "第二段", "第三段"]);
});

function progressOffset(read: () => Promise<string | null>) {
  return read().then((value) => (value === null ? Number.NaN : Number(value)));
}

test("imports a synthetic TXT file and restores its paged position after reload", async ({ page }) => {
  const unexpectedRequests: string[] = [];
  page.on("request", (request) => {
    if (isInjectedBrowserRequest(request.url())) return;
    const url = new URL(request.url());
    if (url.origin !== "http://127.0.0.1:4175") unexpectedRequests.push(request.url());
  });
  const payload = textPayload(multiParagraphText(120));

  await page.goto("/");
  await page.locator('input[type="file"]').setInputFiles(payload);

  await expect(page.getByRole("status")).toContainText("已将 1 本书添加到此浏览器");
  await expect(page.getByRole("button", { name: `打开《${readerName}》` })).toBeVisible();
  await page.getByRole("button", { name: `打开《${readerName}》` }).click();

  const stage = page.locator(".text-stage-paged");
  await expect(stage).toBeVisible();
  await expect(stage).toHaveAttribute("data-source-offset", /^\d+$/);
  await expect(page.getByRole("button", { name: "下一页" })).toBeVisible();

  const before = await progressOffset(() => stage.getAttribute("data-source-offset"));
  await page.getByRole("button", { name: "下一页" }).click();
  await expect.poll(() => progressOffset(() => stage.getAttribute("data-source-offset")))
    .toBeGreaterThan(before);
  const saved = await progressOffset(() => stage.getAttribute("data-source-offset"));

  await showReaderToolbar(page);
  await page.getByRole("button", { name: "返回书架" }).click();
  await expect(page.getByRole("button", { name: `打开《${readerName}》` })).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: `打开《${readerName}》` }).click();

  await expect.poll(() => progressOffset(() => page.locator(".text-stage-paged").getAttribute("data-source-offset")))
    .toBeGreaterThanOrEqual(saved - 40);
  expect(unexpectedRequests).toEqual([]);
});

test("reports empty text and rejects a renamed ZIP before it reaches the shelf", async ({ page }) => {
  await page.goto("/");
  const input = page.locator('input[type="file"]');

  await input.setInputFiles(emptyFixture);
  await expect(page.getByRole("button", { name: "打开《empty reader》" })).toBeVisible();
  await page.getByRole("button", { name: "打开《empty reader》" }).click();
  await expect(page.getByText("这个文本文件没有可显示的内容。")).toBeVisible();
  await showReaderToolbar(page);
  await page.getByRole("button", { name: "返回书架" }).click();

  await input.setInputFiles(invalidEpubFixture);
  await expect(page.getByRole("status")).toContainText("此文件不是有效的 DRM-free EPUB");
  await expect(page.getByRole("button", { name: /打开《invalid》/ })).toHaveCount(0);
});

test("searches TXT locally, jumps to the match, and clears the highlight", async ({ page }) => {
  const unexpectedRequests: string[] = [];
  page.on("request", (request) => {
    if (isInjectedBrowserRequest(request.url())) return;
    const url = new URL(request.url());
    if (url.origin !== "http://127.0.0.1:4175") unexpectedRequests.push(request.url());
  });
  const payload = textPayload(multiParagraphText(40));

  // The installed paginator uses a closed shadow root. Opening it in the test
  // only makes the rendered iframe observable; pagination behavior is unchanged.
  await page.addInitScript(() => {
    const attachShadow = Element.prototype.attachShadow;
    Element.prototype.attachShadow = function (this: Element, init: ShadowRootInit) {
      return attachShadow.call(this, { ...init, mode: "open" });
    };
  });

  await page.goto("/");
  await page.locator('input[type="file"]').setInputFiles(payload);
  await page.getByRole("button", { name: `打开《${readerName}》` }).click();
  await expect(page.locator(".text-stage-paged")).toBeVisible();

  await expect(page.getByRole("button", { name: "书内搜索" })).toBeEnabled();
  await page.keyboard.press("Control+f");
  const search = page.getByRole("searchbox", { name: "书内搜索" });
  await expect(search).toBeFocused();
  await search.fill(SEARCH_MARKER);
  await search.press("Enter");
  await expect(page.getByRole("status").filter({ hasText: "找到 1 处" })).toBeVisible();
  await page.locator(".search-result").click();

  const paginatorFrame = page.frameLocator("foliate-paginator iframe");
  await expect(paginatorFrame.locator(".text-search-highlight")).toHaveText(SEARCH_MARKER);

  await expect(page.locator(".search-panel")).toHaveCount(0);
  await changeReaderMode(page, "滚动");
  await expect(page.locator(".text-stage-scroll")).toBeVisible();

  await page.keyboard.press("Control+f");
  const scrollSearch = page.getByRole("searchbox", { name: "书内搜索" });
  await scrollSearch.fill(SEARCH_MARKER);
  await scrollSearch.press("Enter");
  await expect(page.getByRole("status").filter({ hasText: "找到 1 处" })).toBeVisible();
  await page.locator(".search-result").click();
  await expect(page.locator(".text-search-highlight")).toHaveText(SEARCH_MARKER);
  await expect(page.locator(".search-panel")).toHaveCount(0);
  await page.keyboard.press("Control+f");
  await page.getByRole("button", { name: "关闭书内搜索" }).click();
  await expect(page.locator(".text-search-highlight")).toHaveCount(0);
  expect(unexpectedRequests).toEqual([]);
});

test("rejects Markdown names and media types without adding shelf entries", async ({ page }) => {
  await page.goto("/");
  const input = page.locator('input[type="file"]');
  const content = Buffer.from("# Markdown\n\nThis must not open.", "utf8");

  for (const mimeType of ["", "text/plain", "text/markdown"]) {
    await input.setInputFiles({ name: "notes.md", mimeType, buffer: content });
    await expect(page.getByRole("status")).toContainText("WebReader 目前支持 EPUB、PDF 和 TXT 文件。");
  }
  await expect(page.getByRole("button", { name: /打开《notes》/ })).toHaveCount(0);
});

test("keeps a legacy Markdown record visible, blocks opening it, and allows deletion", async ({ page }) => {
  await page.goto("/");
  await page.locator('input[type="file"]').setInputFiles(textPayload(multiParagraphText(8)));
  await expect(page.getByRole("button", { name: `打开《${readerName}》` })).toBeVisible();

  await page.evaluate(async () => {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open("webreader");
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const database = request.result;
        const transaction = database.transaction("books", "readwrite");
        const store = transaction.objectStore("books");
        const all = store.getAll();
        all.onsuccess = () => {
          for (const book of all.result) {
            book.fileName = "legacy-reader.md";
            book.mediaType = "text/markdown";
            store.put(book);
          }
        };
        transaction.oncomplete = () => { database.close(); resolve(); };
        transaction.onerror = () => reject(transaction.error);
      };
    });
  });

  await page.reload();
  await page.getByRole("button", { name: `打开《${readerName}》` }).click();
  await expect(page.getByRole("status")).toContainText("旧版 Markdown");
  await expect(page.locator(".text-stage")).toHaveCount(0);

  await page.getByRole("button", { name: `移除《${readerName}》` }).click();
  await page.getByRole("button", { name: "移除", exact: true }).click();
  await expect(page.getByText("书架还是空的")).toBeVisible();
});
