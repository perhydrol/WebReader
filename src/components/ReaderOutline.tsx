import { Button, List } from "konsta/react";
import { ChevronDown, ChevronRight, ListTree, X } from "lucide-react";
import { useState } from "react";
import type { TranslationKey, TranslationVariables } from "../lib/i18n";
import type { ReaderOutlineItem } from "../types/reader";

interface ReaderOutlineProps {
  items: ReaderOutlineItem[];
  currentTarget?: string;
  automatic?: boolean;
  onNavigate: (target: string) => void;
  onClose: () => void;
  t: (key: TranslationKey, variables?: TranslationVariables) => string;
}

function OutlineBranch({ items, currentTarget, onNavigate, t }: Pick<ReaderOutlineProps, "items" | "currentTarget" | "onNavigate" | "t">) {
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const toggle = (id: string) => {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <List className="outline-list" nested>
      {items.map((item) => {
        const hasChildren = item.children.length > 0;
        const isCollapsed = collapsed.has(item.id);
        const current = Boolean(item.target && item.target === currentTarget);
        return (
          <li key={item.id}>
            <div className="outline-row">
              {hasChildren ? (
                <Button clear
                  className="outline-disclosure"
                  type="button"
                  onClick={() => toggle(item.id)}
                  aria-expanded={!isCollapsed}
                  aria-label={t(isCollapsed ? "expandSection" : "collapseSection", { title: item.label })}
                >
                  {isCollapsed ? <ChevronRight /> : <ChevronDown />}
                </Button>
              ) : <span className="outline-spacer" />}
              <Button clear
                className={`outline-link ${current ? "current" : ""}`}
                type="button"
                onClick={() => item.target && onNavigate(item.target)}
                disabled={!item.target}
                aria-current={current ? "location" : undefined}
              >
                {item.label}
              </Button>
            </div>
            {hasChildren && !isCollapsed && (
              <OutlineBranch items={item.children} currentTarget={currentTarget} onNavigate={onNavigate} t={t} />
            )}
          </li>
        );
      })}
    </List>
  );
}

export function ReaderOutline({ items, currentTarget, automatic, onNavigate, onClose, t }: ReaderOutlineProps) {

  return (
    <aside className="reader-panel outline-panel" aria-label={t("tableOfContents")}>
      <header className="reader-panel-header">
        <div><ListTree /><strong>{t("tableOfContents")}</strong></div>
        <Button clear className="icon-button" type="button" onClick={onClose} aria-label={t("closeTableOfContents")}><X /></Button>
      </header>
      {automatic && items.length > 0 && <p className="panel-note">{t("automaticOutline")}</p>}
      <nav className="outline-nav">
        {items.length > 0
          ? <OutlineBranch items={items} currentTarget={currentTarget} onNavigate={onNavigate} t={t} />
          : <p className="empty-panel">{t("noTableOfContents")}</p>}
      </nav>
    </aside>
  );
}
