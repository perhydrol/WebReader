# Outline content

Recursive local outline retains independent expansion and navigation actions and an explicit current location. Navigation is delegated to App, which clears old search highlights before moving and closes the sheet. ReaderSheet owns focus and dismissal, while the outline retains bounded source-derived entries and its own scroll region.

Current-entry resolution follows [the shared target contract](../lib/readerOutline.md). On opening or a current-entry change, only the outline navigation region scrolls to center the current entry; resize observations accommodate the sheet viewport. User scrolling is otherwise left alone, and observers/frames are released on unmount. Current entries use aria-current and a neutral highlighted surface.
