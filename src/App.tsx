import { type ReactNode, lazy, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  BookOpen, ChevronLeft, ChevronRight,
  ListTree, MessageSquare, Rows3, Search, Settings2, Trash2, X,
} from "lucide-react";
import "./App.css";
import { Button, Dialog, Segmented, SegmentedButton } from "konsta/react";
import { flushSync } from "react-dom";
import { ShelfButton } from "./components/ShelfButton";
import { LibraryView } from "./components/LibraryView";
import { ReaderSheet } from "./components/ReaderSheet";
import { ReaderToolbar } from "./components/ReaderToolbar";
import { useOptionalFont } from "./hooks/useOptionalFont";
import { useReaderChrome } from "./hooks/useReaderChrome";
import { ReaderOutline } from "./components/ReaderOutline";
import { ReaderSearch } from "./components/ReaderSearch";
import { ReaderSettings } from "./components/ReaderSettings";
import { BookFormatError, detectBookFormat, displayTitle, isLegacyMarkdownRecord } from "./lib/formats";
import { fingerprintFile } from "./lib/fingerprint";
import { CoalescingWriteQueue } from "./lib/coalescingWriteQueue";
import { resolveLanguage, translate, type Language, type TranslationKey, type TranslationVariables } from "./lib/i18n";
import { handleReaderShortcut } from "./lib/readerShortcuts";
import {
  findByFingerprint, getBookFile, getPreferences, listBooks, removeBook,
  requestPersistentStorage, saveBook, savePreferences, updateLocator, updateReadingProfile,
} from "./lib/storage";
import type { BookRecord, ReaderPreferences, ReadingLocator, ReadingProfile } from "./types/library";
import { DEFAULT_PREFERENCES } from "./types/library";
import { TEXT_THEME_COLORS } from "./lib/textDisplay";
import type { ReaderCapabilities, ReaderController, ReaderOutlineItem } from "./types/reader";
import { NO_READER_CAPABILITIES } from "./types/reader";

const EpubReader = lazy(() => import("./readers/EpubReader").then((module) => ({ default: module.EpubReader })));
const PdfReader = lazy(() => import("./readers/PdfReader").then((module) => ({ default: module.PdfReader })));
const TextReader = lazy(() => import("./readers/TextReader").then((module) => ({ default: module.TextReader })));

const LANGUAGE_KEY = "webreader.language";

function ModalFrame({ children, className = "", labelledBy, locked = false, onClose }: {
  children: ReactNode;
  className?: string;
  labelledBy: string;
  locked?: boolean;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLElement>(null);
  const onCloseRef = useRef(onClose);
  const lockedRef = useRef(locked);
  onCloseRef.current = onClose;
  lockedRef.current = locked;

  useLayoutEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = dialogRef.current;
    const backdrop = dialog?.parentElement;
    const background = [...(backdrop?.parentElement?.children ?? [])]
      .filter((element): element is HTMLElement => element instanceof HTMLElement && element !== backdrop)
      .map((element) => ({ element, inert: element.inert, ariaHidden: element.getAttribute("aria-hidden") }));
    for (const { element } of background) {
      element.inert = true;
      element.setAttribute("aria-hidden", "true");
    }
    const focusable = () => [...(dialog?.querySelectorAll<HTMLElement>(
      "a[href], button:not(:disabled), textarea:not(:disabled), input:not(:disabled), select:not(:disabled), [tabindex]:not([tabindex='-1'])",
    ) ?? [])];
    (dialog?.querySelector<HTMLElement>("[data-autofocus]") ?? focusable()[0])?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !lockedRef.current) {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const controls = focusable();
      if (controls.length === 0) {
        event.preventDefault();
        return;
      }
      const first = controls[0]!;
      const last = controls[controls.length - 1]!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      for (const { element, inert, ariaHidden } of background) {
        element.inert = inert;
        if (ariaHidden === null) element.removeAttribute("aria-hidden");
        else element.setAttribute("aria-hidden", ariaHidden);
      }
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, []);

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.currentTarget === event.target && !locked) onClose();
    }}>
      <Dialog opened backdrop={false} ref={dialogRef} tabIndex={-1} className={`dialog ${className}`.trim()} role="dialog" aria-modal="true" aria-labelledby={labelledBy} aria-busy={locked || undefined}>
        {children}
      </Dialog>
    </div>
  );
}

function FeedbackDialog({ language, onClose }: {
  language: Language;
  onClose: () => void;
}) {
  const t = (key: TranslationKey) => translate(language, key);
  return (
    <ModalFrame className="feedback-dialog" labelledBy="feedback-title" onClose={onClose}>
      <div className="dialog-heading">
        <div className="dialog-icon feedback-icon"><MessageSquare /></div>
        <ShelfButton className="icon-button" type="button" onClick={onClose} aria-label={t("cancel")}><X /></ShelfButton>
      </div>
      <h2 id="feedback-title">{t("feedbackTitle")}</h2>
      <p>{t("feedbackHint")}</p>
      <div className="dialog-actions">
        <ShelfButton className="secondary-button" type="button" onClick={onClose}>{t("cancel")}</ShelfButton>
        <ShelfButton className="feedback-issues-link" href="https://github.com/perhydrol/WebReader/issues" role="link" target="_blank" rel="noopener noreferrer">{t("feedbackOpenIssues")}</ShelfButton>
      </div>
    </ModalFrame>
  );
}

function DeleteDialog({ book, t, onClose, onConfirm }: {
  book: BookRecord;
  t: (key: TranslationKey, variables?: TranslationVariables) => string;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}) {
  const [removing, setRemoving] = useState(false);
  const [failed, setFailed] = useState(false);
  const confirm = async () => {
    if (removing) return;
    setRemoving(true);
    setFailed(false);
    try {
      await onConfirm();
    } catch {
      setFailed(true);
      setRemoving(false);
    }
  };

  return (
    <ModalFrame labelledBy="delete-title" locked={removing} onClose={onClose}>
      <div className="dialog-icon"><Trash2 /></div>
      <h2 id="delete-title">{t("removeTitle")}</h2>
      <p>{t("removeDescription", { title: book.title })}</p>
      {failed && <p className="dialog-error" role="alert">{t("removeFailed")}</p>}
      <div className="dialog-actions">
        <ShelfButton data-autofocus className="secondary-button" type="button" onClick={onClose} disabled={removing}>{t("cancel")}</ShelfButton>
        <ShelfButton className="danger-button" type="button" onClick={() => void confirm()} disabled={removing}>{removing ? t("removing") : t("remove")}</ShelfButton>
      </div>
    </ModalFrame>
  );
}

export default function App() {
  const [language, setLanguage] = useState<Language>(() => resolveLanguage(localStorage.getItem(LANGUAGE_KEY)));
  const t = useCallback((key: TranslationKey, variables: TranslationVariables = {}) => translate(language, key, variables), [language]);
  const [books, setBooks] = useState<BookRecord[]>([]);
  const [activeBook, setActiveBook] = useState<BookRecord>();
  const [activeFile, setActiveFile] = useState<Blob>();
  const [preferences, setPreferences] = useState<ReaderPreferences>(DEFAULT_PREFERENCES);
  const [systemDark, setSystemDark] = useState(() => matchMedia("(prefers-color-scheme: dark)").matches);
  useEffect(() => {
    const media = matchMedia("(prefers-color-scheme: dark)");
    const update = () => setSystemDark(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  const optionalFontState = useOptionalFont();
  const readerPreferences = useMemo<ReaderPreferences>(() => ({ ...preferences,
    fontFamily: preferences.fontFamily === "wenkai" && optionalFontState !== "ready" ? "serif" : preferences.fontFamily,
    theme: preferences.followSystemTheme !== false ? systemDark ? "night" : "white" : preferences.theme }), [preferences, systemDark, optionalFontState]);
  const browserColor = activeBook && activeFile ? TEXT_THEME_COLORS[readerPreferences.theme].background : systemDark ? "#000000" : "#f7f8f5";
  const browserDark = activeBook && activeFile ? readerPreferences.theme === "night" : systemDark;
  useLayoutEffect(() => {
    const root = document.documentElement;
    const previousBackground = root.style.backgroundColor;
    const previousScheme = root.style.colorScheme;
    const colors = [...document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')]
      .map((meta) => ({ meta, content: meta.content }));
    root.style.backgroundColor = browserColor;
    root.style.colorScheme = browserDark ? "dark" : "light";
    for (const { meta } of colors) meta.content = browserColor;
    return () => {
      root.style.backgroundColor = previousBackground;
      root.style.colorScheme = previousScheme;
      for (const { meta, content } of colors) meta.content = content;
    };
  }, [browserColor, browserDark]);

  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [message, setMessage] = useState<string>();
  const [deleteTarget, setDeleteTarget] = useState<BookRecord>();
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [readerPanel, setReaderPanel] = useState<"outline" | "search" | "settings">();
  const [outline, setOutline] = useState<ReaderOutlineItem[]>([]);
  const [automaticOutline, setAutomaticOutline] = useState(false);
  const [currentTarget, setCurrentTarget] = useState<string>();
  const [readerLabel, setReaderLabel] = useState<string>();
  const [capabilities, setCapabilities] = useState<ReaderCapabilities>(NO_READER_CAPABILITIES);
  const [updateAction, setUpdateAction] = useState<(() => void) | undefined>();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const outlineButtonRef = useRef<HTMLButtonElement>(null);
  const searchButtonRef = useRef<HTMLButtonElement>(null);
  const settingsButtonRef = useRef<HTMLButtonElement>(null);
  const navigationRef = useRef<ReaderController | null>(null);
  const profileWriteRef = useRef(Promise.resolve());
  const readingProfileRef = useRef(new Map<string, ReadingProfile>());
  const tRef = useRef(t);
  tRef.current = t;
  const progressWriteRef = useRef<CoalescingWriteQueue<string, ReadingLocator> | null>(null);
  const preferenceWriteRef = useRef<CoalescingWriteQueue<"preferences", ReaderPreferences> | null>(null);
  if (!progressWriteRef.current) {
    const reportFailure = () => setMessage(tRef.current("storageUnavailable"));
    progressWriteRef.current = new CoalescingWriteQueue(updateLocator, reportFailure);
    preferenceWriteRef.current = new CoalescingWriteQueue((_key, next) => savePreferences(next), reportFailure);
  }
  const shortcutActionsRef = useRef<{
    previous: () => void;
    next: () => void;
    decreaseText: () => void;
    increaseText: () => void;
    toggleOutline: () => void;
    openSearch: () => void;
    closePanel: () => void;
    typography: boolean;
  }>({
    previous: () => undefined,
    next: () => undefined,
    decreaseText: () => undefined,
    increaseText: () => undefined,
    toggleOutline: () => undefined,
    openSearch: () => undefined,
    closePanel: () => undefined,
    typography: false,
  });

  const refreshBooks = useCallback(async () => {
    const storedBooks = await listBooks();
    for (const book of storedBooks) readingProfileRef.current.set(book.id, book.readingProfile);
    setBooks(storedBooks);
  }, []);

  useEffect(() => {
    localStorage.setItem(LANGUAGE_KEY, language);
    document.documentElement.lang = language === "zh" ? "zh-CN" : "en";
    document.title = t("pageTitle");
  }, [language, t]);

  useEffect(() => {
    const handleUpdate = (event: Event) => {
      const activate = (event as CustomEvent<() => Promise<void>>).detail;
      setUpdateAction(() => () => void activate());
    };
    window.addEventListener("webreader-update-available", handleUpdate);
    return () => window.removeEventListener("webreader-update-available", handleUpdate);
  }, []);

  useEffect(() => {
    void Promise.all([listBooks(), getPreferences()]).then(([storedBooks, storedPreferences]) => {
      for (const book of storedBooks) readingProfileRef.current.set(book.id, book.readingProfile);
      setBooks(storedBooks);
      setPreferences(storedPreferences);
    }).catch(() => setMessage(t("storageUnavailable")));
    void requestPersistentStorage();
  }, [t]);

  useEffect(() => {
    const flushWrites = () => {
      void Promise.all([
        progressWriteRef.current?.flush(),
        preferenceWriteRef.current?.flush(),
        profileWriteRef.current,
      ]);
    };
    const handleVisibility = () => { if (document.visibilityState === "hidden") flushWrites(); };
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("pagehide", flushWrites);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("pagehide", flushWrites);
      flushWrites();
    };
  }, []);

  const importFiles = useCallback(async (files: File[]) => {
    if (files.length === 0) return;
    setBusy(true);
    setMessage(undefined);
    let imported = 0;
    let skipped = 0;
    let lastError: string | undefined;
    try {
      for (const file of files) {
        try {
          const format = await detectBookFormat(file);
          const fingerprint = await fingerprintFile(file);
          const existing = await findByFingerprint(fingerprint);
          if (existing) {
            skipped += 1;
            lastError = t("duplicateBook", { title: existing.title });
            continue;
          }
          const now = Date.now();
          const book: BookRecord = {
            id: crypto.randomUUID(),
            fingerprint,
            title: displayTitle(file.name),
            format,
            readingProfile: "book",
            fileName: file.name,
            mediaType: file.type || (format === "txt" ? "text/plain" : `application/${format}`),
            size: file.size,
            addedAt: now,
            updatedAt: now,
          };
          await saveBook(book, file);
          readingProfileRef.current.set(book.id, book.readingProfile);
          imported += 1;
        } catch (error) {
          skipped += 1;
          lastError = error instanceof BookFormatError ? t(error.translationKey) : t("importFailed");
        }
      }
      if (imported > 0) await refreshBooks();
      if (imported > 0 && skipped > 0) setMessage(t("importedWithSkipped", { imported, skipped }));
      else if (imported > 0) setMessage(imported === 1 ? t("importedOne") : t("importedMany", { count: imported }));
      else if (lastError) setMessage(lastError);
    } finally {
      setBusy(false);
      setDragging(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, [refreshBooks, t]);

  const openBook = useCallback(async (book: BookRecord) => {
    setMessage(undefined);
    if (isLegacyMarkdownRecord(book)) {
      setMessage(t("markdownUnsupported"));
      return;
    }
    const currentBook = {
      ...book,
      readingProfile: readingProfileRef.current.get(book.id) ?? book.readingProfile,
    };
    setReaderPanel(undefined);
    setOutline([]);
    setAutomaticOutline(false);
    setCurrentTarget(undefined);
    setReaderLabel(currentBook.locator?.label);
    setCapabilities(NO_READER_CAPABILITIES);
    try {
      const file = await getBookFile(currentBook.id);
      setActiveFile(file);
      setActiveBook(currentBook);
    } catch {
      setMessage(t("openFailed"));
    }
  }, [t]);

  const closeReader = useCallback(async () => {
    setActiveBook(undefined);
    setActiveFile(undefined);
    setReaderPanel(undefined);
    setOutline([]);
    setReaderLabel(undefined);
    setCapabilities(NO_READER_CAPABILITIES);
    await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
    await Promise.all([
      progressWriteRef.current?.flush(),
      preferenceWriteRef.current?.flush(),
      profileWriteRef.current,
    ]);
    await refreshBooks();
  }, [refreshBooks]);

  const activeBookId = activeBook?.id;
  const chrome = useReaderChrome(activeBookId, activeBook?.format === "txt", Boolean(readerPanel));
  const openPanel = (panel: "outline" | "search" | "settings") => {
    if (panel === "search") navigationRef.current?.clearSearch?.();
    flushSync(() => setReaderPanel(panel));
    if (panel === "search") document.getElementById("reader-search-input")?.focus({ preventScroll: true });
  };
  const handleProgress = useCallback((locator: ReadingLocator) => {
    if (!activeBookId) return;
    setReaderLabel(locator.label);
    progressWriteRef.current?.enqueue(activeBookId, locator);
    setActiveBook((current) => current?.id === activeBookId ? { ...current, locator } : current);
  }, [activeBookId]);

  const updatePreferences = useCallback((next: ReaderPreferences) => {
    setPreferences(next);
    preferenceWriteRef.current?.enqueue("preferences", next);
  }, []);

  const adjustTextSize = useCallback((delta: number) => {
    setPreferences((current) => {
      const next = {
        ...current,
        fontSizePercent: Math.min(200, Math.max(80, current.fontSizePercent + delta)),
      };
      preferenceWriteRef.current?.enqueue("preferences", next);
      return next;
    });
  }, []);

  const handleOutline = useCallback((items: ReaderOutlineItem[], automatic = false) => {
    setOutline(items);
    setAutomaticOutline(automatic);
  }, []);
  const handleCapabilities = useCallback((next: ReaderCapabilities) => setCapabilities(next), []);
  const handleCurrentTarget = useCallback((target?: string) => setCurrentTarget(target), []);
  const handleLocationLabel = useCallback((label?: string) => setReaderLabel(label), []);
  const handleReaderKeyDown = useCallback((event: KeyboardEvent) => {
    handleReaderShortcut(event, shortcutActionsRef.current);
  }, []);

  shortcutActionsRef.current = {
    previous: () => navigationRef.current?.previous(),
    next: () => navigationRef.current?.next(),
    decreaseText: () => adjustTextSize(-10),
    increaseText: () => adjustTextSize(10),
    toggleOutline: () => {
      if (capabilities.outline) setReaderPanel((current) => current === "outline" ? undefined : "outline");
    },
    openSearch: () => {
      if (capabilities.search) setReaderPanel("search");
    },
    closePanel: () => setReaderPanel(undefined),
    typography: capabilities.typography,
  };

  useEffect(() => {
    if (!activeBook) return;
    document.addEventListener("keydown", handleReaderKeyDown);
    return () => document.removeEventListener("keydown", handleReaderKeyDown);
  }, [activeBook, handleReaderKeyDown]);

  const confirmDelete = useCallback(async () => {
    if (!deleteTarget) return;
    await removeBook(deleteTarget.id);
    setDeleteTarget(undefined);
    await refreshBooks();
  }, [deleteTarget, refreshBooks]);

  const changeReadingProfile = useCallback((book: BookRecord, readingProfile: ReadingProfile) => {
    readingProfileRef.current.set(book.id, readingProfile);
    setBooks((current) => current.map((item) => item.id === book.id ? { ...item, readingProfile } : item));
    setActiveBook((current) => current?.id === book.id ? { ...current, readingProfile } : current);
    profileWriteRef.current = profileWriteRef.current
      .then(() => updateReadingProfile(book.id, readingProfile))
      .catch(() => {
        setMessage(tRef.current("storageUnavailable"));
        return refreshBooks();
      });
  }, [refreshBooks]);

  const languageControl = (
    <Segmented strong className="app-language-switch" role="group" aria-label={t("language")}>
      <SegmentedButton type="button" active={language === "zh"} aria-pressed={language === "zh"} onClick={() => setLanguage("zh")}>中</SegmentedButton>
      <SegmentedButton type="button" active={language === "en"} aria-pressed={language === "en"} onClick={() => setLanguage("en")}>EN</SegmentedButton>
    </Segmented>
  );

  if (activeBook && activeFile) {
    return (
      <main className={`reader-shell theme-${readerPreferences.theme} ${readerPreferences.theme === "night" ? "dark" : ""} ${readerPanel ? "panel-open" : ""}`}>
        <button className="chrome-reveal" type="button" onClick={chrome.show}>{language === "zh" ? "显示阅读工具栏" : "Show reading toolbar"}</button>
        <ReaderToolbar hidden={chrome.hidden} panelOpen={Boolean(readerPanel)} onLock={chrome.lock}>
          <div className="reader-leading-controls">
            <Button clear className="icon-button" type="button" onClick={() => void closeReader()} title={t("backToLibrary")} aria-label={t("backToLibrary")}>
              <ChevronLeft />
            </Button>
            <Button clear
              ref={outlineButtonRef}
              className={`icon-button ${readerPanel === "outline" ? "active" : ""}`}
              type="button"
              title={t("tableOfContents")}
              aria-label={t("tableOfContents")}
              aria-expanded={readerPanel === "outline"}
              disabled={!capabilities.outline}
              onClick={() => openPanel("outline")}
            >
              <ListTree />
            </Button>
            <Button clear
              ref={searchButtonRef}
              className={`icon-button ${readerPanel === "search" ? "active" : ""}`}
              type="button"
              title={t("searchBook")}
              aria-label={t("searchBook")}
              aria-expanded={readerPanel === "search"}
              disabled={!capabilities.search}
              onClick={() => openPanel("search")}
            >
              <Search />
            </Button>
          </div>
          <div className="reader-controls">
            <Button clear
              ref={settingsButtonRef}
              className={`icon-button ${readerPanel === "settings" ? "active" : ""}`}
              type="button"
              title={t("readerSettings")}
              aria-label={t("readerSettings")}
              aria-expanded={readerPanel === "settings"}
              onClick={() => openPanel("settings")}
            >
              <Settings2 />
            </Button>
          </div>
        </ReaderToolbar>
        <div className="reader-workspace">
          {readerPanel === "outline" && (
            <ReaderSheet label={t("tableOfContents")} onClose={() => setReaderPanel(undefined)}>
            <div className="reader-title"><strong>{activeBook.title}</strong><span>{readerLabel}</span></div>
            <ReaderOutline
              items={outline}
              currentTarget={currentTarget}
              automatic={automaticOutline}
              onNavigate={(target) => {
                navigationRef.current?.clearSearch?.();
                navigationRef.current?.goTo?.(target);
                setReaderPanel(undefined);
              }}
              onClose={() => setReaderPanel(undefined)}
              t={t}
            />
            </ReaderSheet>
          )}
          {readerPanel === "search" && (
            <ReaderSheet label={t("searchBook")} onClose={() => setReaderPanel(undefined)}>
            <ReaderSearch
              controllerRef={navigationRef}
              onClose={() => setReaderPanel(undefined)}
              t={t}
            />
            </ReaderSheet>
          )}
          <section className="reading-surface" tabIndex={-1} aria-hidden={readerPanel ? true : undefined} inert={readerPanel ? true : undefined}>
            <Suspense fallback={<div className="reader-loading">{t("preparingBook")}</div>}>
              {activeBook.format === "epub" && (
                <EpubReader
                  readingProfile={activeBook.readingProfile}
                  file={activeFile}
                  locator={activeBook.locator}
                  preferences={readerPreferences}
                  onProgress={handleProgress}
                  onOutline={handleOutline}
                  onCapabilities={handleCapabilities}
                  onCurrentTarget={handleCurrentTarget}
                  onLocationLabel={handleLocationLabel}
                  onKeyDown={handleReaderKeyDown}
                  navigationRef={navigationRef}
                  t={t}
                />
              )}
              {activeBook.format === "pdf" && (
                <PdfReader
                  readingProfile={activeBook.readingProfile}
                  file={activeFile}
                  locator={activeBook.locator}
                  preferences={readerPreferences}
                  onProgress={handleProgress}
                  onOutline={handleOutline}
                  onCapabilities={handleCapabilities}
                  onCurrentTarget={handleCurrentTarget}
                  navigationRef={navigationRef}
                  t={t}
                />
              )}
              {activeBook.format === "txt" && (
                <TextReader
                  key={activeBook.id}
                  onContentInteraction={chrome.onContentInteraction}
                  readingProfile={activeBook.readingProfile}
                  file={activeFile}
                  locator={activeBook.locator}
                  preferences={readerPreferences}
                  onProgress={handleProgress}
                  onOutline={handleOutline}
                  onCapabilities={handleCapabilities}
                  onCurrentTarget={handleCurrentTarget}
                  onKeyDown={handleReaderKeyDown}
                  navigationRef={navigationRef}
                  t={t}
                />
              )}
            </Suspense>
            {capabilities.paginated && (
              <>
                <button className="page-turn page-turn-left" type="button" onClick={() => navigationRef.current?.previous()} aria-label={t("previousPage")}><ChevronLeft /></button>
                <button className="page-turn page-turn-right" type="button" onClick={() => navigationRef.current?.next()} aria-label={t("nextPage")}><ChevronRight /></button>
              </>
            )}
          </section>
          {readerPanel === "settings" && (
            <ReaderSheet label={t("readerSettings")} onClose={() => setReaderPanel(undefined)}>
            <ReaderSettings
              optionalFontReady={optionalFontState === "ready"}
              readingModeControl={capabilities.readingProfile && (
              <Segmented strong className="reading-mode-switch" role="group" aria-label={t("readingMode")}>
                <SegmentedButton
                  type="button"
                  active={activeBook.readingProfile === "book"} aria-pressed={activeBook.readingProfile === "book"}
                  title={t("pagedMode")}
                  onClick={() => changeReadingProfile(activeBook, "book")}
                ><BookOpen /><span>{t("pagedMode")}</span></SegmentedButton>
                <SegmentedButton
                  type="button"
                  active={activeBook.readingProfile === "article"} aria-pressed={activeBook.readingProfile === "article"}
                  title={t("scrollMode")}
                  onClick={() => changeReadingProfile(activeBook, "article")}
                ><Rows3 /><span>{t("scrollMode")}</span></SegmentedButton>
              </Segmented>
            )}
              language={language}
              preferences={preferences}
              typography={capabilities.typography}
              publisherFont={capabilities.publisherFont}
              onLanguageChange={setLanguage}
              onChange={updatePreferences}
              onClose={() => setReaderPanel(undefined)}
              t={t}
            />
            </ReaderSheet>
          )}
        </div>
      </main>
    );
  }

  return (
    <LibraryView optionalFontState={optionalFontState} books={books} language={language} languageControl={languageControl} busy={busy}
      dragging={dragging} setDragging={setDragging} fileInputRef={fileInputRef} importFiles={importFiles}
      openBook={openBook} setDeleteTarget={setDeleteTarget} setFeedbackOpen={setFeedbackOpen}
      message={message} setMessage={setMessage} updateAction={updateAction} t={t}>

      {deleteTarget && (
        <DeleteDialog
          book={deleteTarget}
          t={t}
          onClose={() => setDeleteTarget(undefined)}
          onConfirm={confirmDelete}
        />
      )}

      {feedbackOpen && <FeedbackDialog language={language} onClose={() => setFeedbackOpen(false)} />}
    </LibraryView>
  );
}
