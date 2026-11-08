import { Block, List, ListItem, Navbar } from "konsta/react";
import { downloadOptionalFont, type OptionalFontState } from "../lib/optionalFont";
import { ChevronLeft, Download, LoaderCircle, Check } from "lucide-react";
import { ShelfButton } from "./ShelfButton";
import { useLayoutEffect, useRef, type ReactNode } from "react";
import type { TranslationKey, TranslationVariables } from "../lib/i18n";

export function AppSettings({ optionalFontState, languageControl, onClose, onFeedback, t }: {
  optionalFontState: OptionalFontState;
  languageControl: ReactNode; onClose: () => void; onFeedback: () => void;
  t: (key: TranslationKey, variables?: TranslationVariables) => string;
}) {
  const backRef = useRef<HTMLButtonElement>(null);
  useLayoutEffect(() => { backRef.current?.focus({ preventScroll: true }); }, []);
  return <section className="app-settings">
    <Navbar title={t("appSettings")} left={<ShelfButton inline ref={backRef} onClick={onClose} aria-label={t("backToLibrary")}><ChevronLeft /></ShelfButton>} />
    <List strong inset><ListItem title={t("language")} after={languageControl} /></List>
    <Block className="optional-font-card">
      <h2>{t("extraFonts")}</h2>
      <p>{t("wenkaiFont")}</p><p className="optional-font-note">{t("fontDownloadNote")}</p>
      <p role="status" aria-live="polite">{optionalFontState === "ready" ? t("fontDownloaded") : ""}</p>
      {optionalFontState === "error" && <p role="alert">{t("fontDownloadFailed")}</p>}
      <ShelfButton aria-busy={optionalFontState === "downloading"} disabled={optionalFontState === "checking" || optionalFontState === "downloading" || optionalFontState === "ready"} onClick={() => void downloadOptionalFont()}>
        {optionalFontState === "downloading" || optionalFontState === "checking" ? <LoaderCircle className="spin" aria-hidden="true" /> : optionalFontState === "ready" ? <Check aria-hidden="true" /> : <Download aria-hidden="true" />}
        {t(optionalFontState === "downloading" ? "fontDownloading" : optionalFontState === "checking" ? "fontChecking" : optionalFontState === "ready" ? "fontDownloadedAction" : "downloadFont")}
      </ShelfButton>
      <a href={`${import.meta.env.BASE_URL}fonts/OFL-LXGWWenKai.txt`} target="_blank" rel="noreferrer">{t("fontLicense")}</a>
    </Block>
    <Block><h2>{t("privateTitle")}</h2><p>{t("privateNote")}</p><p>{t("storageRisk")}</p></Block>
    <Block><ShelfButton onClick={onFeedback}>{t("feedback")}</ShelfButton></Block>
  </section>;
}
