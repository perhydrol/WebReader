# Preference normalization

Normalizes the existing version-2 JSON settings record without changing the database schema. followSystemTheme defaults to true for absent or invalid fields; an explicit false preserves manual appearance. The stored theme remains a concrete fallback. App resolves system appearance before passing preferences to readers. Numeric bounds and existing enum migration remain unchanged.

The validated font-family enum accepts wenkai. Asset availability is a runtime concern and does not erase the stored selection.
