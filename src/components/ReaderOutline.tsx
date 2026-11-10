import { Button, List } from "konsta/react";
import { ChevronDown, ChevronRight, ListTree, X } from "lucide-react";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { currentOutlineItem } from "../lib/readerOutline";
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

function OutlineBranch({ items, currentId, onNavigate, t }: Pick<ReaderOutlineProps, "items" | "onNavigate" | "t"> & { currentId?: string }) {
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
        const current = item.id === currentId;
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
              <OutlineBranch items={item.children} currentId={currentId} onNavigate={onNavigate} t={t} />
            )}
          </li>
        );
      })}
    </List>
  );
}

export function ReaderOutline({ items, currentTarget, automatic, onNavigate, onClose, t }: ReaderOutlineProps) {
  const navRef = useRef<HTMLElement>(null);
  const currentId = useMemo(() => currentOutlineItem(items, currentTarget)?.id, [items, currentTarget]);
  useLayoutEffect(() => {
    const nav = navRef.current;
    if (!nav || !currentId) return;
    const centerCurrent = () => {
      const current = nav.querySelector<HTMLElement>('[aria-current="location"]');
      if (!current) return;
      const item = current.getBoundingClientRect();
      const viewport = nav.getBoundingClientRect();
      nav.scrollTop += item.top - viewport.top - (nav.clientHeight - item.height) / 2;
    };
    const frame = requestAnimationFrame(centerCurrent);
    const observer = new ResizeObserver(centerCurrent);
    observer.observe(nav);
    return () => { cancelAnimationFrame(frame); observer.disconnect(); };
  }, [currentId, items]);

  return (
    <aside className="reader-panel outline-panel" aria-label={t("tableOfContents")}>
      <header className="reader-panel-header">
        <div><ListTree /><strong>{t("tableOfContents")}</strong></div>
        <Button clear className="icon-button" type="button" onClick={onClose} aria-label={t("closeTableOfContents")}><X /></Button>
      </header>
      {automatic && items.length > 0 && <p className="panel-note">{t("automaticOutline")}</p>}
      <nav ref={navRef} className="outline-nav">
        {items.length > 0
          ? <OutlineBranch items={items} currentId={currentId} onNavigate={onNavigate} t={t} />
          : <p className="empty-panel">{t("noTableOfContents")}</p>}
      </nav>
    </aside>
  );
}
