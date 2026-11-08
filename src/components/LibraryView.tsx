import { useEffect, useRef, useState, type ReactNode } from "react";
import { Block, Card, Navbar } from "konsta/react";
import { BookOpen, FileText, Import, Library, MessageSquare, Plus, Settings2, Trash2, X } from "lucide-react";
import type { BookRecord } from "../types/library";
import type { Language, TranslationKey, TranslationVariables } from "../lib/i18n";
import { formatBytes, isLegacyMarkdownRecord } from "../lib/formats";
import { ShelfButton } from "./ShelfButton";
import type { OptionalFontState } from "../lib/optionalFont";
import { AppSettings } from "./AppSettings";

function formatDate(timestamp: number, language: Language): string {
  return new Intl.DateTimeFormat(language === "zh" ? "zh-CN" : "en", { month: "short", day: "numeric", year: "numeric" })
    .format(timestamp);
}

function formatLabel(format: BookRecord["format"]): string {
  return format === "txt" ? "TEXT" : format.toUpperCase();
}


export function LibraryView({ optionalFontState, books, language, languageControl, busy, dragging, setDragging, fileInputRef, importFiles, openBook, setDeleteTarget, setFeedbackOpen, message, setMessage, updateAction, children, t }: {
  optionalFontState: OptionalFontState;
  books: BookRecord[]; language: Language; languageControl: ReactNode; busy: boolean; dragging: boolean;
  setDragging: (value: boolean) => void; fileInputRef: React.RefObject<HTMLInputElement | null>;
  importFiles: (files: File[]) => Promise<void>; openBook: (book: BookRecord) => Promise<void>;
  setDeleteTarget: (book: BookRecord) => void; setFeedbackOpen: (open: boolean) => void;
  message?: string; setMessage: (message: string | undefined) => void; updateAction?: () => void;
  children: ReactNode; t: (key: TranslationKey, variables?: TranslationVariables) => string;
}) {
  const [settings, setSettings] = useState(false);
  const [dark, setDark] = useState(() => matchMedia("(prefers-color-scheme: dark)").matches);
  useEffect(() => {
    const media = matchMedia("(prefers-color-scheme: dark)");
    const update = () => setDark(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  const settingsRef = useRef<HTMLButtonElement>(null);
  const continuing = books.find((book) => book.locator && !isLegacyMarkdownRecord(book));
  return (
    <main className={`library-shell ${dark ? "dark" : ""}`}>
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark"><BookOpen /></span><span>WebReader</span></div>
        <nav aria-label={t("librarySections")}>
          <ShelfButton className="nav-item active" type="button"><Library />{t("library")} <span>{books.length}</span></ShelfButton>
        </nav>
        <div className="sidebar-actions">
          <ShelfButton inline ref={settingsRef} aria-label={t("appSettings")} onClick={() => setSettings(true)}><Settings2 /></ShelfButton>
          {!settings && <ShelfButton className="feedback-button" type="button" onClick={() => setFeedbackOpen(true)}><MessageSquare />{t("feedback")}</ShelfButton>}
        </div>
        <div className="privacy-note">
          <strong>{t("privateTitle")}</strong>
          <span>{t("privateNote")}</span>
        </div>
      </aside>

      <section className="library-main" hidden={settings}>
        <header className="library-header">
          <Navbar className="library-navbar" title={<h1>{t("yourBooks")}</h1>} />
          <input
            ref={fileInputRef}
            className="visually-hidden"
            type="file"
            accept=".epub,.pdf,.txt,application/epub+zip,application/pdf,text/plain"
            multiple
            disabled={busy}
            onChange={(event) => void importFiles(Array.from(event.target.files ?? []))}
          />
        </header>

        {message && <div className="notice" role="status"><span>{message}</span><ShelfButton type="button" onClick={() => setMessage(undefined)} aria-label={t("dismiss")}><X /></ShelfButton></div>}
        {updateAction && (
          <div className="notice update-notice" role="status">
            <span>{t("updateReady")}</span>
            <ShelfButton className="notice-action" type="button" onClick={updateAction}>{t("update")}</ShelfButton>
          </div>
        )}

        <ShelfButton outline
          className={`drop-zone ${dragging ? "dragging" : ""}`}
          type="button"
          disabled={busy}
          aria-busy={busy}
          onClick={() => fileInputRef.current?.click()}
          onDragEnter={(event) => { event.preventDefault(); setDragging(true); }}
          onDragOver={(event) => event.preventDefault()}
          onDragLeave={(event) => {
            const nextTarget = event.relatedTarget;
            if (!(nextTarget instanceof Node) || !event.currentTarget.contains(nextTarget)) setDragging(false);
          }}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            void importFiles(Array.from(event.dataTransfer.files));
          }}
        >
          <Import />
          <span>{busy ? t("importing") : t("dropBooks")}</span>
          <small>{t("maxFileSize")}</small>
        </ShelfButton>

        {continuing && <Card className="continue-reading"><strong>{t("continueReading")}</strong><ShelfButton onClick={() => void openBook(continuing)}>{continuing.title} · {Math.round((continuing.locator?.progression ?? 0) * 100)}%</ShelfButton></Card>}
        {books.length === 0 ? (
          <Block className="empty-state">
            <div className="empty-icon"><BookOpen /></div>
            <h2>{t("shelfEmpty")}</h2>
            <p>{t("shelfEmptyText")}</p>
            <ShelfButton className="secondary-button" type="button" onClick={() => fileInputRef.current?.click()} disabled={busy}>
              <Plus />{busy ? t("importing") : t("chooseFiles")}
            </ShelfButton>
          </Block>
        ) : (
          <section className="book-grid" aria-label={t("books")}>
            {books.map((book) => {
              const percent = Math.round((book.locator?.progression ?? 0) * 100);
              return (
                <Card component="article" className="book-card" key={book.id}>
                  <ShelfButton clear className="book-open" type="button" onClick={() => void openBook(book)} aria-label={t("openBook", { title: book.title })}>
                    <div className={`book-cover cover-${book.format}`}>
                      {book.format === "pdf" ? <FileText /> : <BookOpen />}
                      <span>{formatLabel(book.format)}</span>
                    </div>
                    <div className="book-info">
                      <strong title={book.title}>{book.title}</strong>
                      <span>{book.author ?? book.fileName}</span>
                      <div className="progress-track"><i style={{ width: `${percent}%` }} /></div>
                      <small>{book.locator ? t("percentRead", { percent }) : t("addedOn", { date: formatDate(book.addedAt, language) })} · {formatBytes(book.size)}</small>
                    </div>
                  </ShelfButton>
                  <ShelfButton className="card-menu" type="button" title={t("removeBook", { title: book.title })} aria-label={t("removeBook", { title: book.title })} onClick={() => setDeleteTarget(book)}><Trash2 /></ShelfButton>
                </Card>
              );
            })}
          </section>
        )}
      </section>

      {settings && <AppSettings optionalFontState={optionalFontState} languageControl={languageControl} onClose={() => { setSettings(false); requestAnimationFrame(() => settingsRef.current?.focus({ preventScroll: true })); }} onFeedback={() => setFeedbackOpen(true)} t={t} />}
      {children}
    </main>
  );
}
