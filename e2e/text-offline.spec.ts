import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { multiParagraphText, SEARCH_MARKER, textPayload } from "./syntheticText";

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

async function startSubpathServer(): Promise<{ server: http.Server; origin: string }> {
  const server = http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? "/", "http://127.0.0.1");
      if (!url.pathname.startsWith("/WebReader/")) {
        response.writeHead(404).end();
        return;
      }
      let filePath = decodeURIComponent(url.pathname.slice("/WebReader/".length));
      if (filePath === "" || filePath.endsWith("/")) filePath += "index.html";
      const root = path.resolve(DIST);
      const resolved = path.resolve(root, filePath);
      if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) {
        response.writeHead(403).end();
        return;
      }
      const data = await readFile(resolved);
      response.writeHead(200, {
        "Content-Type": MIME_TYPES[path.extname(resolved)] ?? "application/octet-stream",
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

    await page.locator('input[type="file"]').setInputFiles(textPayload(multiParagraphText(8)));
    await page.getByRole("button", { name: "打开《synthetic reader》" }).click();
    await expect(page.locator(".text-stage-paged")).toBeVisible();
    await expect(page.locator(".text-stage-paged")).toHaveAttribute("data-source-offset", /^\d+$/);

    await page.getByRole("button", { name: "下一页" }).click();
    await page.getByRole("button", { name: "滚动" }).click();
    await expect(page.locator(".text-stage-scroll")).toBeVisible();

    await page.keyboard.press("Control+f");
    await page.getByRole("searchbox", { name: "书内搜索" }).fill(SEARCH_MARKER);
    await page.getByRole("searchbox", { name: "书内搜索" }).press("Enter");
    await expect(page.locator(".search-result")).toHaveCount(1);
    await page.locator(".search-result").click();
    await expect(page.locator(".text-search-highlight")).toHaveText(SEARCH_MARKER);
    await page.getByRole("button", { name: "关闭书内搜索" }).click();
    await page.getByRole("button", { name: "返回书架" }).click();

    await expect(page.getByRole("button", { name: "打开《synthetic reader》" })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("button", { name: "打开《synthetic reader》" })).toBeVisible();
    await page.getByRole("button", { name: "打开《synthetic reader》" }).click();
    await expect(page.locator(".text-stage-scroll")).toBeVisible();
    await expect(page.locator(".text-stage-scroll")).toHaveAttribute("data-source-offset", /^\d+$/);
  } finally {
    await context.setOffline(false).catch(() => undefined);
    await context.close();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
