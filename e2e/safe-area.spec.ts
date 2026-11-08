import { expect, test, type Locator, type Page } from "@playwright/test";
import path from "node:path";
import { syntheticPdf } from "./syntheticBooks";

const fixture = path.join(import.meta.dirname, "fixtures", "long-reader.md");

type Insets = { top: number; right: number; bottom: number; left: number };
type Box = { x: number; y: number; width: number; height: number };

// Synthetic inset values describe test scenarios; they are not measurements of any device.
const ZERO: Insets = { top: 0, right: 0, bottom: 0, left: 0 };

async function applySafeArea(page: Page, insets: Insets) {
  await page.evaluate((value) => {
    const style = document.documentElement.style;
    style.setProperty("--safe-area-top", `${value.top}px`);
    style.setProperty("--safe-area-right", `${value.right}px`);
    style.setProperty("--safe-area-bottom", `${value.bottom}px`);
    style.setProperty("--safe-area-left", `${value.left}px`);
  }, insets);
}

async function boxOf(locator: Locator): Promise<Box> {
  const box = await locator.boundingBox();
  expect(box, `expected ${String(locator)} to have a layout box`).not.toBeNull();
  return box!;
}

function expectInsideSafeArea(box: Box, insets: Insets, viewport: { width: number; height: number }) {
  expect(box.x).toBeGreaterThanOrEqual(insets.left - 0.5);
  expect(box.y).toBeGreaterThanOrEqual(insets.top - 0.5);
  expect(box.x + box.width).toBeLessThanOrEqual(viewport.width - insets.right + 0.5);
  expect(box.y + box.height).toBeLessThanOrEqual(viewport.height - insets.bottom + 0.5);
}

async function expectNoHorizontalOverflow(page: Page, width: number) {
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(scrollWidth).toBeLessThanOrEqual(width + 1);
}

async function expectNoPageScroll(page: Page, height: number) {
  const scrollHeight = await page.evaluate(() => document.documentElement.scrollHeight);
  expect(scrollHeight).toBeLessThanOrEqual(height + 1);
}

async function importAndOpenText(page: Page) {
  await page.locator('input[type="file"]').setInputFiles(fixture);
  await expect(page.getByRole("button", { name: "打开《long reader》" })).toBeVisible();
  await page.getByRole("button", { name: "打开《long reader》" }).click();
  await expect(page.locator(".text-stage-paged")).toBeVisible();
}

async function topVisibleBlockStart(page: Page): Promise<number> {
  return page.evaluate(() => {
    const surface = document.querySelector<HTMLElement>(".reading-surface");
    if (!surface) return -1;
    const surfaceRect = surface.getBoundingClientRect();
    const lineTop = surfaceRect.top + 12;
    let best = -1;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (const node of document.querySelectorAll<HTMLElement>(".text-stage [data-source-start]")) {
      const rect = node.getBoundingClientRect();
      if (rect.right <= surfaceRect.left || rect.left >= surfaceRect.right) continue;
      if (rect.bottom <= surfaceRect.top || rect.top >= surfaceRect.bottom) continue;
      const start = Number(node.dataset.sourceStart);
      if (!Number.isFinite(start) || start <= 0) continue;
      const distance = rect.top < lineTop ? lineTop - rect.top : rect.top - lineTop;
      if (distance < bestDistance) {
        bestDistance = distance;
        best = start;
      }
    }
    return best;
  });
}

test("declares viewport-fit=cover in the production HTML", async ({ request }) => {
  const response = await request.get("/");
  expect(response.ok()).toBe(true);
  const html = await response.text();
  const viewport = html.match(/<meta\s+name="viewport"\s+content="([^"]*)"/i)?.[1] ?? "";
  expect(viewport).toContain("width=device-width");
  expect(viewport).toContain("initial-scale=1.0");
  expect(viewport).toContain("viewport-fit=cover");
});

test("keeps the 1440x900 desktop layout when safe areas are zero", async ({ page }) => {
  await page.goto("/");
  const declaredSafeArea = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--safe-area-top").trim());
  expect(declaredSafeArea).not.toBe("");
  await applySafeArea(page, ZERO);
  const viewport = page.viewportSize()!;

  const shell = await boxOf(page.locator(".library-shell"));
  expect(shell.x).toBeCloseTo(0, 0);
  expect(shell.y).toBeCloseTo(0, 0);
  expect(shell.width).toBeCloseTo(viewport.width, 0);
  expect(shell.height).toBeGreaterThanOrEqual(viewport.height);
  await expectNoHorizontalOverflow(page, viewport.width);

  await page.getByRole("button", { name: "反馈" }).click();
  const dialog = await boxOf(page.locator(".dialog"));
  const backdrop = await boxOf(page.locator(".dialog-backdrop"));
  expect(backdrop.x).toBeCloseTo(0, 0);
  expect(backdrop.y).toBeCloseTo(0, 0);
  expect(backdrop.width).toBeCloseTo(viewport.width, 0);
  expect(backdrop.height).toBeCloseTo(viewport.height, 0);
  expectInsideSafeArea(dialog, ZERO, viewport);
  await page.locator(".dialog-actions").getByRole("button", { name: "取消" }).click();

  await importAndOpenText(page);
  const reader = await boxOf(page.locator(".reader-shell"));
  expect(reader.x).toBeCloseTo(0, 0);
  expect(reader.y).toBeCloseTo(0, 0);
  expect(reader.width).toBeCloseTo(viewport.width, 0);
  expect(reader.height).toBeCloseTo(viewport.height, 0);
  const toolbar = await boxOf(page.locator(".reader-toolbar"));
  expect(toolbar.height).toBeCloseTo(58, 0);
  const surface = await boxOf(page.locator(".reading-surface"));
  expect(surface.y).toBeCloseTo(58, 0);
  expect(surface.height).toBeCloseTo(viewport.height - 58, 0);
  await expectNoPageScroll(page, viewport.height);
});

test("portrait PWA keeps the shelf, reader, panels, and dialog clear of the status bar", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const insets: Insets = { top: 47, right: 0, bottom: 34, left: 0 };
  const viewport = page.viewportSize()!;
  await page.goto("/");
  await applySafeArea(page, insets);

  const sidebar = await boxOf(page.locator(".sidebar"));
  expect(sidebar.x).toBeCloseTo(0, 0);
  expect(Math.round(sidebar.width)).toBe(viewport.width);
  const brand = await boxOf(page.locator(".brand"));
  expect(brand.y).toBeGreaterThanOrEqual(insets.top - 0.5);
  expectInsideSafeArea(brand, insets, viewport);
  const header = await boxOf(page.locator(".library-header"));
  expect(header.y).toBeGreaterThanOrEqual(insets.top - 0.5);
  expect(header.y - (sidebar.y + sidebar.height)).toBeCloseTo(30, 0);
  const dropZone = await boxOf(page.locator(".drop-zone"));
  expectInsideSafeArea(dropZone, { ...insets, top: 0, bottom: 0 }, viewport);
  await expectNoHorizontalOverflow(page, viewport.width);

  await page.getByRole("button", { name: "反馈" }).click();
  const dialog = await boxOf(page.locator(".dialog"));
  const backdrop = await boxOf(page.locator(".dialog-backdrop"));
  expect(backdrop.x).toBeCloseTo(0, 0);
  expect(backdrop.y).toBeCloseTo(0, 0);
  expect(backdrop.width).toBeCloseTo(viewport.width, 0);
  expect(backdrop.height).toBeCloseTo(viewport.height, 0);
  expectInsideSafeArea(dialog, insets, viewport);
  expect(await page.locator(".dialog").evaluate((element) => getComputedStyle(element).overflowY)).toBe("auto");
  await page.locator(".dialog-actions").getByRole("button", { name: "取消" }).click();

  await importAndOpenText(page);
  const toolbar = await boxOf(page.locator(".reader-toolbar"));
  expect(toolbar.y).toBeCloseTo(insets.top, 0);
  expect(toolbar.height).toBeCloseTo(58, 0);
  for (const name of ["返回书架", "目录", "书内搜索", "阅读设置"]) {
    expectInsideSafeArea(await boxOf(page.getByRole("button", { name })), insets, viewport);
  }
  const surface = await boxOf(page.locator(".reading-surface"));
  expect(surface.y).toBeCloseTo(insets.top + 58, 0);
  expect(surface.y + surface.height).toBeCloseTo(viewport.height - insets.bottom, 0);
  await expectNoPageScroll(page, viewport.height);

  await page.getByRole("button", { name: "阅读设置" }).click();
  const settings = await boxOf(page.locator(".settings-panel"));
  expect(settings.y).toBeCloseTo(insets.top + 58, 0);
  expectInsideSafeArea(settings, insets, viewport);
  await page.getByRole("button", { name: "关闭阅读设置" }).click();

  await page.getByRole("button", { name: "目录" }).click();
  const outline = await boxOf(page.locator(".outline-panel"));
  expectInsideSafeArea(outline, insets, viewport);
  await page.getByRole("button", { name: "关闭目录" }).click();

  await page.getByRole("button", { name: "书内搜索" }).click();
  const search = await boxOf(page.locator(".search-panel"));
  expectInsideSafeArea(search, insets, viewport);
  const searchBox = page.getByRole("searchbox", { name: "书内搜索" });
  await searchBox.fill("第一章");
  await searchBox.press("Enter");
  await expect(page.locator(".search-result").first()).toBeVisible();
  await page.getByRole("button", { name: "关闭书内搜索" }).click();

  await page.getByRole("button", { name: "下一页" }).click();
  await page.getByRole("button", { name: "下一页" }).click();
  await expect.poll(() => page.locator(".text-stage-paged").evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);
  const blockStart = await topVisibleBlockStart(page);
  expect(blockStart).toBeGreaterThan(0);

  await page.setViewportSize({ width: 844, height: 390 });
  const landscapeInsets: Insets = { top: 0, right: 47, bottom: 21, left: 47 };
  await applySafeArea(page, landscapeInsets);
  const landscapeViewport = page.viewportSize()!;
  const stage = page.locator(".text-stage-paged");
  await expect.poll(() => stage.evaluate((element) => element.clientHeight))
    .toBeCloseTo(landscapeViewport.height - 58 - landscapeInsets.bottom, 0);
  await expect.poll(() => page.evaluate((start) => {
    const surface = document.querySelector<HTMLElement>(".reading-surface");
    if (!surface) return false;
    const surfaceRect = surface.getBoundingClientRect();
    return [...document.querySelectorAll<HTMLElement>(`[data-source-start="${start}"]`)].some((node) => {
      const nodeRect = node.getBoundingClientRect();
      return nodeRect.right > surfaceRect.left
        && nodeRect.left < surfaceRect.right
        && nodeRect.bottom > surfaceRect.top
        && nodeRect.top < surfaceRect.bottom;
    });
  }, blockStart)).toBe(true);
  await expectNoPageScroll(page, landscapeViewport.height);
});

test("landscape PWA insets both sides and keeps overlays inside the safe rectangle", async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 });
  const insets: Insets = { top: 0, right: 47, bottom: 21, left: 47 };
  const viewport = page.viewportSize()!;
  await page.goto("/");
  await applySafeArea(page, insets);

  const sidebar = await boxOf(page.locator(".sidebar"));
  expect(sidebar.x).toBeCloseTo(0, 0);
  expect(sidebar.y).toBeCloseTo(0, 0);
  expect(sidebar.height).toBeCloseTo(viewport.height, 0);
  const brand = await boxOf(page.locator(".brand"));
  expect(brand.x).toBeGreaterThanOrEqual(insets.left - 0.5);
  expectInsideSafeArea(brand, insets, viewport);
  const header = await boxOf(page.locator(".library-header"));
  expect(header.y).toBeCloseTo(48 + insets.top, 0);
  expectInsideSafeArea(header, insets, viewport);
  await expectNoHorizontalOverflow(page, viewport.width);

  await importAndOpenText(page);
  expectInsideSafeArea(await boxOf(page.locator(".reader-toolbar")), insets, viewport);
  expectInsideSafeArea(await boxOf(page.locator(".reading-surface")), insets, viewport);
  expect((await boxOf(page.locator(".reader-title"))).width).toBeGreaterThan(0);

  await page.getByRole("button", { name: "阅读设置" }).click();
  const settings = await boxOf(page.locator(".settings-panel"));
  expectInsideSafeArea(settings, insets, viewport);
  await page.getByRole("button", { name: "夜间" }).click();
  expect(await page.locator(".reader-shell").evaluate((element) => getComputedStyle(element).backgroundColor))
    .toBe("rgb(23, 25, 24)");
  await page.getByRole("button", { name: "关闭阅读设置" }).click();
  await page.getByRole("button", { name: "返回书架" }).click();

  await page.locator('input[type="file"]').setInputFiles({
    name: "safe-area.pdf",
    mimeType: "application/pdf",
    buffer: syntheticPdf(),
  });
  await page.getByRole("button", { name: "打开《safe area》" }).click();
  const status = page.locator(".page-status");
  await expect(status).toHaveText("1 / 1");
  const statusBox = await boxOf(status);
  expect(viewport.height - (statusBox.y + statusBox.height)).toBeCloseTo(14 + insets.bottom, 0);
  const shell = await boxOf(page.locator(".reader-shell"));
  expect(shell.x).toBeCloseTo(0, 0);
  expect(shell.y).toBeCloseTo(0, 0);
  expect(shell.width).toBeCloseTo(viewport.width, 0);
  expect(shell.height).toBeCloseTo(viewport.height, 0);
  await expectNoPageScroll(page, viewport.height);
});
