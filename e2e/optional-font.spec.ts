import { expect, test } from "@playwright/test";
import { chapterText, textPayload } from "./syntheticText";
import { changeReaderMode } from "./readerControls";
import { syntheticEpub } from "./syntheticBooks";

test("downloads the optional font explicitly, retries failures and restores it offline", async ({ page, context }) => {
  const fontRequests: string[] = [];
  page.on("request", (request) => { if (request.url().endsWith(".woff2")) fontRequests.push(request.url()); });
  await page.goto("/");
  await page.getByRole("button", { name: "应用设置", exact: true }).click();
  await expect(page.getByRole("button", { name: "下载字体" })).toBeEnabled();
  expect(fontRequests).toEqual([]);
  await page.route("**/fonts/*.woff2", (route) => route.abort());
  await page.getByRole("button", { name: "下载字体" }).click();
  await expect(page.getByRole("alert")).toContainText("下载失败");
  await page.unroute("**/fonts/*.woff2");
  await page.route("**/fonts/*.woff2", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 400));
    await route.continue();
  });
  await page.getByRole("button", { name: "下载字体" }).click();
  await expect(page.getByRole("button", { name: "正在下载…" })).toBeDisabled();
  await expect(page.getByRole("status")).toContainText("已下载", { timeout: 30_000 });
  await page.getByRole("button", { name: "返回书架" }).click();
  await page.locator('input[type="file"]').setInputFiles([
    textPayload(chapterText(3, 4), "font.txt"),
    { name: "synthetic.epub", mimeType: "application/epub+zip", buffer: syntheticEpub() },
  ]);
  await page.getByRole("button", { name: "打开《font》" }).click();
  await page.getByRole("button", { name: "阅读设置", exact: true }).click();
  await page.getByRole("combobox").selectOption("wenkai");
  await expect(page.getByRole("combobox")).toHaveValue("wenkai");
  await page.getByRole("button", { name: "关闭阅读设置" }).click();
  await expect.poll(() => page.evaluate(() => document.fonts.check('16px "WebReader WenKai"'))).toBe(true);
  await expect.poll(() => page.locator("foliate-paginator").evaluate((element) => {
    const paginator = element as HTMLElement & { getContents: () => { doc: Document }[] };
    return paginator.getContents().some(({ doc }) => getComputedStyle(doc.body).fontFamily.includes("WebReader WenKai")
      && [...doc.fonts].some((face) => face.family === "WebReader WenKai" && face.status === "loaded"));
  })).toBe(true);
  await changeReaderMode(page, "滚动");
  await expect.poll(() => page.locator(".text-fragment").first().evaluate((element) => getComputedStyle(element).fontFamily)).toContain("WebReader WenKai");
  await page.reload();
  await context.setOffline(true);
  await page.reload();
  await page.getByRole("button", { name: "应用设置", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("已下载");
  await page.getByRole("button", { name: "返回书架" }).click();
  await page.getByRole("button", { name: "打开《font》" }).click();
  await page.getByRole("button", { name: "阅读设置", exact: true }).click();
  await expect(page.getByRole("combobox")).toHaveValue("wenkai");
  await page.getByRole("button", { name: "关闭阅读设置" }).click();
  await page.getByRole("button", { name: "返回书架" }).click();
  await page.getByRole("button", { name: "打开《synthetic》" }).click();
  await expect.poll(() => page.locator("foliate-view").evaluate((element) => {
    const view = element as HTMLElement & { renderer?: { getContents: () => { doc: Document }[] } };
    return view.renderer?.getContents().some(({ doc }) => getComputedStyle(doc.body).fontFamily.includes("WebReader WenKai")
      && [...doc.fonts].some((face) => face.family === "WebReader WenKai" && face.status === "loaded"));
  })).toBe(true);
});

test("hides an unavailable font and rejects a corrupt download or cache entry", async ({ page }) => {
  await page.goto("/");
  await page.locator('input[type="file"]').setInputFiles(textPayload(chapterText(1, 2), "missing.txt"));
  await page.getByRole("button", { name: "打开《missing》" }).click();
  await page.getByRole("button", { name: "阅读设置", exact: true }).click();
  await expect(page.getByRole("combobox").locator('option[value="wenkai"]')).toHaveCount(0);
  await page.reload();
  await page.evaluate(async () => {
    const cache = await caches.open("webreader-optional-fonts-v1");
    await cache.put(new URL("fonts/LXGWWenKai-Regular-v1.530.woff2", location.href), new Response("corrupt"));
  });
  await page.reload();
  await page.getByRole("button", { name: "应用设置", exact: true }).click();
  await expect(page.getByRole("button", { name: "下载字体" })).toBeEnabled();
  await page.route("**/fonts/*.woff2", (route) => route.fulfill({ status: 200, body: "not a font" }));
  await page.getByRole("button", { name: "下载字体" }).click();
  await expect(page.getByRole("alert")).toContainText("下载失败");
  expect(await page.evaluate(async () => (await (await caches.open("webreader-optional-fonts-v1")).keys()).length)).toBe(0);
});
