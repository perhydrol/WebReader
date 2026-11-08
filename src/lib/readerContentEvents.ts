import { qualifiesTap } from "./readerChrome";

export type ReaderContentInteraction = { type: "tap"; session: string }
  | { type: "pointer-active" | "selection-active"; session: string; active: boolean };

/** Observes only: never cancels publication selection, scrolling or paginator gestures. */
export function bindReaderContentEvents(
  root: Document | HTMLElement,
  notify: (event: ReaderContentInteraction) => void,
  geometry: () => { left: number; width: number } | undefined,
): () => void {
  const doc = root.nodeType === 9 ? root as Document : root.ownerDocument!;
  const view = doc.defaultView!;
  const session = crypto.randomUUID();
  const pointers = new Set<number>();
  let start: { x: number; y: number; time: number; id: number; primary: boolean; blocked: boolean } | undefined;
  let timer = 0;
  let lastUp = -Infinity;
  let disposed = false;
  const emitLock = (type: "pointer-active" | "selection-active", active: boolean) => notify({ type, session, active });
  const selectionActive = () => {
    const selection = doc.getSelection();
    const anchor = selection?.anchorNode;
    return Boolean(selection && !selection.isCollapsed && anchor && (root === doc || root.contains(anchor)));
  };
  const selection = () => {
    const active = selectionActive();
    if (active) view.clearTimeout(timer);
    emitLock("selection-active", active);
  };
  const down = (raw: Event) => {
    const event = raw as PointerEvent;
    pointers.add(event.pointerId);
    emitLock("pointer-active", true);
    const target = event.target as Element | null;
    start = { x: event.clientX, y: event.clientY, time: event.timeStamp, id: event.pointerId,
      primary: event.isPrimary && event.button === 0 && pointers.size === 1,
      blocked: Boolean(target?.closest?.("a,button,input,textarea,select,[contenteditable]:not([contenteditable='false'])")) };
    if (pointers.size > 1) view.clearTimeout(timer);
  };
  const move = (raw: Event) => {
    const event = raw as PointerEvent;
    if (start && Math.hypot(event.clientX - start.x, event.clientY - start.y) > 8) start.blocked = true;
  };
  const end = (raw: Event) => {
    const event = raw as PointerEvent;
    pointers.delete(event.pointerId);
    emitLock("pointer-active", pointers.size > 0);
    const origin = start;
    start = undefined;
    if (event.type === "pointercancel") { view.clearTimeout(timer); return; }
    const rect = geometry();
    if (!origin || origin.id !== event.pointerId || !rect || selectionActive()) return;
    const double = event.timeStamp - lastUp <= 250;
    lastUp = event.timeStamp;
    view.clearTimeout(timer);
    if (double || !qualifiesTap({ x: event.clientX - rect.left, width: rect.width,
      distance: Math.hypot(event.clientX - origin.x, event.clientY - origin.y), duration: event.timeStamp - origin.time,
      primary: origin.primary, blocked: origin.blocked })) return;
    timer = view.setTimeout(() => {
      if (!disposed && !selectionActive()) notify({ type: "tap", session });
    }, 250);
  };
  const cancelTap = () => { view.clearTimeout(timer); if (start) start.blocked = true; };
  const blur = () => { start = undefined; pointers.clear(); cancelTap(); emitLock("pointer-active", false); };
  root.addEventListener("pointerdown", down);
  root.addEventListener("pointermove", move);
  doc.addEventListener("pointerup", end);
  doc.addEventListener("pointercancel", end);
  doc.addEventListener("selectionchange", selection);
  root.addEventListener("scroll", cancelTap, { capture: true, passive: true });
  view.addEventListener("blur", blur);
  selection();
  return () => {
    disposed = true;
    view.clearTimeout(timer);
    root.removeEventListener("pointerdown", down);
    root.removeEventListener("pointermove", move);
    doc.removeEventListener("pointerup", end);
    doc.removeEventListener("pointercancel", end);
    doc.removeEventListener("selectionchange", selection);
    root.removeEventListener("scroll", cancelTap, true);
    view.removeEventListener("blur", blur);
    emitLock("pointer-active", false);
    emitLock("selection-active", false);
  };
}
