import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { TranslationKey, TranslationVariables } from "../lib/i18n";
import {
  buildTextSourceModel, clampToVisibleOffset, paragraphAtOffset,
} from "../lib/textDocument";
import { findTextMatches, throwIfSearchAborted } from "../lib/readerSearch";
import { decodeText } from "../lib/textDecode";
import { TEXT_CONTENT_WIDTH, textTypographyStyle } from "../lib/textDisplay";
import type { ReaderPreferences, ReadingLocator, ReadingProfile } from "../types/library";
import type {
  ReaderCapabilities, ReaderController, ReaderOutlineItem, ReaderSearchResult,
} from "../types/reader";
import { TextPagedView } from "./TextPagedView";
import { TextScrollView } from "./TextScrollView";
import type { TextMatch, TextViewHandle } from "./textViewTypes";
import type { ReaderContentInteraction } from "../lib/readerContentEvents";

interface TextReaderProps {
  onContentInteraction?: (event: ReaderContentInteraction) => void;
  layoutRevision?: string;
  readingProfile: ReadingProfile;
  file: Blob;
  locator?: ReadingLocator;
  preferences: ReaderPreferences;
  onProgress: (locator: ReadingLocator) => void;
  onOutline: (items: ReaderOutlineItem[], automatic?: boolean) => void;
  onCapabilities: (capabilities: ReaderCapabilities) => void;
  onCurrentTarget: (target?: string) => void;
  onKeyDown: (event: KeyboardEvent) => void;
  navigationRef: React.RefObject<ReaderController | null>;
  t: (key: TranslationKey, variables?: TranslationVariables) => string;
}

export function TextReader({
  layoutRevision, readingProfile, file, locator, preferences, onProgress, onOutline,
  onCapabilities, onCurrentTarget, onKeyDown, navigationRef, t, onContentInteraction,
}: TextReaderProps) {
  const scrollViewRef = useRef<TextViewHandle>(null);
  const pagedViewRef = useRef<TextViewHandle>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const initialLocatorRef = useRef(locator);
  const currentOffsetRef = useRef(locator?.type === "text" ? Number(locator.value) || 0 : 0);
  const pendingSaveRef = useRef<ReadingLocator | undefined>(undefined);
  const saveTimerRef = useRef(0);
  const [text, setText] = useState<string>();
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<TranslationKey>();
  const [activeMatch, setActiveMatch] = useState<TextMatch>();
  const paginated = readingProfile === "book";
  const model = useMemo(() => buildTextSourceModel(text ?? ""), [text]);
  const hasReadableText = model.paragraphs.length > 0;
  const activeProfileRef = useRef(readingProfile);
  activeProfileRef.current = readingProfile;

  useEffect(() => {
    let active = true;
    setText(undefined);
    setLoaded(false);
    setError(undefined);
    setActiveMatch(undefined);
    currentOffsetRef.current = initialLocatorRef.current?.type === "text"
      ? Number(initialLocatorRef.current.value) || 0
      : 0;
    pendingSaveRef.current = undefined;
    window.clearTimeout(saveTimerRef.current);
    void decodeText(file).then((value) => {
      if (!active) return;
      setText(value);
      setLoaded(true);
    }).catch(() => {
      if (!active) return;
      setError("textDecodeFailed");
      setLoaded(true);
    });
    return () => { active = false; };
  }, [file]);

  useEffect(() => {
    if (!loaded) return;
    onOutline(model.outline, model.outline.length > 0);
    return () => onOutline([]);
  }, [loaded, model, onOutline]);

  useEffect(() => {
    if (!loaded) return;
    onCapabilities({
      typography: true,
      outline: model.outline.length > 0,
      publisherFont: false,
      readingProfile: true,
      paginated,
      search: true,
    });
    return () => onCapabilities({
      typography: false,
      outline: false,
      publisherFont: false,
      readingProfile: false,
      paginated: false,
      search: false,
    });
  }, [loaded, model, onCapabilities, paginated]);

  useEffect(() => {
    if (!loaded) return;
    const offset = clampToVisibleOffset(model, currentOffsetRef.current);
    stageRef.current?.setAttribute("data-source-offset", String(offset));
  }, [loaded, model]);

  const reportOffset = useCallback((offset: number, progression: number) => {
    const normalized = clampToVisibleOffset(model, offset);
    const boundedProgression = Math.min(1, Math.max(0, progression));
    currentOffsetRef.current = normalized;
    stageRef.current?.setAttribute("data-source-offset", String(normalized));
    const paragraph = paragraphAtOffset(model, normalized);
    onCurrentTarget(paragraph ? String(paragraph.start) : undefined);
    const next: ReadingLocator = {
      type: "text",
      value: String(normalized),
      progression: boundedProgression,
      label: `${Math.round(boundedProgression * 100)}%`,
    };
    pendingSaveRef.current = next;
    window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => onProgress(next), 250);
  }, [model, onCurrentTarget, onProgress]);

  const rawScrollOffset = useCallback((offset: number, progression: number) => {
    if (activeProfileRef.current !== "article") return;
    reportOffset(offset, progression);
  }, [reportOffset]);

  const rawPagedOffset = useCallback((offset: number, progression: number) => {
    if (activeProfileRef.current !== "book") return;
    reportOffset(offset, progression);
  }, [reportOffset]);

  const markScrollReady = useCallback(() => {
    if (activeProfileRef.current !== "article") return;
    stageRef.current?.setAttribute("data-view-ready", "article");
  }, []);

  const markPagedReady = useCallback(() => {
    if (activeProfileRef.current !== "book") return;
    stageRef.current?.setAttribute("data-view-ready", "book");
  }, []);

  useLayoutEffect(() => {
    stageRef.current?.removeAttribute("data-view-ready");
  }, [file, readingProfile]);

  const navigateToOffset = useCallback((offset: number) => {
    const normalized = clampToVisibleOffset(model, offset);
    reportOffset(normalized, model.text.length > 0 ? normalized / model.text.length : 0);
    const view = activeProfileRef.current === "book" ? pagedViewRef.current : scrollViewRef.current;
    view?.goTo(normalized);
  }, [model, reportOffset]);

  useEffect(() => {
    navigationRef.current = {
      previous: () => {
        const view = activeProfileRef.current === "book" ? pagedViewRef.current : scrollViewRef.current;
        view?.previous();
      },
      next: () => {
        const view = activeProfileRef.current === "book" ? pagedViewRef.current : scrollViewRef.current;
        view?.next();
      },
      goTo: (target) => {
        const offset = Number(target);
        if (!Number.isFinite(offset)) return;
        setActiveMatch(undefined);
        navigateToOffset(offset);
      },
      search: async (query, options) => {
        setActiveMatch(undefined);
        throwIfSearchAborted(options.signal);
        const outcome = findTextMatches(model.text, query, {
          maxResults: options.maxResults,
          idPrefix: "text",
        });
        options.onProgress?.(1);
        throwIfSearchAborted(options.signal);
        return outcome;
      },
      goToSearch: (result: ReaderSearchResult) => {
        const start = Number(result.target);
        if (!Number.isFinite(start)) return;
        setActiveMatch({ start, end: start + result.excerpt.match.length });
        navigateToOffset(start);
      },
      clearSearch: () => setActiveMatch(undefined),
    };
    return () => { navigationRef.current = null; };
  }, [model.text, navigateToOffset, navigationRef]);

  useEffect(() => () => {
    window.clearTimeout(saveTimerRef.current);
    if (pendingSaveRef.current) onProgress(pendingSaveRef.current);
  }, [onProgress]);

  if (error) return <p className="reader-error">{t(error)}</p>;

  const typography = textTypographyStyle(preferences);
  return (
    <div
      ref={stageRef}
      className={`reader-stage text-stage text-stage-${paginated ? "paged" : "scroll"} theme-${preferences.theme}`}
      style={{
        "--text-content-width": `${TEXT_CONTENT_WIDTH[preferences.contentWidth]}px`,
        ...typography,
      } as React.CSSProperties}
    >
      {!loaded ? (
        <p className="text-status">{t("loadingText")}</p>
      ) : !hasReadableText ? (
        <p className="text-status">{t("emptyText")}</p>
      ) : paginated ? (
        <TextPagedView
          onContentInteraction={onContentInteraction}
          ref={pagedViewRef}
          model={model}
          preferences={preferences}
          initialOffset={clampToVisibleOffset(model, currentOffsetRef.current)}
          activeMatch={activeMatch}
          onOffset={rawPagedOffset}
          onReady={markPagedReady}
          onKeyDown={onKeyDown}
        />
      ) : (
        <TextScrollView
          onContentInteraction={onContentInteraction}
          ref={scrollViewRef}
          model={model}
          preferences={preferences}
          initialOffset={clampToVisibleOffset(model, currentOffsetRef.current)}
          activeMatch={activeMatch}
          layoutRevision={layoutRevision}
          onOffset={rawScrollOffset}
          onReady={markScrollReady}
        />
      )}
    </div>
  );
}
