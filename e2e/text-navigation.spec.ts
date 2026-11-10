import { changeReaderMode, showReaderToolbar } from "./readerControls";
import { expect, test, type Page } from "@playwright/test";
import {
  BOUNDARY_MARKER, chapterText, CRLF_MARKER, crlfText, exactFragmentBoundaryText,
  FRAGMENT_BOUNDARY_MARKER, fragmentBoundaryText, longParagraphText, multiParagraphText, SEARCH_MARKER,
  textPayload,
} from "./syntheticText";

const readerName = "synthetic reader";

function offsetOf(page: Page, selector = ".text-stage") {
  return page.locator(selector).getAttribute("data-source-offset")
    .then((value) => (value === null ? Number.NaN : Number(value)));
}

async function openReader(page: Page, text: string): Promise<void> {
  await page.goto("/");
  await page.locator('input[type="file"]').setInputFiles(textPayload(text));
  await page.getByRole("button", { name: `打开《${readerName}》` }).click();
}

async function searchAndOpen(page: Page, query: string): Promise<void> {
  await page.keyboard.press("Control+f");
  const search = page.getByRole("searchbox", { name: "书内搜索" });
  await search.fill(query);
  await search.press("Enter");
  await expect(page.locator(".search-result").first()).toBeVisible();
  await page.locator(".search-result").first().click();
}

async function closeSearch(page: Page): Promise<void> {
  await page.keyboard.press("Control+f");
  await page.getByRole("button", { name: "关闭书内搜索" }).click();
}

async function waitViewReady(page: Page, mode: "book" | "article"): Promise<void> {
  await page.waitForFunction(
    (expected) => document.querySelector(".text-stage")?.getAttribute("data-view-ready") === expected,
    mode,
    { timeout: 30_000 },
  );
}

async function visibleScrollFontSize(page: Page): Promise<number> {
  return page.evaluate(() => {
    const element = [...document.querySelectorAll<HTMLElement>(".text-fragment")]
      .find((candidate) => {
        const rect = candidate.getBoundingClientRect();
        return rect.bottom > 0 && rect.top < window.innerHeight;
      });
    return element ? Number.parseFloat(getComputedStyle(element).fontSize) : Number.NaN;
  });
}

async function scrollFragmentStyle(page: Page): Promise<{
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  textIndent: number;
  width: number;
}> {
  return page.evaluate(() => {
    const visible = [...document.querySelectorAll<HTMLElement>(".text-fragment")]
      .find((candidate) => {
        const rect = candidate.getBoundingClientRect();
        return rect.bottom > 0 && rect.top < window.innerHeight;
      });
    const firstParagraph = document.querySelector<HTMLElement>(".text-fragment-start");
    if (!visible || !firstParagraph) {
      return { fontFamily: "", fontSize: 0, lineHeight: 0, textIndent: 0, width: 0 };
    }
    const style = getComputedStyle(visible);
    return {
      fontFamily: style.fontFamily,
      fontSize: Number.parseFloat(style.fontSize),
      lineHeight: Number.parseFloat(style.lineHeight),
      textIndent: Number.parseFloat(getComputedStyle(firstParagraph).textIndent),
      width: visible.getBoundingClientRect().width,
    };
  });
}

async function topVisibleOffset(page: Page): Promise<number> {
  return page.evaluate(() => {
    const scroller = document.querySelector(".text-scroll-list");
    if (!(scroller instanceof HTMLElement)) return Number.NaN;
    const rect = scroller.getBoundingClientRect();
    const padding = Number.parseFloat(getComputedStyle(scroller).paddingTop) || 0;
    if (scroller.closest("[inert]")) {
      for (const span of scroller.querySelectorAll<HTMLElement>("[data-source-start]")) {
        if (span.getBoundingClientRect().bottom <= rect.top + padding + 2) continue;
        const walker = document.createTreeWalker(span, NodeFilter.SHOW_TEXT);
        let node = walker.nextNode();
        let consumed = 0;
        while (node) {
          const length = node.textContent?.length ?? 0;
          const range = document.createRange();
          range.selectNodeContents(node);
          const boxes = [...range.getClientRects()];
          if (boxes.some((box) => box.bottom > rect.top + padding + 2)) {
            let low = 0;
            let high = Math.max(0, length - 1);
            while (low < high) {
              const middle = Math.floor((low + high) / 2);
              range.setStart(node, middle);
              range.setEnd(node, middle + 1);
              if (range.getBoundingClientRect().bottom > rect.top + padding + 2) high = middle;
              else low = middle + 1;
            }
            return Number(span.dataset.sourceStart) + consumed + low;
          }
          consumed += length;
          node = walker.nextNode();
        }
      }
      return Number.NaN;
    }
    const range = document.caretRangeFromPoint(rect.left + rect.width / 2, rect.top + padding + 2);
    if (!range) return Number.NaN;
    const node = range.startContainer;
    const element = (node.nodeType === Node.ELEMENT_NODE ? node as Element : node.parentElement)
      ?.closest("[data-source-start]");
    if (!element) return Number.NaN;
    const probe = document.createRange();
    probe.setStart(element, 0);
    probe.setEnd(node, range.startOffset);
    return Number(element.getAttribute("data-source-start")) + probe.toString().length;
  });
}

test("navigates the automatic outline in paged and scroll modes", async ({ page }) => {
  const text = chapterText(8, 4);
  await openReader(page, text);
  await expect(page.locator(".text-stage-paged")).toBeVisible();
  await expect(page.getByRole("button", { name: "目录" })).toBeEnabled();

  const chapterThree = text.indexOf("第 3 章");
  await showReaderToolbar(page);
  await page.getByRole("button", { name: "目录" }).click();
  await page.getByRole("button", { name: "第 3 章 合成章节" }).click();
  await expect.poll(() => offsetOf(page, ".text-stage-paged")).toBeGreaterThan(chapterThree - 3000);

  await changeReaderMode(page, "滚动");
  await expect(page.locator(".text-stage-scroll")).toBeVisible();
  const chapterSix = text.indexOf("第 6 章");
  await showReaderToolbar(page);
  await page.getByRole("button", { name: "目录" }).click();
  await page.getByRole("button", { name: "第 6 章 合成章节" }).click();
  await expect.poll(() => offsetOf(page, ".text-stage-scroll")).toBeGreaterThanOrEqual(chapterSix - 40);
});

test("keeps the source position across mode switches, wheel scrolling, and font changes", async ({ page }) => {
  await openReader(page, chapterText(10, 4));
  await expect(page.locator(".text-stage-paged")).toBeVisible();
  await expect(page.locator(".text-stage-paged")).toHaveAttribute("data-source-offset", /^\d+$/);
  await page.getByRole("button", { name: "下一页" }).click();
  await page.getByRole("button", { name: "下一页" }).click();
  const pagedOffset = await offsetOf(page, ".text-stage-paged");
  expect(pagedOffset).toBeGreaterThan(0);

  await changeReaderMode(page, "滚动");
  await expect(page.locator(".text-stage-scroll")).toBeVisible();
  await expect(page.locator(".text-fragment").first()).toBeVisible();
  await expect.poll(() => offsetOf(page, ".text-stage-scroll")).toBeGreaterThanOrEqual(pagedOffset - 150);

  await page.mouse.move(720, 450);
  await page.mouse.wheel(0, 900);
  await expect.poll(() => offsetOf(page, ".text-stage-scroll")).toBeGreaterThan(pagedOffset);
  const beforeFont = await offsetOf(page, ".text-stage-scroll");
  const beforeFontTop = await topVisibleOffset(page);
  const beforeFontSize = await visibleScrollFontSize(page);

  await page.mouse.click(720, 450);
  await page.keyboard.press("]");
  await expect.poll(() => topVisibleOffset(page)).toBeGreaterThanOrEqual(beforeFontTop - 150);
  await expect.poll(() => topVisibleOffset(page)).toBeLessThanOrEqual(beforeFontTop + 150);
  await expect.poll(() => visibleScrollFontSize(page)).toBeGreaterThan(beforeFontSize * 1.05);
  expect(await visibleScrollFontSize(page)).toBeCloseTo(beforeFontSize * 1.1, 1);
  const afterFont = await offsetOf(page, ".text-stage-scroll");
  expect(Math.abs(afterFont - beforeFont)).toBeLessThanOrEqual(150);

  await changeReaderMode(page, "翻页");
  await expect(page.locator(".text-stage-paged")).toBeVisible();
  await expect.poll(() => offsetOf(page, ".text-stage-paged")).toBeLessThanOrEqual(beforeFont);
  await expect.poll(() => offsetOf(page, ".text-stage-paged")).toBeGreaterThan(beforeFont - 3000);
});

test("crosses paged chapters, keeps scroll mounts bounded, and supports keyboard paging", async ({ page }) => {
  const text = longParagraphText();
  const boundaryOffset = text.indexOf(BOUNDARY_MARKER);
  const endMarkerOffset = text.indexOf(SEARCH_MARKER);
  await openReader(page, text);
  await expect(page.locator(".text-stage-paged")).toBeVisible();
  await expect(page.locator(".text-stage-paged")).toHaveAttribute("data-source-offset", /^\d+$/);

  await page.mouse.click(720, 450);
  const beforeKey = await offsetOf(page, ".text-stage-paged");
  await page.keyboard.press("ArrowRight");
  await expect.poll(() => offsetOf(page, ".text-stage-paged")).toBeGreaterThan(beforeKey);

  await searchAndOpen(page, BOUNDARY_MARKER);
  await expect.poll(() => offsetOf(page, ".text-stage-paged"))
    .toBeGreaterThan(boundaryOffset - 3000);
  const beforeChapterTurn = await offsetOf(page, ".text-stage-paged");
  await closeSearch(page);
  await page.getByRole("button", { name: "下一页" }).click();
  await expect.poll(() => offsetOf(page, ".text-stage-paged")).toBeGreaterThan(beforeChapterTurn);
  await page.waitForTimeout(250);
  await page.getByRole("button", { name: "上一页" }).click();
  await expect.poll(() => offsetOf(page, ".text-stage-paged")).toBeLessThanOrEqual(beforeChapterTurn);

  await searchAndOpen(page, SEARCH_MARKER);
  await closeSearch(page);
  await expect.poll(() => offsetOf(page, ".text-stage-paged")).toBeGreaterThan(endMarkerOffset - 3000);
  await page.getByRole("button", { name: "下一页" }).click();
  await expect(page.locator(".text-stage-paged")).toBeVisible();
  await expect.poll(() => offsetOf(page, ".text-stage-paged")).toBeGreaterThan(endMarkerOffset - 3000);

  await changeReaderMode(page, "滚动");
  await expect(page.locator(".text-stage-scroll")).toBeVisible();
  const statsAtEnd = await page.evaluate(() => {
    const stage = document.querySelector(".text-stage-scroll");
    if (!stage) return { fragments: 0, characters: 0, nodes: 0 };
    const fragments = [...stage.querySelectorAll(".text-fragment")];
    return {
      fragments: fragments.length,
      characters: fragments.reduce((total, element) => total + (element.textContent?.length ?? 0), 0),
      nodes: stage.querySelectorAll("*").length,
    };
  });
  expect(statsAtEnd.fragments).toBeLessThanOrEqual(25);
  expect(statsAtEnd.characters).toBeLessThanOrEqual(100_000);
  expect(statsAtEnd.nodes).toBeLessThanOrEqual(4000);

  await searchAndOpen(page, "长");
  await closeSearch(page);
  await expect.poll(() => offsetOf(page, ".text-stage-scroll")).toBeLessThan(2000);
  const statsAtStart = await page.evaluate(() => {
    const stage = document.querySelector(".text-stage-scroll");
    if (!stage) return { fragments: 0, characters: 0, nodes: 0 };
    const fragments = [...stage.querySelectorAll(".text-fragment")];
    return {
      fragments: fragments.length,
      characters: fragments.reduce((total, element) => total + (element.textContent?.length ?? 0), 0),
      nodes: stage.querySelectorAll("*").length,
    };
  });
  expect(statsAtStart.fragments).toBeLessThanOrEqual(25);
  expect(statsAtStart.characters).toBeLessThanOrEqual(100_000);
  expect(statsAtStart.nodes).toBeLessThanOrEqual(4000);
});

test("highlights a search match split across fragment spans", async ({ page }) => {
  await page.addInitScript(() => {
    const attachShadow = Element.prototype.attachShadow;
    Element.prototype.attachShadow = function (this: Element, init: ShadowRootInit) {
      return attachShadow.call(this, { ...init, mode: "open" });
    };
  });
  await openReader(page, fragmentBoundaryText());
  await expect(page.locator(".text-stage-paged")).toBeVisible();
  await waitViewReady(page, "book");
  await searchAndOpen(page, FRAGMENT_BOUNDARY_MARKER);
  const frame = page.frameLocator("foliate-paginator iframe");
  await expect(frame.locator(".text-search-highlight")).toHaveCount(2);
  expect((await frame.locator(".text-search-highlight").allTextContents()).join(""))
    .toBe(FRAGMENT_BOUNDARY_MARKER);
  await closeSearch(page);

  await changeReaderMode(page, "滚动");
  await expect(page.locator(".text-stage-scroll")).toBeVisible();
  await waitViewReady(page, "article");
  await searchAndOpen(page, FRAGMENT_BOUNDARY_MARKER);
  await expect(page.locator(".text-search-highlight")).toHaveCount(2);
  expect((await page.locator(".text-search-highlight").allTextContents()).join(""))
    .toBe(FRAGMENT_BOUNDARY_MARKER);
});

test("survives rapid mode toggles without stale progress callbacks", async ({ page }) => {
  await openReader(page, multiParagraphText(80));
  await expect(page.locator(".text-stage-paged")).toBeVisible();
  await waitViewReady(page, "book");
  for (let cycle = 0; cycle < 4; cycle += 1) {
    await changeReaderMode(page, "滚动");
    await changeReaderMode(page, "翻页");
  }
  await expect(page.locator(".text-stage-paged")).toBeVisible();
  await waitViewReady(page, "book");
  const offset = await offsetOf(page, ".text-stage-paged");
  expect(Number.isFinite(offset)).toBe(true);
  expect(offset).toBeGreaterThanOrEqual(0);
  await expect(page.getByText("阅读器遇到问题")).toHaveCount(0);
});

test("preserves CRLF source offsets in both views", async ({ page }) => {
  await page.addInitScript(() => {
    const attachShadow = Element.prototype.attachShadow;
    Element.prototype.attachShadow = function (this: Element, init: ShadowRootInit) {
      return attachShadow.call(this, { ...init, mode: "open" });
    };
  });
  const text = crlfText();
  const markerOffset = text.indexOf(CRLF_MARKER);
  await openReader(page, text);
  await expect(page.locator(".text-stage-paged")).toBeVisible();
  await waitViewReady(page, "book");
  await searchAndOpen(page, CRLF_MARKER);
  const frame = page.frameLocator("foliate-paginator iframe");
  await expect(frame.locator(".text-search-highlight")).toHaveText(CRLF_MARKER);
  await closeSearch(page);

  await changeReaderMode(page, "滚动");
  await expect(page.locator(".text-stage-scroll")).toBeVisible();
  await waitViewReady(page, "article");
  await searchAndOpen(page, CRLF_MARKER);
  await expect(page.locator(".text-search-highlight")).toHaveText(CRLF_MARKER);
  const offset = await offsetOf(page, ".text-stage-scroll");
  expect(Math.abs(offset - markerOffset)).toBeLessThanOrEqual(200);
});

test("places a fragment-boundary target on the page containing it", async ({ page }) => {
  await page.addInitScript(() => {
    const attachShadow = Element.prototype.attachShadow;
    Element.prototype.attachShadow = function (this: Element, init: ShadowRootInit) {
      return attachShadow.call(this, { ...init, mode: "open" });
    };
  });
  await openReader(page, exactFragmentBoundaryText());
  await expect(page.locator(".text-stage-paged")).toBeVisible();
  await waitViewReady(page, "book");
  await page.evaluate(() => {
    const paginator = document.querySelector("foliate-paginator");
    (window as unknown as { __relocateRanges: string[] }).__relocateRanges = [];
    paginator?.addEventListener("relocate", (event) => {
      const range = (event as CustomEvent<{ range?: Range }>).detail?.range;
      if (range) (window as unknown as { __relocateRanges: string[] }).__relocateRanges.push(range.toString());
    });
  });
  await searchAndOpen(page, FRAGMENT_BOUNDARY_MARKER);
  await expect.poll(() => page.evaluate((marker) => (
    (window as unknown as { __relocateRanges: string[] }).__relocateRanges
      .some((text) => text.includes(marker))
  ), FRAGMENT_BOUNDARY_MARKER)).toBe(true);
});

test("queues a search jump requested during a wheel page turn", async ({ page }) => {
  await openReader(page, multiParagraphText(120));
  await expect(page.locator(".text-stage-paged")).toBeVisible();
  await waitViewReady(page, "book");
  await page.keyboard.press("Control+f");
  const search = page.getByRole("searchbox", { name: "书内搜索" });
  await search.fill(SEARCH_MARKER);
  await search.press("Enter");
  await expect(page.locator(".search-result").first()).toBeVisible();
  await page.evaluate(() => {
    const paginator = document.querySelector("foliate-paginator");
    paginator?.dispatchEvent(new WheelEvent("wheel", { deltaY: 120, bubbles: true, cancelable: true }));
    document.querySelector(".search-result")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  await expect.poll(() => offsetOf(page, ".text-stage-paged")).toBeGreaterThan(10_000);
});

test("turns paged pages with the mouse wheel", async ({ page }) => {
  await openReader(page, multiParagraphText(60));
  await expect(page.locator(".text-stage-paged")).toBeVisible();
  await waitViewReady(page, "book");
  const before = await offsetOf(page, ".text-stage-paged");
  await page.mouse.move(720, 450);
  await page.mouse.wheel(0, 180);
  await expect.poll(() => offsetOf(page, ".text-stage-paged")).toBeGreaterThan(before);
});

test("restores a mid-fragment scroll position after reload", async ({ page }) => {
  const text = longParagraphText(20_000);
  await openReader(page, text);
  await changeReaderMode(page, "滚动");
  await expect(page.locator(".text-stage-scroll")).toBeVisible();
  await waitViewReady(page, "article");
  await page.mouse.move(720, 450);
  await page.mouse.wheel(0, 900);
  await expect.poll(() => offsetOf(page, ".text-stage-scroll")).toBeGreaterThan(0);
  const saved = await offsetOf(page, ".text-stage-scroll");
  const savedTop = await topVisibleOffset(page);
  expect(saved % 4000).not.toBe(0);

  await showReaderToolbar(page);
  await page.getByRole("button", { name: "返回书架" }).click();
  await page.reload();
  await page.getByRole("button", { name: `打开《${readerName}》` }).click();
  await expect(page.locator(".text-stage-scroll")).toBeVisible();
  await waitViewReady(page, "article");
  await expect.poll(async () => Math.abs((await topVisibleOffset(page)) - savedTop))
    .toBeLessThanOrEqual(150);
  const restored = await offsetOf(page, ".text-stage-scroll");
  expect(Math.abs(restored - saved)).toBeLessThanOrEqual(150);
});

test("keeps the scroll source position across outline and viewport changes", async ({ page }) => {
  await openReader(page, chapterText(10, 6));
  await changeReaderMode(page, "滚动");
  await expect(page.locator(".text-stage-scroll")).toBeVisible();
  await waitViewReady(page, "article");
  await page.mouse.move(720, 450);
  await page.mouse.wheel(0, 500);
  await expect.poll(() => offsetOf(page, ".text-stage-scroll")).toBeGreaterThan(0);
  const before = await topVisibleOffset(page);

  await showReaderToolbar(page);
  await page.getByRole("button", { name: "目录" }).click();
  await page.waitForTimeout(300);
  await expect.poll(async () => Math.abs((await topVisibleOffset(page)) - before)).toBeLessThanOrEqual(150);
  await page.getByRole("button", { name: "关闭目录" }).click();
  await page.waitForTimeout(300);
  await expect.poll(async () => Math.abs((await topVisibleOffset(page)) - before)).toBeLessThanOrEqual(150);

  await page.setViewportSize({ width: 1100, height: 800 });
  await page.waitForTimeout(300);
  await expect.poll(async () => Math.abs((await topVisibleOffset(page)) - before)).toBeLessThanOrEqual(150);
});

test("keeps the scroll target across font, spacing, indentation, and width settings", async ({ page }) => {
  await openReader(page, chapterText(10, 6));
  await changeReaderMode(page, "滚动");
  await expect(page.locator(".text-stage-scroll")).toBeVisible();
  await waitViewReady(page, "article");
  await page.mouse.move(720, 450);
  await page.mouse.wheel(0, 500);
  await expect.poll(() => offsetOf(page, ".text-stage-scroll")).toBeGreaterThan(0);
  const before = await topVisibleOffset(page);

  await showReaderToolbar(page);
  await page.getByRole("button", { name: "阅读设置" }).click();
  await page.getByLabel("字体").selectOption("serif");
  for (const option of ["宽松", "缩进两字"]) {
    await page.getByRole("button", { name: option }).click();
    await page.waitForTimeout(200);
    await expect.poll(async () => Math.abs((await topVisibleOffset(page)) - before)).toBeLessThanOrEqual(200);
  }
  await page.getByRole("button", { name: "宽", exact: true }).click();
  await page.waitForTimeout(200);
  await expect.poll(async () => Math.abs((await topVisibleOffset(page)) - before)).toBeLessThanOrEqual(200);
  await page.getByRole("button", { name: "关闭阅读设置" }).click();
  await page.waitForTimeout(200);
  await expect.poll(async () => Math.abs((await topVisibleOffset(page)) - before)).toBeLessThanOrEqual(200);

  const style = await scrollFragmentStyle(page);
  expect(style.fontFamily).toContain("Georgia");
  expect(style.lineHeight / style.fontSize).toBeCloseTo(1.9, 1);
  expect(style.textIndent / style.fontSize).toBeCloseTo(2, 1);
  expect(style.width).toBeCloseTo(916, 0);
});

test("keeps the paged target visible across outline, viewport, and font changes", async ({ page }) => {
  await openReader(page, chapterText(12, 6));
  await expect(page.locator(".text-stage-paged")).toBeVisible();
  await waitViewReady(page, "book");
  await page.getByRole("button", { name: "下一页" }).click();
  await page.getByRole("button", { name: "下一页" }).click();
  const saved = await offsetOf(page, ".text-stage-paged");
  expect(saved).toBeGreaterThan(0);

  const expectTargetVisible = async () => {
    const current = await offsetOf(page, ".text-stage-paged");
    expect(current).toBeLessThanOrEqual(saved + 40);
    expect(saved - current).toBeLessThanOrEqual(5000);
  };

  await showReaderToolbar(page);
  await page.getByRole("button", { name: "目录" }).click();
  await page.waitForTimeout(400);
  await expectTargetVisible();
  await page.getByRole("button", { name: "关闭目录" }).click();
  await page.waitForTimeout(300);

  await page.setViewportSize({ width: 1100, height: 800 });
  await page.waitForTimeout(400);
  await expectTargetVisible();

  await page.mouse.click(700, 430);
  await page.keyboard.press("]");
  await page.waitForTimeout(400);
  await expectTargetVisible();

  await showReaderToolbar(page);
  await page.getByRole("button", { name: "阅读设置" }).click();
  await page.getByRole("button", { name: "宽", exact: true }).click();
  await page.waitForTimeout(400);
  await expectTargetVisible();
  await page.getByRole("button", { name: "缩进两字" }).click();
  await page.waitForTimeout(400);
  await expectTargetVisible();
  await page.getByRole("button", { name: "关闭阅读设置" }).click();
  await page.waitForTimeout(300);
  await expectTargetVisible();
});

test("keeps selected source text across mounted fragment blocks", async ({ page }) => {
  const source = fragmentBoundaryText();
  await openReader(page, source);
  await changeReaderMode(page, "滚动");
  await expect(page.locator(".text-stage-scroll")).toBeVisible();
  await waitViewReady(page, "article");
  await searchAndOpen(page, FRAGMENT_BOUNDARY_MARKER);
  await closeSearch(page);

  const selected = await page.evaluate(() => {
    const spans = [...document.querySelectorAll(".text-fragment [data-source-start]")];
    const first = spans.find((span) => span.getAttribute("data-source-start") === "0");
    const second = spans.find((span) => span.getAttribute("data-source-start") === "4000");
    const firstText = first?.firstChild;
    const secondText = second?.firstChild;
    if (!(firstText instanceof Text) || !(secondText instanceof Text)) return null;
    const range = document.createRange();
    range.setStart(firstText, firstText.length - 5);
    range.setEnd(secondText, 6);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    return selection?.toString() ?? null;
  });
  expect(selected).not.toBeNull();
  // Chrome serializes the block boundary as a line break. The actual source
  // text survives unchanged; the inserted break is a reported limitation.
  expect(selected!.replace(/\r?\n/g, "")).toBe(source.slice(3995, 4006));
});

test("bounds paged chapter URLs and releases them on close", async ({ page }) => {
  await page.addInitScript(() => {
    const created = new Set<string>();
    const create = URL.createObjectURL.bind(URL);
    const revoke = URL.revokeObjectURL.bind(URL);
    URL.createObjectURL = (blob: Blob) => {
      const url = create(blob);
      created.add(url);
      return url;
    };
    URL.revokeObjectURL = (url: string) => {
      created.delete(url);
      return revoke(url);
    };
    Object.defineProperty(window, "__liveBlobUrls", { get: () => [...created] });
  });
  const liveUrls = () => page.evaluate(
    () => (window as unknown as { __liveBlobUrls: string[] }).__liveBlobUrls.length,
  );

  for (let cycle = 0; cycle < 3; cycle += 1) {
    await page.goto("/");
    await page.locator('input[type="file"]').setInputFiles(
      textPayload(longParagraphText(30_000), `cycle-${cycle}.txt`),
    );
    await page.getByRole("button", { name: `打开《cycle ${cycle}》` }).click();
    await expect(page.locator(".text-stage-paged")).toBeVisible();
    await expect(page.locator(".text-stage-paged")).toHaveAttribute("data-source-offset", /^\d+$/);
    await expect.poll(liveUrls).toBeGreaterThan(0);

    await searchAndOpen(page, SEARCH_MARKER);
    await expect.poll(() => offsetOf(page, ".text-stage-paged")).toBeGreaterThan(50_000);
    await expect.poll(liveUrls).toBeLessThanOrEqual(1);

    await showReaderToolbar(page);
  await page.getByRole("button", { name: "返回书架" }).click();
    await expect.poll(liveUrls).toBe(0);
    await expect(page.locator("foliate-paginator")).toHaveCount(0);
  }
});


test("centers the sheet title and reveals the current chapter from its body on every opening", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openReader(page, chapterText(100, 12));
  for (const mode of ["滚动", "翻页"]) {
    await changeReaderMode(page, mode);
    await waitViewReady(page, mode === "滚动" ? "article" : "book");
    await searchAndOpen(page, "第 81-8 段");
    for (let opening = 0; opening < 2; opening += 1) {
      await showReaderToolbar(page);
      await page.getByRole("button", { name: "目录", exact: true }).click();
      const current = page.locator('.outline-link[aria-current="location"]');
      await expect(current).toHaveCount(1);
      await expect(current).toHaveText("第 81 章 合成章节");
      await expect(current).toHaveClass(/current/);
      await expect.poll(() => page.locator(".outline-nav").evaluate((element) => {
        const item = element.querySelector('[aria-current="location"]')!.getBoundingClientRect();
        const nav = element.getBoundingClientRect();
        return item.top >= nav.top && item.bottom <= nav.bottom && element.scrollTop > 0;
      })).toBe(true);
      const title = await page.locator(".reader-sheet > .reader-title").boundingBox();
      const sheet = await page.locator(".reader-sheet").boundingBox();
      expect(Math.abs(title!.x + title!.width / 2 - sheet!.x - sheet!.width / 2)).toBeLessThan(1);
      const titleText = await page.locator(".reader-title strong").boundingBox();
      expect(titleText!.y - sheet!.y).toBeGreaterThanOrEqual(12);
      await page.getByRole("button", { name: "关闭目录" }).click();
    }
  }
});
