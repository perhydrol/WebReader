# Foliate-paginated TXT view

`TextPagedView.tsx` renders TXT through the locally installed foliate paginator and a generated, escaped chapter book. The source locator remains a UTF-16 offset; foliate CFIs are never persisted.

## Contracts

- The host creates one `foliate-paginator`, opens a `textBook` with lazy sections, and applies `flow=paginated`, the preferred content width, one column, and responsive margins/height.
- `goTo(offset)` clamps to visible text, finds the chapter, and passes an anchor function that builds a `Range` at the absolute offset in the loaded chapter document. The fragment chosen is the one containing the character at that offset; an offset exactly on a fragment boundary goes to the next fragment, not the previous fragment's end. A target requested while a page turn is locked is queued and applied when the turn resolves, so an immediate search jump is not swallowed. Wheel turns use the same queued turn path as the toolbar buttons and the controller.
- `relocate` maps the paginator's visible range back to an absolute source offset. A paragraph-element start uses the source-element fallback in `textDom`. The first relocate after a chapter load marks the view ready.
- Search highlights are applied to the current chapter only. Each visible intersection is wrapped inside one source span; the in-document mark has no padding so it cannot reflow the page.
- Layout and style attribute updates are gated until the first chapter load, and unchanged attributes are not rewritten. The paginator renders synchronously on attribute changes; updating it during iframe load can call `getComputedStyle` on an unloaded document. Preferences update iframe styles and content width after loading; the paginator's anchor and resize observer preserve the source target. Keyboard and wheel handlers are attached to the host and each loaded iframe document.
- Cleanup removes listeners, destroys the paginator, unloads the book, and revokes every blob URL. It is safe to run before the first navigation.
- Chapter loading and generated markup are bounded by `textBook`; the view never prebuilds the whole book or keeps an unbounded chapter cache.

The paginator uses a closed shadow root; application code interacts only through its public methods, attributes, and events.

Loaded documents have an enumerable disposer map for keyboard, wheel and content interaction subscriptions. Each load prunes documents outside the public getContents() plus the current load document; unmount disposes all. Callback refs keep chrome updates out of model initialization dependencies. Tap geometry maps the visible host into iframe client coordinates through frameElement; no closed-shadow traversal is used.
