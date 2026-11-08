# Content interaction bridge

One subscription per source document or virtual scroller emits UI semantics only, with unique session lock identifiers. It observes pointer movement, selection, scrolling and cancellation without preventing default behavior. A qualifying central single tap waits 250ms; a second tap cancels it. Geometry is supplied in the owning document's client coordinate system. Missing geometry rejects taps. Disposing removes all listeners, pending tap and session locks. No book text or selection contents leave the bridge.
