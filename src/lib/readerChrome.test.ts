import { describe, expect, it } from "vitest";
import { createReaderChrome, transitionChrome, qualifiesTap } from "./readerChrome";

describe("reader chrome", () => {
  it("hides only after a full idle interval and restarts after the final independent lock", () => {
    let state = createReaderChrome(0);
    expect(transitionChrome(state, { type: "idle", now: 3999 }).visibility).toBe("visible");
    state = transitionChrome(state, { type: "idle", now: 4000 });
    expect(state.visibility).toBe("hidden");
    state = transitionChrome(state, { type: "lock", id: "selection:1", active: true, now: 5000 });
    state = transitionChrome(state, { type: "lock", id: "panel", active: true, now: 5100 });
    state = transitionChrome(state, { type: "lock", id: "selection:1", active: false, now: 5200 });
    expect(transitionChrome(state, { type: "idle", now: 10000 }).visibility).toBe("pinned");
    state = transitionChrome(state, { type: "lock", id: "panel", active: false, now: 11000 });
    expect(transitionChrome(state, { type: "idle", now: 14999 }).visibility).toBe("visible");
    expect(transitionChrome(state, { type: "idle", now: 15000 }).visibility).toBe("hidden");
  });

  it("does not let stale unlocks reveal hidden chrome or override a newer session lock", () => {
    let state = transitionChrome(createReaderChrome(0), { type: "idle", now: 4000 });
    state = transitionChrome(state, { type: "lock", id: "old", active: false, now: 5000 });
    expect(state.visibility).toBe("hidden");
    state = transitionChrome(state, { type: "lock", id: "new", active: true, now: 6000 });
    state = transitionChrome(state, { type: "lock", id: "old", active: false, now: 7000 });
    expect(state.visibility).toBe("pinned");
    expect(transitionChrome(state, { type: "tap", now: 7100 }).visibility).toBe("pinned");
    expect(createReaderChrome(8000).locks.size).toBe(0);
  });

  it("accepts only bounded central taps, excluding drags, long presses and controls", () => {
    const tap = { x: 50, width: 100, distance: 0, duration: 100, primary: true, blocked: false };
    expect(qualifiesTap(tap)).toBe(true);
    for (const change of [{ x: 24 }, { x: 76 }, { distance: 9 }, { duration: 251 }, { primary: false }, { blocked: true }, { width: 0 }]) {
      expect(qualifiesTap({ ...tap, ...change })).toBe(false);
    }
  });
});
