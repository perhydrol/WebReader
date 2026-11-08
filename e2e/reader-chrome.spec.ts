import { expect, test } from "@playwright/test";
import { chapterText, textPayload } from "./syntheticText";
import { showReaderToolbar } from "./readerControls";

test("uses neutral dark controls with readable labels instead of saturated accent fills", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.locator(".library-shell")).toHaveClass(/dark/);
  for (const name of ["应用设置", "添加图书", "选择文件"]) {
    const style = await page.getByRole("button", { name, exact: true }).evaluate((element) => {
      const css = getComputedStyle(element);
      return { color: css.color, background: css.backgroundColor };
    });
    const rgb = (value: string) => (value.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);
    const foreground = rgb(style.color);
    const background = rgb(style.background);
    expect(Math.min(...foreground), name).toBeGreaterThan(220);
    expect(Math.max(...background) - Math.min(...background), name).toBeLessThan(15);
    expect(Math.max(...background), name).toBeLessThan(85);
  }
  await page.locator('input[type="file"]').setInputFiles(textPayload(chapterText(2, 2), "card.txt"));
  const open = page.getByRole("button", { name: "打开《card》" });
  await expect(open).toBeVisible();
  const cardStyle = await open.evaluate((element) => {
    const css = getComputedStyle(element);
    return { display: css.display, radius: css.borderRadius, background: css.backgroundColor };
  });
  expect(cardStyle).toEqual({ display: "grid", radius: "0px", background: "rgba(0, 0, 0, 0)" });
});

test("ships the iOS theme offline and keeps reader geometry stable under sheets", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".k-ios")).toHaveCount(1);
  await page.locator('input[type="file"]').setInputFiles(textPayload(chapterText(5, 8), "chrome.txt"));
  await page.getByRole("button", { name: "打开《chrome》" }).click();
  await expect(page.locator('.text-stage[data-view-ready="book"]')).toBeVisible();
  const surface = page.locator(".reading-surface");
  const before = await surface.boundingBox();
  await page.getByRole("button", { name: "阅读设置", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  expect(await surface.boundingBox()).toEqual(before);
  await page.getByRole("button", { name: "滚动", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.locator('.text-stage[data-view-ready="article"]')).toBeAttached();
  await page.getByRole("button", { name: "关闭阅读设置" }).click();
  expect(await surface.boundingBox()).toEqual(before);
});

test("traps sheet focus and preserves the paginator through repeated openings", async ({ page }) => {
  await page.goto("/");
  await page.locator('input[type="file"]').setInputFiles(textPayload(chapterText(4, 6), "focus.txt"));
  await page.getByRole("button", { name: "打开《focus》" }).click();
  await expect(page.locator('.text-stage[data-view-ready="book"]')).toBeVisible();
  await page.locator("foliate-paginator").evaluate((element) => element.setAttribute("data-identity-probe", "original"));
  for (let index = 0; index < 20; index += 1) {
    await showReaderToolbar(page);
    const trigger = page.getByRole("button", { name: "阅读设置", exact: true });
    await trigger.click();
    await expect(page.getByRole("dialog")).toHaveCount(1);
    await page.getByRole("button", { name: "关闭阅读设置" }).focus();
    await page.keyboard.press("Tab");
    expect(await page.evaluate(() => Boolean(document.activeElement?.closest("[role='dialog']")))).toBe(true);
    await page.keyboard.press("Escape");
    await expect(trigger).toBeFocused();
    await expect(page.locator(".reader-sheet")).toHaveCount(0);
  }
  await expect(page.locator('foliate-paginator[data-identity-probe="original"]')).toHaveCount(1);
});

test("reveals chrome from real paged content without changing its source or viewport", async ({ page }) => {
  await page.goto("/");
  await page.locator('input[type="file"]').setInputFiles(textPayload(chapterText(4, 6), "tap.txt"));
  await page.getByRole("button", { name: "打开《tap》" }).click();
  const stage = page.locator('.text-stage[data-view-ready="book"]');
  await expect(stage).toBeVisible();
  const before = await stage.boundingBox();
  const offset = await stage.getAttribute("data-source-offset");
  await page.clock.install();
  await page.clock.runFor(4200);
  await expect(page.locator(".reader-toolbar")).toBeHidden();
  const frame = page.frames().find((item) => item.url().startsWith("blob:"));
  expect(frame).toBeDefined();
  const x = before!.x + before!.width / 2;
  const y = before!.y + 120;
  await page.mouse.click(x, y);
  await page.clock.runFor(300);
  await expect(page.locator(".reader-toolbar")).toBeVisible();
  expect(await stage.boundingBox()).toEqual(before);
  expect(await stage.getAttribute("data-source-offset")).toBe(offset);
  await page.mouse.dblclick(x, y);
  await page.clock.runFor(5000);
  await expect(page.locator(".reader-toolbar")).toBeVisible();
  await frame!.evaluate(() => getSelection()?.removeAllRanges());
  await page.clock.runFor(4200);
  await expect(page.locator(".reader-toolbar")).toBeHidden();
  await page.locator(".chrome-reveal").focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "返回书架" })).toBeVisible();
});
