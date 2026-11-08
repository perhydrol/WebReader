import { Block, List, ListItem, Navbar } from "konsta/react";
import { ChevronLeft } from "lucide-react";
import { ShelfButton } from "./ShelfButton";
import { useLayoutEffect, useRef, type ReactNode } from "react";
import type { TranslationKey, TranslationVariables } from "../lib/i18n";

export function AppSettings({ languageControl, onClose, onFeedback, t }: {
  languageControl: ReactNode; onClose: () => void; onFeedback: () => void;
  t: (key: TranslationKey, variables?: TranslationVariables) => string;
}) {
  const backRef = useRef<HTMLButtonElement>(null);
  useLayoutEffect(() => { backRef.current?.focus({ preventScroll: true }); }, []);
  return <section className="app-settings">
    <Navbar title={t("appSettings")} left={<ShelfButton inline ref={backRef} onClick={onClose} aria-label={t("backToLibrary")}><ChevronLeft /></ShelfButton>} />
    <List strong inset><ListItem title={t("language")} after={languageControl} /></List>
    <Block><h2>{t("privateTitle")}</h2><p>{t("privateNote")}</p><p>{t("storageRisk")}</p></Block>
    <Block><ShelfButton onClick={onFeedback}>{t("feedback")}</ShelfButton></Block>
  </section>;
}
