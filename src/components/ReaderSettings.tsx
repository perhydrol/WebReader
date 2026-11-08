import { Button, Range, Segmented, SegmentedButton } from "konsta/react";
import { Minus, Plus, Settings2, X } from "lucide-react";
import type { Language, TranslationKey, TranslationVariables } from "../lib/i18n";
import type { ReaderPreferences } from "../types/library";
import type { ReactNode } from "react";

interface ReaderSettingsProps {
  optionalFontReady: boolean;
  readingModeControl?: ReactNode;
  language: Language;
  preferences: ReaderPreferences;
  onLanguageChange: (language: Language) => void;
  onChange: (next: ReaderPreferences) => void;
  onClose: () => void;
  typography: boolean;
  publisherFont: boolean;
  t: (key: TranslationKey, variables?: TranslationVariables) => string;
}

const fontOptions: Array<{ value: ReaderPreferences["fontFamily"]; label: TranslationKey }> = [
  { value: "publisher", label: "publisherFont" },
  { value: "serif", label: "serifFont" },
  { value: "sans", label: "sansFont" },
];
const lineOptions: Array<{ value: ReaderPreferences["lineHeight"]; label: TranslationKey }> = [
  { value: 1.4, label: "compact" },
  { value: 1.65, label: "standard" },
  { value: 1.9, label: "relaxed" },
];
const themes: Array<{ value: ReaderPreferences["theme"]; label: TranslationKey }> = [
  { value: "white", label: "whiteTheme" },
  { value: "paper", label: "paperTheme" },
  { value: "night", label: "nightTheme" },
  { value: "contrast", label: "contrastTheme" },
];
const widths: Array<{ value: ReaderPreferences["contentWidth"]; label: TranslationKey }> = [
  { value: "narrow", label: "narrow" },
  { value: "standard", label: "standard" },
  { value: "wide", label: "wide" },
];

export function ReaderSettings({ optionalFontReady, language, preferences, onLanguageChange, onChange, onClose, typography, publisherFont, t, readingModeControl }: ReaderSettingsProps) {
  const visibleFontOptions = publisherFont ? fontOptions : fontOptions.filter((option) => option.value !== "publisher");
  const selectedFont = publisherFont || preferences.fontFamily !== "publisher" ? preferences.fontFamily : "serif";
  const update = <Key extends keyof ReaderPreferences>(key: Key, value: ReaderPreferences[Key]) => {
    onChange({ ...preferences, [key]: value });
  };
  const resize = (delta: number) => update("fontSizePercent", Math.min(200, Math.max(80, preferences.fontSizePercent + delta)));

  return (
    <aside className="reader-panel settings-panel" aria-label={t("readerSettings")}>
      <header className="reader-panel-header">
        <div><Settings2 /><strong>{t("readerSettings")}</strong></div>
        <Button clear className="icon-button" type="button" onClick={onClose} aria-label={t("closeSettings")}><X /></Button>
      </header>

      {readingModeControl && <section className="setting-group mode-setting-group">{readingModeControl}</section>}

      <section className="setting-group">
        <span className="setting-label">{t("language")}</span>
        <Segmented strong role="group" aria-label={t("language")}>
          <SegmentedButton type="button" className={language === "zh" ? "active" : ""} active={language === "zh"} aria-pressed={language === "zh"} onClick={() => onLanguageChange("zh")}>中</SegmentedButton>
          <SegmentedButton type="button" className={language === "en" ? "active" : ""} active={language === "en"} aria-pressed={language === "en"} onClick={() => onLanguageChange("en")}>EN</SegmentedButton>
        </Segmented>
      </section>

      {typography && (
        <>
          <section className="setting-group">
            <label className="setting-label" htmlFor="reader-text-size">{t("textSize")}</label>
            <div className="font-size-control">
              <Button clear className="icon-button" type="button" onClick={() => resize(-10)} disabled={preferences.fontSizePercent <= 80} aria-label={t("decreaseTextSize")}><Minus /></Button>
              <output>{preferences.fontSizePercent}%</output>
              <Button clear className="icon-button" type="button" onClick={() => resize(10)} disabled={preferences.fontSizePercent >= 200} aria-label={t("increaseTextSize")}><Plus /></Button>
            </div>
            <Range colors={{ valueBgIos: "bg-zinc-700 dark:bg-zinc-300" }} inputId="reader-text-size" min={80} max={200} step={10} value={preferences.fontSizePercent} onChange={(event) => update("fontSizePercent", Number((event.target as HTMLInputElement).value))} />
          </section>

          <label className="setting-group">
            <span className="setting-label">{t("fontFamily")}</span>
            <select value={selectedFont} onChange={(event) => update("fontFamily", event.target.value as ReaderPreferences["fontFamily"])}>
              {optionalFontReady && <option value="wenkai">{t("wenkaiFont")}</option>}
              {visibleFontOptions.map((option) => <option key={option.value} value={option.value}>{t(option.label)}</option>)}
            </select>
          </label>

          <section className="setting-group">
            <span className="setting-label">{t("lineHeight")}</span>
            <Segmented strong>
              {lineOptions.map((option) => (
                <SegmentedButton key={option.value} type="button" className={preferences.lineHeight === option.value ? "active" : ""} active={preferences.lineHeight === option.value} aria-pressed={preferences.lineHeight === option.value} onClick={() => update("lineHeight", option.value)}>{t(option.label)}</SegmentedButton>
              ))}
            </Segmented>
          </section>

          <section className="setting-group">
            <span className="setting-label">{t("paragraphIndent")}</span>
            <Segmented strong>
              <SegmentedButton type="button" className={preferences.paragraphIndent === 0 ? "active" : ""} active={preferences.paragraphIndent === 0} aria-pressed={preferences.paragraphIndent === 0} onClick={() => update("paragraphIndent", 0)}>{t("noIndent")}</SegmentedButton>
              <SegmentedButton type="button" className={preferences.paragraphIndent === 2 ? "active" : ""} active={preferences.paragraphIndent === 2} aria-pressed={preferences.paragraphIndent === 2} onClick={() => update("paragraphIndent", 2)}>{t("twoCharacterIndent")}</SegmentedButton>
            </Segmented>
          </section>
        </>
      )}

      <section className="setting-group">
        <span className="setting-label">{t("background")}</span>
        <div className="theme-options">
          <Button clear className="theme-option system-theme-option" aria-pressed={preferences.followSystemTheme !== false}
            onClick={() => onChange({ ...preferences, followSystemTheme: true })}>{t("systemTheme")}</Button>
          {themes.map((theme) => (
            <Button clear key={theme.value} type="button" className={`theme-option theme-swatch-${theme.value}`} aria-pressed={preferences.followSystemTheme === false && preferences.theme === theme.value} onClick={() => onChange({ ...preferences, theme: theme.value, followSystemTheme: false })}>
              <i aria-hidden="true" /><span>{t(theme.label)}</span>
            </Button>
          ))}
        </div>
      </section>

      {typography && (
        <section className="setting-group">
          <span className="setting-label">{t("contentWidth")}</span>
          <Segmented strong>
            {widths.map((option) => (
              <SegmentedButton key={option.value} type="button" className={preferences.contentWidth === option.value ? "active" : ""} active={preferences.contentWidth === option.value} aria-pressed={preferences.contentWidth === option.value} onClick={() => update("contentWidth", option.value)}>{t(option.label)}</SegmentedButton>
            ))}
          </Segmented>
        </section>
      )}

      <p className="panel-note shortcuts-note">{t("keyboardShortcuts")}</p>
    </aside>
  );
}
