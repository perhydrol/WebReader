# Outline content

Recursive local outline retains independent expansion and navigation actions and an explicit current location. Navigation is delegated to App, which clears old search highlights before moving and closes the sheet. ReaderSheet owns focus and dismissal, while the outline retains bounded source-derived entries and its own scroll region.
