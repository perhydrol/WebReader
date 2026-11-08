import {
  forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState,
} from "react";
import { Virtuoso, type VirtuosoHandle } from "react-virtuoso";
import {
  clampToVisibleOffset, findFragmentIndex, type TextFragment,
} from "../lib/textDocument";
import {
  rangeRectForLocalOffset, sourceBounds, sourceElements, sourceOffsetFromDomPoint,
} from "../lib/textDom";
import { TEXT_CONTENT_WIDTH } from "../lib/textDisplay";
import type { TextViewHandle, TextViewProps } from "./textViewTypes";
import { bindReaderContentEvents } from "../lib/readerContentEvents";

function caretAtPoint(document: Document, x: number, y: number): { node: Node; offset: number } | undefined {
  if (typeof document.caretRangeFromPoint === "function") {
    const range = document.caretRangeFromPoint(x, y);
    if (range) return { node: range.startContainer, offset: range.startOffset };
  }
  if (typeof document.caretPositionFromPoint === "function") {
    const position = document.caretPositionFromPoint(x, y);
    if (position) return { node: position.offsetNode, offset: position.offset };
  }
  return undefined;
}

function visibleSourceOffset(scroller: HTMLElement, model: TextViewProps["model"], fallback: number): number {
  const rect = scroller.getBoundingClientRect();
  const topInset = Number.parseFloat(getComputedStyle(scroller).paddingTop) || 0;
  const caret = caretAtPoint(
    scroller.ownerDocument,
    rect.left + rect.width / 2,
    rect.top + topInset + 1,
  );
  if (caret) {
    const offset = sourceOffsetFromDomPoint(caret.node, caret.offset);
    if (offset !== undefined) return clampToVisibleOffset(model, offset);
  }

  if (scroller.scrollTop <= 1) return model.fragments[0]?.start ?? 0;
  if (scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 2) return model.text.length;
  for (const element of sourceElements(scroller)) {
    const bounds = sourceBounds(element);
    const elementRect = element.getBoundingClientRect();
    if (bounds && elementRect.height > 0 && elementRect.bottom > rect.top + topInset) {
      // Hit testing ignores inert content under a sheet. Ranges still expose its geometry.
      let low = 0;
      let high = bounds.end - bounds.start;
      while (low < high) {
        const middle = Math.floor((low + high) / 2);
        const charRect = rangeRectForLocalOffset(element, middle);
        if (!charRect) return fallback;
        if (charRect.bottom <= rect.top + topInset + 1) low = middle + 1;
        else high = middle;
      }
      return clampToVisibleOffset(model, bounds.start + low);
    }
  }
  return fallback;
}

function highlightedText(text: string, fragment: TextFragment, match?: { start: number; end: number }) {
  if (!match) return text;
  const start = Math.max(match.start, fragment.start) - fragment.start;
  const end = Math.min(match.end, fragment.end) - fragment.start;
  if (start >= end) return text;
  return (
    <>
      {text.slice(0, start)}
      <mark className="text-search-highlight">{text.slice(start, end)}</mark>
      {text.slice(end)}
    </>
  );
}

export const TextScrollView = forwardRef<TextViewHandle, TextViewProps>(function TextScrollView({
  model, preferences, initialOffset, activeMatch, layoutRevision, onOffset, onReady, onContentInteraction,
}, ref) {
  const virtuosoRef = useRef<VirtuosoHandle>(null);
  const scrollerRef = useRef<HTMLElement | null>(null);
  const [scroller, setScroller] = useState<HTMLElement | null>(null);
  const initialVisibleRef = useRef(clampToVisibleOffset(model, initialOffset));
  const lastOffsetRef = useRef(initialVisibleRef.current);
  const restoringRef = useRef(false);
  const restoreTokenRef = useRef(0);
  const mountedRef = useRef(true);
  const scrollFrameRef = useRef(0);
  const onOffsetRef = useRef(onOffset);
  const onReadyRef = useRef(onReady);
  const interactionRef = useRef(onContentInteraction);
  interactionRef.current = onContentInteraction;
  onOffsetRef.current = onOffset;
  onReadyRef.current = onReady;

  useEffect(() => {
    if (!scroller) return;
    return bindReaderContentEvents(scroller, (event) => interactionRef.current?.(event), () => scroller.getBoundingClientRect());
  }, [scroller]);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const handleScrollerRef = useCallback((element: HTMLElement | Window | null) => {
    const next = element instanceof HTMLElement ? element : null;
    scrollerRef.current = next;
    setScroller(next);
  }, []);

  const goTo = useCallback((rawOffset: number) => {
    if (!mountedRef.current || model.fragments.length === 0) return;
    const offset = clampToVisibleOffset(model, rawOffset);
    lastOffsetRef.current = offset;
    const index = Math.min(model.fragments.length - 1, Math.max(0, findFragmentIndex(model.fragments, offset)));
    const fragment = model.fragments[index];
    if (!fragment) return;

    restoringRef.current = true;
    restoreTokenRef.current += 1;
    const token = restoreTokenRef.current;
    let attempts = 0;

    const finish = () => {
      if (!mountedRef.current || restoreTokenRef.current !== token) return;
      requestAnimationFrame(() => {
        if (!mountedRef.current || restoreTokenRef.current !== token) return;
        restoringRef.current = false;
        const scroller = scrollerRef.current;
        const actual = scroller ? visibleSourceOffset(scroller, model, lastOffsetRef.current) : lastOffsetRef.current;
        lastOffsetRef.current = actual;
        onOffsetRef.current(actual, model.text.length > 0 ? actual / model.text.length : 0);
        onReadyRef.current();
      });
    };

    const scrollToFragment = () => {
      virtuosoRef.current?.scrollToIndex({ index, align: "start" });
    };

    const correct = () => {
      if (!mountedRef.current || restoreTokenRef.current !== token) return;
      const element = scrollerRef.current;
      const fragmentElement = element?.querySelector<HTMLElement>(`[data-fragment-start="${fragment.start}"]`);
      if (!element || !fragmentElement) {
        attempts += 1;
        if (attempts % 5 === 0) scrollToFragment();
        if (attempts < 40) requestAnimationFrame(correct);
        else finish();
        return;
      }
      const localOffset = Math.max(0, Math.min(fragment.end - fragment.start, offset - fragment.start));
      const targetRect = rangeRectForLocalOffset(fragmentElement, localOffset);
      if (targetRect) {
        const topInset = Number.parseFloat(getComputedStyle(element).paddingTop) || 0;
        const targetTop = element.getBoundingClientRect().top + topInset + 1;
        const delta = targetRect.top - targetTop;
        if (Math.abs(delta) > 1) element.scrollTop += delta;
      }
      attempts += 1;
      if (attempts < 3) requestAnimationFrame(correct);
      else finish();
    };

    requestAnimationFrame(() => {
      scrollToFragment();
      requestAnimationFrame(correct);
    });
  }, [model]);

  useImperativeHandle(ref, () => ({
    goTo,
    previous: () => {
      const height = scrollerRef.current?.clientHeight ?? 0;
      virtuosoRef.current?.scrollBy({ top: -height * 0.86, behavior: "smooth" });
    },
    next: () => {
      const height = scrollerRef.current?.clientHeight ?? 0;
      virtuosoRef.current?.scrollBy({ top: height * 0.86, behavior: "smooth" });
    },
  }), [goTo]);

  useLayoutEffect(() => {
    goTo(lastOffsetRef.current);
  }, [
    goTo, layoutRevision, preferences.contentWidth, preferences.fontFamily,
    preferences.fontSizePercent, preferences.lineHeight, preferences.paragraphIndent,
  ]);

  useEffect(() => {
    if (!scroller) return;
    let frame = 0;
    const observer = new ResizeObserver(() => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => goTo(lastOffsetRef.current));
    });
    observer.observe(scroller);
    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [goTo, scroller]);

  useEffect(() => {
    if (!scroller || model.fragments.length === 0) return;
    const report = () => {
      if (!mountedRef.current || restoringRef.current) return;
      const offset = visibleSourceOffset(scroller, model, lastOffsetRef.current);
      lastOffsetRef.current = offset;
      onOffset(offset, model.text.length > 0 ? offset / model.text.length : 0);
    };
    const handleScroll = () => {
      window.cancelAnimationFrame(scrollFrameRef.current);
      scrollFrameRef.current = window.requestAnimationFrame(report);
    };
    scroller.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.cancelAnimationFrame(scrollFrameRef.current);
      scroller.removeEventListener("scroll", handleScroll);
    };
  }, [model, onOffset, scroller]);

  const initialIndex = Math.min(
    Math.max(0, model.fragments.length - 1),
    Math.max(0, findFragmentIndex(model.fragments, initialVisibleRef.current)),
  );

  return (
    <Virtuoso
      ref={virtuosoRef}
      className="text-scroll-list"
      style={{ height: "100%" }}
      totalCount={model.fragments.length}
      initialTopMostItemIndex={initialIndex}
      computeItemKey={(index) => model.fragments[index]?.id ?? index}
      increaseViewportBy={{ top: 800, bottom: 1200 }}
      scrollerRef={handleScrollerRef}
      itemContent={(index) => {
        const fragment = model.fragments[index];
        if (!fragment) return null;
        const text = model.text.slice(fragment.start, fragment.end);
        return (
          <div
            className="text-scroll-item"
            style={{ "--text-content-width": `${TEXT_CONTENT_WIDTH[preferences.contentWidth]}px` } as React.CSSProperties}
          >
            <p
              className={`text-fragment${fragment.continuesPrevious ? " text-fragment-continuation" : " text-fragment-start"}`}
              data-fragment-start={fragment.start}
              data-fragment-end={fragment.end}
              style={{
                textIndent: !fragment.continuesPrevious && preferences.paragraphIndent
                  ? `${preferences.paragraphIndent}em`
                  : undefined,
                paddingBottom: fragment.continuesNext ? undefined : "1em",
              }}
            >
              <span data-source-start={fragment.start} data-source-end={fragment.end}>
                {highlightedText(text, fragment, activeMatch)}
              </span>
            </p>
          </div>
        );
      }}
    />
  );
});
