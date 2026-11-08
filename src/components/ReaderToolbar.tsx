import { Toolbar, ToolbarPane } from "konsta/react";
import type { ReactNode } from "react";
import { useEffect } from "react";

export function ReaderToolbar({ children, hidden, panelOpen, onLock }: {
  children: ReactNode; hidden: boolean; panelOpen: boolean; onLock: (id: string, active: boolean) => void;
}) {
  useEffect(() => {
    const release = () => onLock("toolbar-pointer", false);
    window.addEventListener("pointerup", release);
    window.addEventListener("pointercancel", release);
    window.addEventListener("blur", release);
    return () => {
      window.removeEventListener("pointerup", release);
      window.removeEventListener("pointercancel", release);
      window.removeEventListener("blur", release);
    };
  }, [onLock]);
  return <header className={`reader-toolbar ${hidden || panelOpen ? "chrome-hidden" : ""}`} inert={hidden || panelOpen} aria-hidden={hidden || panelOpen || undefined}
    onFocusCapture={() => onLock("toolbar-focus", true)}
    onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) onLock("toolbar-focus", false); }}
    onPointerDown={() => onLock("toolbar-pointer", true)}
    onPointerUp={() => onLock("toolbar-pointer", false)}
    onPointerCancel={() => onLock("toolbar-pointer", false)}>
    <Toolbar top><ToolbarPane className="reader-toolbar-pane">{children}</ToolbarPane></Toolbar>
  </header>;
}
