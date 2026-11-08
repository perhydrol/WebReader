# Application settings

Shelf-local navigation displays shared language state, local storage risk and explicit feedback entry. It does not create a storage repository or reload the shelf. The parent keeps the shelf mounted and restores the settings trigger on return.

The return action is an icon-only ChevronLeft with a localized accessible name. Language uses an unmodified Konsta Segmented/SegmentedButton pair; ShelfButton does not wrap those controls.

Additional fonts offers an explicit download, busy spinner, retryable error, persisted-ready status and local OFL license link. It does not select the font automatically. Resource ownership is defined in [optionalFont](../lib/optionalFont.md).
