import {
  forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState,
} from "react";
import "foliate-js/paginator.js";
import {
  clampToVisibleOffset, findChapterIndex, visibleOverlaps,
  type TextChapter, type TextSourceModel,
} from "../lib/textDocument";
import {
  clearHighlightMarks, rangeForLocalOffset, sourceBounds, sourceElements,
  sourceOffsetFromDomRange, wrapSourceOverlap,
} from "../lib/textDom";
import { buildTextBookStyles, createTextBook, type TextBook } from "../lib/textBook";
import { TEXT_CONTENT_WIDTH } from "../lib/textDisplay";
import { WheelGesture, normalizedWheelDelta, shouldIgnoreWheel } from "../lib/wheelPager";
import type { ReaderPreferences } from "../types/library";
import type { TextMatch, TextViewHandle, TextViewProps } from "./textViewTypes";

interface TextPagedViewProps extends TextViewProps {
  onKeyDown: (event: KeyboardEvent) => void;
}

function rangeInDocument(document: Document, offset: number): Range | null {
  const elements = sourceElements(document);
  for (const element of elements) {
    const bounds = sourceBounds(element);
    if (!bounds || offset < bounds.start || offset >= bounds.end) continue;
    const local = offset - bounds.start;
    return rangeForLocalOffset(element, local, local) ?? null;
  }
  const last = elements[elements.length - 1];
  if (!last) return null;
  const bounds = sourceBounds(last);
  if (!bounds) return null;
  return rangeForLocalOffset(last, bounds.end - bounds.start, bounds.end - bounds.start) ?? null;
}

function chapterForOffset(model: TextSourceModel, offset: number): { chapter: TextChapter; index: number } | undefined {
  const index = Math.max(0, findChapterIndex(model.chapters, offset));
  const chapter = model.chapters[index];
  return chapter ? { chapter, index } : undefined;
}

function highlightDocument(document: Document, model: TextSourceModel, match?: TextMatch): void {
  clearHighlightMarks(document);
  if (!match) return;
  const elements = sourceElements(document);
  for (const overlap of visibleOverlaps(model, match.start, match.end)) {
    for (const element of elements) {
      const bounds = sourceBounds(element);
      if (!bounds || overlap.end <= bounds.start || overlap.start >= bounds.end) continue;
      wrapSourceOverlap(element, overlap.start, overlap.end);
    }
  }
}

function setLayoutAttribute(paginator: FoliatePaginatorElement, name: string, value: string): void {
  if (paginator.getAttribute(name) !== value) paginator.setAttribute(name, value);
}

function applyLayout(paginator: FoliatePaginatorElement, host: HTMLElement, preferences: ReaderPreferences): void {
  const compact = host.clientWidth <= 760;
  const margin = compact ? 34 : 52;
  setLayoutAttribute(paginator, "flow", "paginated");
  setLayoutAttribute(paginator, "gap", "5%");
  setLayoutAttribute(paginator, "margin", `${margin}px`);
  setLayoutAttribute(paginator, "max-column-count", "1");
  setLayoutAttribute(paginator, "max-block-size", `${Math.max(120, Math.round(host.clientHeight - margin * 2))}px`);
  setLayoutAttribute(paginator, "max-inline-size", `${TEXT_CONTENT_WIDTH[preferences.contentWidth]}px`);
}

export const TextPagedView = forwardRef<TextViewHandle, TextPagedViewProps>(function TextPagedView({
  model, preferences, initialOffset, activeMatch, onOffset, onReady, onKeyDown,
}, ref) {
  const hostRef = useRef<HTMLDivElement>(null);
  const paginatorRef = useRef<FoliatePaginatorElement | null>(null);
  const [paginator, setPaginator] = useState<FoliatePaginatorElement | null>(null);
  const [viewLoaded, setViewLoaded] = useState(false);
  const bookRef = useRef<TextBook | null>(null);
  const initialOffsetRef = useRef(clampToVisibleOffset(model, initialOffset));
  const lastOffsetRef = useRef(initialOffsetRef.current);
  const preferencesRef = useRef(preferences);
  const onOffsetRef = useRef(onOffset);
  const onReadyRef = useRef(onReady);
  const onKeyDownRef = useRef(onKeyDown);
  const activeMatchRef = useRef(activeMatch);
  const mountedRef = useRef(true);
  preferencesRef.current = preferences;
  onOffsetRef.current = onOffset;
  onReadyRef.current = onReady;
  onKeyDownRef.current = onKeyDown;
  activeMatchRef.current = activeMatch;

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const turningRef = useRef(false);
  const pendingGoToRef = useRef<number | undefined>(undefined);
  const turnRef = useRef<(direction: "previous" | "next") => void>(() => undefined);

  const performGoTo = useCallback((offset: number) => {
    lastOffsetRef.current = offset;
    const target = chapterForOffset(model, offset);
    const element = paginatorRef.current;
    if (!target || !element) return;
    void element.goTo({
      index: target.index,
      anchor: (document) => rangeInDocument(document, offset),
    }).catch(() => undefined);
  }, [model]);

  const goTo = useCallback((rawOffset: number) => {
    const offset = clampToVisibleOffset(model, rawOffset);
    if (turningRef.current) {
      pendingGoToRef.current = offset;
      return;
    }
    performGoTo(offset);
  }, [model, performGoTo]);

  const turn = useCallback((direction: "previous" | "next") => {
    const element = paginatorRef.current;
    if (!element || turningRef.current) return;
    turningRef.current = true;
    const promise = direction === "next" ? element.next() : element.prev();
    void promise.catch(() => undefined).finally(() => {
      turningRef.current = false;
      const pending = pendingGoToRef.current;
      pendingGoToRef.current = undefined;
      if (pending !== undefined) performGoTo(pending);
    });
  }, [performGoTo]);
  turnRef.current = turn;

  useImperativeHandle(ref, () => ({
    goTo,
    previous: () => turn("previous"),
    next: () => turn("next"),
  }), [goTo, turn]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const element = document.createElement("foliate-paginator");
    element.className = "text-paginator";
    element.setAttribute("flow", "paginated");
    applyLayout(element, host, preferencesRef.current);
    element.setStyles(buildTextBookStyles(preferencesRef.current));
    host.replaceChildren(element);
    paginatorRef.current = element;
    setViewLoaded(false);
    setPaginator(element);

    const book = createTextBook(model);
    bookRef.current = book;
    element.open(book);

    const gesture = new WheelGesture();
    const attachedDocuments = new WeakSet<Document>();
    let loaded = false;
    let ready = false;

    const handleWheel = (event: WheelEvent) => {
      if (shouldIgnoreWheel(event)) return;
      const delta = normalizedWheelDelta(event, host.clientHeight || window.innerHeight);
      if (!delta) return;
      event.preventDefault();
      const direction = gesture.push(delta, event.timeStamp);
      if (direction) turnRef.current(direction);
    };

    const handleKeyDown = (event: KeyboardEvent) => onKeyDownRef.current(event);

    const attachDocument = (document: Document) => {
      if (attachedDocuments.has(document)) return;
      attachedDocuments.add(document);
      document.addEventListener("wheel", handleWheel, { passive: false });
      document.addEventListener("keydown", handleKeyDown);
    };

    const handleLoad = (event: Event) => {
      if (!mountedRef.current) return;
      loaded = true;
      setViewLoaded(true);
      const detail = (event as CustomEvent<{ doc?: Document }>).detail;
      if (!detail?.doc) return;
      attachDocument(detail.doc);
      highlightDocument(detail.doc, model, activeMatchRef.current);
    };

    const handleRelocate = (event: Event) => {
      if (!mountedRef.current) return;
      const detail = (event as CustomEvent<{
        range?: Range;
        index?: number;
        fraction?: number;
      }>).detail;
      if (detail?.index === undefined) return;
      const chapter = model.chapters[detail.index];
      if (!chapter) return;
      let offset = detail.range ? sourceOffsetFromDomRange(detail.range) : undefined;
      if (offset === undefined) {
        offset = chapter.start + Math.round((detail.fraction ?? 0) * (chapter.end - chapter.start));
      }
      const normalized = clampToVisibleOffset(model, offset);
      lastOffsetRef.current = normalized;
      onOffsetRef.current(normalized, model.text.length > 0 ? normalized / model.text.length : 0);
      if (loaded && !ready) {
        ready = true;
        onReadyRef.current();
      }
    };

    host.addEventListener("wheel", handleWheel, { passive: false });
    element.addEventListener("load", handleLoad);
    element.addEventListener("relocate", handleRelocate);
    const initial = initialOffsetRef.current;
    const target = chapterForOffset(model, initial);
    if (target) {
      void element.goTo({
        index: target.index,
        anchor: (document) => rangeInDocument(document, initial),
      }).catch(() => undefined);
    }

    return () => {
      mountedRef.current = false;
      gesture.reset();
      host.removeEventListener("wheel", handleWheel);
      element.removeEventListener("load", handleLoad);
      element.removeEventListener("relocate", handleRelocate);
      try {
        element.destroy();
      } catch {
        // The paginator has no view to destroy before its first navigation.
      }
      book.destroy();
      host.replaceChildren();
      paginatorRef.current = null;
      bookRef.current = null;
      setViewLoaded(false);
      setPaginator((current) => current === element ? null : current);
    };
  }, [model]);

  useEffect(() => {
    if (!paginator || !viewLoaded) return;
    paginator.setStyles(buildTextBookStyles(preferences));
    setLayoutAttribute(paginator, "max-inline-size", `${TEXT_CONTENT_WIDTH[preferences.contentWidth]}px`);
  }, [paginator, preferences, viewLoaded]);

  useEffect(() => {
    if (!paginator || !viewLoaded) return;
    const host = hostRef.current;
    if (!host) return;
    const update = () => applyLayout(paginator, host, preferencesRef.current);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(host);
    return () => observer.disconnect();
  }, [paginator, viewLoaded]);

  useEffect(() => {
    const document = paginatorRef.current?.getContents()[0]?.doc;
    if (!document) return;
    highlightDocument(document, model, activeMatch);
  }, [activeMatch, model, paginator]);

  return <div className="text-paged-host" ref={hostRef} />;
});
