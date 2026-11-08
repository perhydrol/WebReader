# Local library types

BookRecord and format-specific ReadingLocator describe browser-local metadata. ReaderPreferences version 2 stores typography, a concrete theme and optional followSystemTheme. Omitted followSystemTheme normalizes to true; false uses the concrete manual theme. The effective reader theme is resolved in App, and this preference extension does not alter IndexedDB stores or book bytes.
