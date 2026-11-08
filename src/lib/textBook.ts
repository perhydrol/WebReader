import type { ReaderPreferences } from "../types/library";
import { TEXT_FONT_STACK, TEXT_THEME_COLORS } from "./textDisplay";
import type { TextChapter, TextSourceModel } from "./textDocument";

export interface TextBookSection {
  id: string;
  linear: "yes";
  size: number;
  load: () => string;
  unload: () => void;
}

export interface TextBook {
  dir: "ltr";
  sections: TextBookSection[];
  destroy: () => void;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    // The HTML parser normalizes raw CR/CRLF to LF before tokenization.
    // A character reference keeps CR in the DOM so source and DOM lengths agree.
    .replace(/\r/g, "&#13;");
}

export function buildChapterHtml(model: TextSourceModel, chapter: TextChapter): string {
  const parts: string[] = [];
  let currentParagraphId: string | undefined;

  for (const fragment of chapter.fragments) {
    if (fragment.paragraphId !== currentParagraphId) {
      if (currentParagraphId !== undefined) parts.push("</p>");
      const continuation = fragment.continuesPrevious ? " continues-previous" : "";
      parts.push(`<p class="text-fragment-group${continuation}">`);
      currentParagraphId = fragment.paragraphId;
    }
    parts.push(
      `<span class="text-fragment" data-source-start="${fragment.start}" data-source-end="${fragment.end}">`
      + escapeHtml(model.text.slice(fragment.start, fragment.end))
      + "</span>",
    );
  }
  if (currentParagraphId !== undefined) parts.push("</p>");

  return "<!doctype html><html dir=\"ltr\"><head><meta charset=\"utf-8\">"
    + `<title>${chapter.id}</title></head><body><div class="text-chapter">${parts.join("")}</div></body></html>`;
}

export function buildTextBookStyles(preferences: ReaderPreferences): string {
  const colors = TEXT_THEME_COLORS[preferences.theme];
  const indent = preferences.paragraphIndent ? `${preferences.paragraphIndent}em` : "0";
  return [
    "html, body { background: transparent; }",
    `body { margin: 0; color: ${colors.color}; font-family: ${TEXT_FONT_STACK[preferences.fontFamily]}; font-size: ${preferences.fontSizePercent}%; line-height: ${preferences.lineHeight}; }`,
    `p.text-fragment-group { margin: 0 0 1em; white-space: pre-wrap; overflow-wrap: anywhere; text-indent: ${indent}; }`,
    "p.text-fragment-group.continues-previous { text-indent: 0; }",
    "p.text-fragment-group:last-child { margin-bottom: 0; }",
    "span.text-fragment { white-space: inherit; }",
    `mark.text-search-highlight { color: ${colors.highlightText}; background: ${colors.highlight}; padding: 0; }`,
  ].join("\n");
}

export function createTextBook(model: TextSourceModel): TextBook {
  const urls = new Set<string>();
  let destroyed = false;
  const sections: TextBookSection[] = model.chapters.map((chapter) => {
    let url: string | undefined;
    const unload = () => {
      if (!url) return;
      URL.revokeObjectURL(url);
      urls.delete(url);
      url = undefined;
    };
    return {
      id: chapter.id,
      linear: "yes",
      size: chapter.end - chapter.start,
      load: () => {
        // A paginator navigation can resume after the reader has unmounted.
        // Creating a URL at that point would never be revoked.
        if (destroyed) return "";
        unload();
        url = URL.createObjectURL(new Blob([buildChapterHtml(model, chapter)], {
          type: "text/html;charset=utf-8",
        }));
        urls.add(url);
        return url;
      },
      unload,
    };
  });

  return {
    dir: "ltr",
    sections,
    destroy: () => {
      destroyed = true;
      for (const section of sections) section.unload();
      for (const url of urls) URL.revokeObjectURL(url);
      urls.clear();
    },
  };
}
