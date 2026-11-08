import { showReaderToolbar } from "./readerControls";
import { expect, test, type Page } from "@playwright/test";
import {
  nearLimitMultiParagraphText, nearLimitSingleParagraphText, SEARCH_MARKER, textPayload,
  type LargeSyntheticText,
} from "./syntheticText";

test.describe.configure({ timeout: 240_000 });

const readerName = "synthetic reader";

interface Position {
  offset: number | null;
  scroll: number;
}

interface LongTask {
  startTime: number;
  duration: number;
  name: string;
}

async function now(page: Page): Promise<number> {
  return page.evaluate(() => performance.now());
}

async function clickModeControl(page: Page, name: "滚动" | "翻页"): Promise<number> {
  const button = page.getByRole("button", { name, exact: true });
  await button.evaluate((element, target) => {
    const stage = document.querySelector(".text-stage");
    stage?.removeAttribute("data-mode-ready-at");
    if (stage) {
      const observer = new MutationObserver(() => {
        if (stage.getAttribute("data-view-ready") !== target) return;
        stage.setAttribute("data-mode-ready-at", String(performance.now()));
        observer.disconnect();
      });
      observer.observe(stage, { attributes: true, attributeFilter: ["data-view-ready"] });
    }
    element.addEventListener("pointerdown", () => {
      element.setAttribute("data-input-start", String(performance.now()));
    }, { once: true, capture: true });
  }, name === "滚动" ? "article" : "book");
  await button.click();
  return Number(await button.getAttribute("data-input-start"));
}

async function stagePosition(page: Page, selector: string): Promise<Position | null> {
  return page.evaluate((stageSelector) => {
    const stage = document.querySelector<HTMLElement>(stageSelector);
    if (!stage) return null;
    const rawOffset = stage.getAttribute("data-source-offset");
    const offset = rawOffset === null ? Number.NaN : Number(rawOffset);
    const scroller = stage.querySelector<HTMLElement>(".text-scroll-list");
    return {
      offset: Number.isFinite(offset) ? offset : null,
      scroll: stage.classList.contains("text-stage-paged")
        ? stage.scrollLeft
        : scroller?.scrollTop ?? stage.scrollTop,
    };
  }, selector);
}

async function longTasks(page: Page, start: number, end: number): Promise<LongTask[]> {
  return page.evaluate(({ from, to }) => {
    const entries = (window as unknown as { __longTasks: LongTask[] }).__longTasks ?? [];
    return entries.filter((entry) => entry.startTime + entry.duration > from && entry.startTime < to);
  }, { from: start, to: end });
}

async function hasPaginator(page: Page): Promise<boolean> {
  return (await page.locator("foliate-paginator").count()) > 0;
}

async function waitForViewReady(page: Page, mode: "book" | "article"): Promise<void> {
  await page.waitForFunction(
    (expected) => document.querySelector(".text-stage")?.getAttribute("data-view-ready") === expected,
    mode,
    { timeout: 120_000 },
  );
}

async function waitForFirstScreen(page: Page, mode: "paged" | "scroll"): Promise<void> {
  const stageSelector = mode === "paged" ? ".text-stage-paged" : ".text-stage-scroll";
  await expect(page.locator(stageSelector)).toBeVisible({ timeout: 120_000 });
  if (mode === "paged") {
    if (await hasPaginator(page)) {
      const frame = page.frameLocator("foliate-paginator iframe");
      await expect(frame.locator(".text-fragment-group").first()).toBeVisible({ timeout: 120_000 });
      await expect(page.locator(stageSelector)).toHaveAttribute("data-source-offset", /^\d+$/, { timeout: 120_000 });
    } else {
      await expect(page.locator(`${stageSelector} article p`).first()).toBeVisible({ timeout: 120_000 });
    }
    return;
  }
  if (await page.locator(".text-scroll-list").count()) {
    await expect(page.locator(".text-fragment").first()).toBeVisible({ timeout: 120_000 });
  } else {
    await expect(page.locator(`${stageSelector} article p`).first()).toBeVisible({ timeout: 120_000 });
  }
}

async function waitForPositionChange(
  page: Page, selector: string, before: Position, timeout = 120_000,
): Promise<void> {
  await expect.poll(async () => {
    const current = await stagePosition(page, selector);
    if (!current) return false;
    if (current.offset !== null && before.offset !== null) return current.offset !== before.offset;
    return current.scroll !== before.scroll;
  }, { timeout }).toBe(true);
}

async function domMetrics(page: Page, selector: string): Promise<{ nodes: number; characters: number }> {
  return page.evaluate((stageSelector) => {
    const stage = document.querySelector<HTMLElement>(stageSelector);
    const paginator = document.querySelector<HTMLElement & { shadowRoot: ShadowRoot | null }>("foliate-paginator");
    const iframe = paginator?.shadowRoot?.querySelector("iframe");
    const root = iframe?.contentDocument?.body
      ?? stage?.querySelector("article")
      ?? stage?.querySelector(".text-scroll-list")
      ?? stage;
    if (!root) return { nodes: 0, characters: 0 };
    return {
      nodes: root.querySelectorAll("*").length + 1,
      characters: root.textContent?.length ?? 0,
    };
  }, selector);
}

async function visibleFontSize(page: Page): Promise<number> {
  return page.evaluate(() => {
    const paginator = document.querySelector<HTMLElement & { shadowRoot: ShadowRoot | null }>("foliate-paginator");
    const iframe = paginator?.shadowRoot?.querySelector("iframe");
    const pagedBody = iframe?.contentDocument?.body;
    const element = pagedBody?.querySelector<HTMLElement>(".text-fragment-group")
      ?? document.querySelector<HTMLElement>(".text-fragment")
      ?? document.querySelector<HTMLElement>(".text-stage article p");
    return element ? Number.parseFloat(getComputedStyle(element).fontSize) : Number.NaN;
  });
}

async function runPerformanceCase(page: Page, input: LargeSyntheticText, label: string): Promise<void> {
  const payload = textPayload(input.text);
  console.log(`[perf:${label}] generator bytes=${input.bytes} units=${input.units} payloadBytes=${payload.bytes}`);

  await page.addInitScript(() => {
    (window as unknown as { __longTasks: LongTask[] }).__longTasks = [];
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        (window as unknown as { __longTasks: LongTask[] }).__longTasks.push({
          startTime: entry.startTime,
          duration: entry.duration,
          name: entry.name,
        });
      }
    });
    observer.observe({ type: "longtask", buffered: true });
    const attachShadow = Element.prototype.attachShadow;
    Element.prototype.attachShadow = function (this: Element, init: ShadowRootInit) {
      return attachShadow.call(this, { ...init, mode: "open" });
    };
  });

  await page.goto("/");
  const importStart = await now(page);
  await page.locator('input[type="file"]').setInputFiles(payload);
  await expect(page.getByRole("status")).toContainText("已将 1 本书添加到此浏览器", { timeout: 120_000 });
  const importEnd = await now(page);
  const importLong = await longTasks(page, importStart, importEnd);

  const openStart = await now(page);
  await page.getByRole("button", { name: `打开《${readerName}》` }).click();
  await page.waitForFunction(() => {
    const stage = document.querySelector(".text-stage");
    return Boolean(stage?.getAttribute("data-view-ready") || stage?.querySelector("article p"));
  }, undefined, { timeout: 120_000 });
  const openEnd = await now(page);
  const newImplementation = await hasPaginator(page);
  await waitForFirstScreen(page, "paged");
  const openLong = await longTasks(page, openStart, openEnd);
  const pagedMetrics = await domMetrics(page, ".text-stage-paged");
  const heapAfterOpen = await page.evaluate(
    () => (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize ?? null,
  );

  const turnStart = await now(page);
  const beforeTurn = await stagePosition(page, ".text-stage-paged");
  await page.getByRole("button", { name: "下一页" }).click();
  await waitForPositionChange(page, ".text-stage-paged", beforeTurn!);
  const turnEnd = await now(page);
  const turnLong = await longTasks(page, turnStart, turnEnd);

  await page.keyboard.press("Control+f");
  const search = page.getByRole("searchbox", { name: "书内搜索" });
  await search.fill(SEARCH_MARKER);
  const searchStart = await now(page);
  await search.press("Enter");
  await expect(page.locator(".search-result").first()).toBeVisible({ timeout: 60_000 });
  const searchEnd = await now(page);
  const searchLong = await longTasks(page, searchStart, searchEnd);

  const jumpStart = await now(page);
  const beforeJump = await stagePosition(page, ".text-stage-paged");
  await page.locator(".search-result").first().click();
  if (newImplementation) {
    await expect.poll(async () => {
      const current = await stagePosition(page, ".text-stage-paged");
      return current?.offset !== null && current!.offset > input.units * 0.9;
    }, { timeout: 120_000 }).toBe(true);
  } else {
    await waitForPositionChange(page, ".text-stage-paged", beforeJump!);
  }
  const jumpEnd = await now(page);
  const jumpLong = await longTasks(page, jumpStart, jumpEnd);
  await expect(page.locator(".search-panel")).toHaveCount(0);

  const modeFlowStart = await now(page);
  await showReaderToolbar(page);
  await page.getByRole("button", { name: "阅读设置", exact: true }).click();
  const switchStart = await clickModeControl(page, "滚动");
  let switchEnd: number;
  if (newImplementation) {
    await waitForViewReady(page, "article");
    switchEnd = Number(await page.locator(".text-stage").getAttribute("data-mode-ready-at"));
    await waitForFirstScreen(page, "scroll");
  } else {
    await waitForFirstScreen(page, "scroll");
    switchEnd = await now(page);
  }
  const switchLong = await longTasks(page, switchStart, switchEnd);
  await page.getByRole("button", { name: "关闭阅读设置" }).click();
  const modeFlowEnd = await now(page);
  const scrollMetrics = await domMetrics(page, ".text-stage-scroll");

  await page.mouse.move(720, 450);
  const wheelStart = await now(page);
  const beforeWheel = await stagePosition(page, ".text-stage-scroll");
  await page.mouse.wheel(0, -700);
  await waitForPositionChange(page, ".text-stage-scroll", beforeWheel!);
  const wheelEnd = await now(page);
  const wheelLong = await longTasks(page, wheelStart, wheelEnd);

  await page.mouse.click(720, 450);
  const fontBefore = await visibleFontSize(page);
  const fontStart = await now(page);
  await page.keyboard.press("]");
  await expect.poll(() => visibleFontSize(page), { timeout: 30_000 }).toBeGreaterThan(fontBefore);
  const fontEnd = await now(page);
  const fontLong = await longTasks(page, fontStart, fontEnd);
  const scrollMetricsAfterFont = await domMetrics(page, ".text-stage-scroll");

  const backFlowStart = await now(page);
  await showReaderToolbar(page);
  await page.getByRole("button", { name: "阅读设置", exact: true }).click();
  const backStart = await clickModeControl(page, "翻页");
  let backEnd: number;
  if (newImplementation) {
    await waitForViewReady(page, "book");
    backEnd = Number(await page.locator(".text-stage").getAttribute("data-mode-ready-at"));
    await waitForFirstScreen(page, "paged");
  } else {
    await waitForFirstScreen(page, "paged");
    backEnd = await now(page);
  }
  const backLong = await longTasks(page, backStart, backEnd);
  expect(switchEnd).toBeGreaterThan(switchStart);
  expect(backEnd).toBeGreaterThan(backStart);
  await page.getByRole("button", { name: "关闭阅读设置" }).click();
  const backFlowEnd = await now(page);

  const result = {
    label,
    implementation: newImplementation ? "new" : "baseline",
    input: { bytes: input.bytes, units: input.units },
    importMs: Math.round(importEnd - importStart),
    openMs: Math.round(openEnd - openStart),
    pageTurnMs: Math.round(turnEnd - turnStart),
    searchMs: Math.round(searchEnd - searchStart),
    jumpMs: Math.round(jumpEnd - jumpStart),
    modeSwitchMs: Math.round(switchEnd - switchStart),
    modeFlowMs: Math.round(modeFlowEnd - modeFlowStart),
    wheelMs: Math.round(wheelEnd - wheelStart),
    fontMs: Math.round(fontEnd - fontStart),
    switchBackMs: Math.round(backEnd - backStart),
    backFlowMs: Math.round(backFlowEnd - backFlowStart),
    pagedMetrics,
    scrollMetrics,
    scrollMetricsAfterFont,
    heapAfterOpen,
    longestTaskMs: {
      import: Math.round(Math.max(0, ...importLong.map((entry) => entry.duration))),
      open: Math.round(Math.max(0, ...openLong.map((entry) => entry.duration))),
      pageTurn: Math.round(Math.max(0, ...turnLong.map((entry) => entry.duration))),
      search: Math.round(Math.max(0, ...searchLong.map((entry) => entry.duration))),
      jump: Math.round(Math.max(0, ...jumpLong.map((entry) => entry.duration))),
      modeSwitch: Math.round(Math.max(0, ...switchLong.map((entry) => entry.duration))),
      wheel: Math.round(Math.max(0, ...wheelLong.map((entry) => entry.duration))),
      font: Math.round(Math.max(0, ...fontLong.map((entry) => entry.duration))),
      switchBack: Math.round(Math.max(0, ...backLong.map((entry) => entry.duration))),
    },
  };
  console.log(`[perf:${label}] ${JSON.stringify(result)}`);

  if (newImplementation) {
    expect(result.openMs, "TXT open to first screen").toBeLessThanOrEqual(2000);
    expect(result.pageTurnMs, "page turn").toBeLessThanOrEqual(250);
    expect(result.jumpMs, "search jump").toBeLessThanOrEqual(250);
    expect(result.modeSwitchMs, "mode switch").toBeLessThanOrEqual(250);
    expect(result.switchBackMs, "mode switch back").toBeLessThanOrEqual(250);
    expect(result.wheelMs, "scroll wheel").toBeLessThanOrEqual(250);
    expect(result.fontMs, "font change").toBeLessThanOrEqual(250);
    expect(result.pagedMetrics.characters, "active paged document characters").toBeLessThanOrEqual(48 * 1024);
    expect(result.longestTaskMs.open, "longest open task").toBeLessThan(1000);
    expect(result.longestTaskMs.pageTurn, "longest page-turn task").toBeLessThan(1000);
    expect(result.longestTaskMs.modeSwitch, "longest mode-switch task").toBeLessThan(1000);
  }
}

test("near-limit multi-paragraph TXT performance", async ({ page }) => {
  const input = nearLimitMultiParagraphText();
  await runPerformanceCase(page, input, "multi");
});

test("near-limit single-paragraph TXT performance", async ({ page }) => {
  const input = nearLimitSingleParagraphText();
  await runPerformanceCase(page, input, "single");
});
