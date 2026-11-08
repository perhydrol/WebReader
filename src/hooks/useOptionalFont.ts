import { useEffect, useSyncExternalStore } from "react";
import { getOptionalFontState, initializeOptionalFont, subscribeOptionalFont } from "../lib/optionalFont";

export function useOptionalFont() {
  const state = useSyncExternalStore(subscribeOptionalFont, getOptionalFontState);
  useEffect(() => { void initializeOptionalFont(); }, []);
  return state;
}
