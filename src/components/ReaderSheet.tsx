import { Sheet } from "konsta/react";
import { useLayoutEffect, useRef, type ReactNode } from "react";

export function ReaderSheet({ children, label, onClose }: {
  children: ReactNode; label: string; onClose: () => void;
}) {
  const sheetRef = useRef<HTMLElement>(null);
  const closeRef = useRef(onClose);
  const touchRef = useRef(false);
  closeRef.current = onClose;
  useLayoutEffect(() => {
    const sheet = sheetRef.current;
    if (!sheet) return;
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const shell = sheet.closest(".reader-shell");
    const background = [...(shell?.children ?? [])].filter((item): item is HTMLElement => item instanceof HTMLElement && !item.contains(sheet) && !item.classList.contains("reader-toolbar"));
    const previous = background.map((item) => ({ item, inert: item.inert, hidden: item.getAttribute("aria-hidden") }));
    previous.forEach(({ item }) => { item.inert = true; item.setAttribute("aria-hidden", "true"); });
    const controls = () => [...sheet.querySelectorAll<HTMLElement>("button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex='0']")].filter((item) => item.getClientRects().length > 0);
    (sheet.querySelector<HTMLElement>("input[type='search']") ?? controls()[0] ?? sheet).focus({ preventScroll: true });
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); closeRef.current(); }
      if (event.key !== "Tab") return;
      const items = controls();
      const first = items[0];
      const last = items.at(-1);
      if (!first || !last) { event.preventDefault(); sheet.focus(); }
      else if (event.shiftKey && (document.activeElement === first || document.activeElement === sheet)) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    const viewport = window.visualViewport;
    let frame = 0;
    const resize = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const top = viewport?.offsetTop ?? 0;
        const height = viewport?.height ?? window.innerHeight;
        sheet.style.setProperty("--sheet-top", `${top}px`);
        sheet.style.setProperty("--sheet-height", `${height}px`);
      });
    };
    resize();
    viewport?.addEventListener("resize", resize);
    viewport?.addEventListener("scroll", resize);
    document.addEventListener("keydown", keydown, true);
    return () => {
      cancelAnimationFrame(frame);
      viewport?.removeEventListener("resize", resize);
      viewport?.removeEventListener("scroll", resize);
      document.removeEventListener("keydown", keydown, true);
      previous.forEach(({ item, inert, hidden }) => {
        item.inert = inert;
        if (hidden === null) item.removeAttribute("aria-hidden"); else item.setAttribute("aria-hidden", hidden);
      });
      queueMicrotask(() => {
        if (!trigger?.isConnected) return;
        const surface = shell?.querySelector<HTMLElement>(".reading-surface");
        if (touchRef.current && surface) surface.focus({ preventScroll: true });
        else trigger.focus({ preventScroll: true });
      });
    };
  }, []);
  return <Sheet ref={sheetRef} opened className="reader-sheet" role="dialog" aria-modal="true" aria-label={label} tabIndex={-1}
    onPointerDownCapture={(event) => { touchRef.current = event.pointerType === "touch"; }}
    onKeyDownCapture={() => { touchRef.current = false; }}
    onBackdropClick={(event) => { touchRef.current = event.nativeEvent?.pointerType === "touch"; onClose(); }}>{children}</Sheet>;
}
