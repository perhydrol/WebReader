import { changeReaderMode, showReaderToolbar } from "./readerControls";
import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { chapterText, SEARCH_MARKER, textPayload } from "./syntheticText";

const DIST = path.join(import.meta.dirname, "..", "dist");
const MIME_TYPES: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webmanifest": "application/manifest+json",
  ".woff2": "font/woff2",
};

async function startSubpathServer(directory: () => string = () => DIST): Promise<{ server: http.Server; origin: string }> {
  const server = http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? "/", "http://127.0.0.1");
      if (!url.pathname.startsWith("/WebReader/")) {
        response.writeHead(404).end();
        return;
      }
      let filePath = decodeURIComponent(url.pathname.slice("/WebReader/".length));
      if (filePath === "" || filePath.endsWith("/")) filePath += "index.html";
      const root = path.resolve(directory());
      const resolved = path.resolve(root, filePath);
      if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) {
        response.writeHead(403).end();
        return;
      }
      const data = await readFile(resolved);
      response.writeHead(200, {
        "Content-Type": MIME_TYPES[path.extname(resolved)] ?? "application/octet-stream",
        "Cache-Control": "no-store",
      });
      response.end(data);
    } catch {
      response.writeHead(404).end();
    }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  return { server, origin: `http://127.0.0.1:${port}` };
}

test("serves TXT reading from the WebReader subpath after an offline restart", async ({ browser }) => {
  test.setTimeout(180_000);
  const { server, origin } = await startSubpathServer();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  try {
    await page.goto(`${origin}/WebReader/`);
    await expect.poll(
      () => page.evaluate(async () => Boolean(await navigator.serviceWorker.ready)),
      { timeout: 60_000 },
    ).toBe(true);
    await page.reload();
    await expect.poll(
      () => page.evaluate(() => Boolean(navigator.serviceWorker.controller)),
      { timeout: 60_000 },
    ).toBe(true);

    await context.setOffline(true);
    await page.reload();
    await expect(page.getByRole("button", { name: "添加图书" })).toBeVisible({ timeout: 60_000 });
    await page.getByRole("button", { name: "应用设置" }).click();
    await expect(page.getByText("清除网站数据", { exact: false })).toBeVisible();
    await page.getByRole("button", { name: "反馈", exact: true }).click();
    await page.getByPlaceholder("遇到了什么问题？或有什么建议？").fill("合成离线反馈");
    await page.getByRole("button", { name: "提交", exact: true }).click();
    await expect(page.getByText("反馈提交失败，请稍后重试。")).toBeVisible();
    await expect(page.getByPlaceholder("遇到了什么问题？或有什么建议？")).toHaveValue("合成离线反馈");
    await page.locator(".dialog-actions").getByRole("button", { name: "取消" }).click();
    await page.getByRole("button", { name: "返回书架" }).click();

    await page.locator('input[type="file"]').setInputFiles(textPayload(chapterText(4, 4)));
    await page.getByRole("button", { name: "打开《synthetic reader》" }).click();
    await expect(page.locator(".text-stage-paged")).toBeVisible();
    await expect(page.locator(".text-stage-paged")).toHaveAttribute("data-source-offset", /^\d+$/);

    await page.getByRole("button", { name: "下一页" }).click();
    await changeReaderMode(page, "滚动");
    await expect(page.locator(".text-stage-scroll")).toBeVisible();

    await page.keyboard.press("Control+f");
    await page.getByRole("searchbox", { name: "书内搜索" }).fill(SEARCH_MARKER);
    await page.getByRole("searchbox", { name: "书内搜索" }).press("Enter");
    await expect(page.locator(".search-result")).toHaveCount(1);
    await page.locator(".search-result").click();
    await expect(page.locator(".text-search-highlight")).toHaveText(SEARCH_MARKER);
    await expect(page.locator(".search-panel")).toHaveCount(0);
    await showReaderToolbar(page);
    await page.getByRole("button", { name: "返回书架" }).click();

    await expect(page.getByRole("button", { name: "打开《synthetic reader》" })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("button", { name: "打开《synthetic reader》" })).toBeVisible();
    await page.getByRole("button", { name: "打开《synthetic reader》" }).click();
    await expect(page.locator(".text-stage-scroll")).toBeVisible();
    await expect(page.locator(".text-stage-scroll")).toHaveAttribute("data-source-offset", /^\d+$/);
    await showReaderToolbar(page);
    await page.getByRole("button", { name: "目录", exact: true }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByRole("button", { name: "关闭目录" }).click();
    await showReaderToolbar(page);
    await page.getByRole("button", { name: "返回书架" }).click();
    await page.getByRole("button", { name: "移除《synthetic reader》" }).click();
    await page.locator(".dialog-actions").getByRole("button", { name: "取消" }).click();
    await expect(page.getByRole("button", { name: "打开《synthetic reader》" })).toBeVisible();
    await page.getByRole("button", { name: "移除《synthetic reader》" }).click();
    await page.getByRole("button", { name: "移除", exact: true }).click();
    await page.reload();
    await expect(page.getByText("书架还是空的")).toBeVisible();
  } finally {
    await context.setOffline(false).catch(() => undefined);
    await context.close();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

test("keeps old reading state through an explicit production PWA upgrade and offline restart", async ({ browser }) => {
  const baseline = process.env.WEBREADER_UPGRADE_BASELINE;
  test.skip(!baseline, "Supply an independently built previous production dist via WEBREADER_UPGRADE_BASELINE");
  test.setTimeout(120_000);
  let directory = baseline!;
  const { server, origin } = await startSubpathServer(() => directory);
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  try {
    await page.goto(`${origin}/WebReader/`);
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.reload();
    await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
    await page.locator('input[type="file"]').setInputFiles(textPayload(chapterText(8, 8), "upgrade.txt"));
    await page.getByRole("button", { name: "打开《upgrade》" }).click();
    await expect(page.locator('.text-stage[data-view-ready="book"]')).toBeVisible();
    await page.getByRole("button", { name: "下一页" }).click();
    const offset = () => page.locator(".text-stage").getAttribute("data-source-offset").then(Number);
    await expect.poll(offset).toBeGreaterThan(0);
    directory = DIST;
    await page.evaluate(async () => { await (await navigator.serviceWorker.getRegistration())?.update(); });
    await expect.poll(() => page.evaluate(async () => Boolean((await navigator.serviceWorker.getRegistration())?.waiting)), { timeout: 60_000 }).toBe(true);
    await expect(page.locator(".k-ios")).toHaveCount(0);
    const beforeTurn = await offset();
    await page.getByRole("button", { name: "下一页" }).click();
    await expect.poll(offset).toBeGreaterThan(beforeTurn);
    const saved = await offset();
    await page.getByRole("button", { name: "返回书架" }).click();
    await page.getByRole("button", { name: "更新", exact: true }).click();
    await expect(page.locator(".k-ios")).toHaveCount(1);
    await context.setOffline(true);
    await page.reload();
    await page.getByRole("button", { name: "打开《upgrade》" }).click();
    await expect(page.locator('.text-stage[data-view-ready="book"]')).toBeVisible();
    const restored = await offset();
    expect(restored).toBeLessThanOrEqual(saved + 40);
    expect(saved - restored).toBeLessThanOrEqual(5000);
    await page.getByRole("button", { name: "阅读设置", exact: true }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
  } finally {
    await context.setOffline(false).catch(() => undefined);
    await context.close();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
