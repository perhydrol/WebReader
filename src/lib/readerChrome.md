# Reader chrome state

Pure transitions own visible, hidden and pinned states. Independent session keys hold locks; unknown releases have no effect. The final release starts a full four-second idle period. Taps never override locks. Tap qualification limits duration, movement and the visible central region; the DOM bridge owns double-tap cancellation and selection checks.
