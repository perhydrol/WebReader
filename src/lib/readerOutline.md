# Current outline location

`currentOutlineItem` maps an adapter target to one outline entry. Exact target matches take priority; otherwise numeric TXT source offsets and PDF page numbers select the largest preceding numeric target across the tree. Locations before the first target and unmatched EPUB hrefs have no current entry. It never changes persisted locators or infers href ordering.
