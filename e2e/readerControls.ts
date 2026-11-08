import { expect, type Page } from "@playwright/test";

export async function showReaderToolbar(page: Page) {
  const reveal = page.locator(".chrome-reveal");
  await reveal.focus();
  await reveal.click();
  await expect(page.locator(".reader-toolbar")).toBeVisible();
}

export async function changeReaderMode(page: Page, mode: "滚动" | "翻页") {
  await showReaderToolbar(page);
  await page.getByRole("button", { name: "阅读设置", exact: true }).click();
  await page.getByRole("button", { name: mode, exact: true }).click();
  await page.getByRole("button", { name: "关闭阅读设置" }).click();
}
