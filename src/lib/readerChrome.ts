export const CHROME_IDLE_MS = 4000;
export interface ReaderChromeState {
  visibility: "visible" | "hidden" | "pinned";
  locks: ReadonlySet<string>;
  since: number;
}
export type ChromeEvent =
  | { type: "idle" | "tap" | "show"; now: number }
  | { type: "lock"; id: string; active: boolean; now: number };

export function createReaderChrome(now: number): ReaderChromeState {
  return { visibility: "visible", locks: new Set(), since: now };
}

export function transitionChrome(state: ReaderChromeState, event: ChromeEvent): ReaderChromeState {
  if (event.type === "lock") {
    if (state.locks.has(event.id) === event.active) return state;
    const locks = new Set(state.locks);
    if (event.active) locks.add(event.id);
    else locks.delete(event.id);
    const keepHidden = state.visibility === "hidden" && event.id.startsWith("pointer-active:");
    return { visibility: keepHidden ? "hidden" : locks.size ? "pinned" : "visible", locks, since: event.now };
  }
  if (state.locks.size) return state;
  if (event.type === "idle") {
    return event.now - state.since >= CHROME_IDLE_MS ? { ...state, visibility: "hidden" } : state;
  }
  return { ...state, visibility: event.type === "tap" && state.visibility !== "hidden" ? "hidden" : "visible", since: event.now };
}

export function qualifiesTap(tap: {
  x: number; width: number; distance: number; duration: number; primary: boolean; blocked: boolean;
}): boolean {
  return tap.primary && !tap.blocked && tap.width > 0 && tap.x >= tap.width * 0.25
    && tap.x <= tap.width * 0.75 && tap.distance <= 8 && tap.duration <= 250;
}
