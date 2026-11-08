import type { ReaderPreferences, ReaderTheme } from "../types/library";

export const TEXT_FONT_STACK = {
  wenkai: '"WebReader WenKai", "Songti SC", serif',
  publisher: 'Georgia, "Songti SC", "Noto Serif CJK SC", serif',
  serif: 'Georgia, "Songti SC", "Noto Serif CJK SC", serif',
  sans: '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Noto Sans CJK SC", sans-serif',
} as const;

export const TEXT_CONTENT_WIDTH = { narrow: 600, standard: 720, wide: 880 } as const;

export interface TextThemeColors {
  background: string;
  color: string;
  highlight: string;
  highlightText: string;
}

export const TEXT_THEME_COLORS: Record<ReaderTheme, TextThemeColors> = {
  white: { background: "#fff", color: "#222522", highlight: "#f4d878", highlightText: "inherit" },
  paper: { background: "#f5f1e8", color: "#292a27", highlight: "#f4d878", highlightText: "inherit" },
  night: { background: "#171918", color: "#e5e8e2", highlight: "#e7c65c", highlightText: "#171918" },
  contrast: { background: "#fff", color: "#050505", highlight: "#f4d878", highlightText: "inherit" },
};

export function textTypographyStyle(preferences: ReaderPreferences): {
  fontSize: string;
  lineHeight: number;
  fontFamily: string;
} {
  return {
    fontSize: `${preferences.fontSizePercent}%`,
    lineHeight: preferences.lineHeight,
    fontFamily: TEXT_FONT_STACK[preferences.fontFamily],
  };
}
