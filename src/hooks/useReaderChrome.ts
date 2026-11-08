import { useCallback, useEffect, useRef, useState } from "react";
import { CHROME_IDLE_MS, createReaderChrome, transitionChrome, type ChromeEvent } from "../lib/readerChrome";
import type { ReaderContentInteraction } from "../lib/readerContentEvents";

export function useReaderChrome(session: string | undefined, enabled: boolean, panel: boolean) {
  const [state, setState] = useState(() => createReaderChrome(Date.now()));
  const sessionRef = useRef(session);
  sessionRef.current = session;
  const dispatch = useCallback((event: Omit<Extract<ChromeEvent, { type: "lock" }>, "now"> | { type: "show" | "tap" | "idle" }) => {
    setState((current) => transitionChrome(current, { ...event, now: Date.now() }));
  }, []);
  const lock = useCallback((id: string, active: boolean) => dispatch({ type: "lock", id, active }), [dispatch]);
  useEffect(() => { setState(createReaderChrome(Date.now())); }, [session]);
  useEffect(() => { lock("panel", panel); }, [lock, panel, session]);
  useEffect(() => {
    if (!enabled || !session || state.visibility !== "visible" || document.hidden) return;
    const timer = window.setTimeout(() => dispatch({ type: "idle" }), Math.max(0, CHROME_IDLE_MS - (Date.now() - state.since)));
    return () => window.clearTimeout(timer);
  }, [dispatch, enabled, session, state]);
  useEffect(() => {
    const visibility = () => {
      lock("background", document.hidden);
      if (!document.hidden) dispatch({ type: "show" });
    };
    document.addEventListener("visibilitychange", visibility);
    return () => document.removeEventListener("visibilitychange", visibility);
  }, [dispatch, lock]);
  const onContentInteraction = useCallback((event: ReaderContentInteraction) => {
    if (!sessionRef.current) return;
    if (event.type === "tap") dispatch({ type: "tap" });
    else lock(`${event.type}:${event.session}`, event.active);
  }, [dispatch, lock]);
  return { hidden: enabled && state.visibility === "hidden", lock, show: () => dispatch({ type: "show" }), onContentInteraction };
}
