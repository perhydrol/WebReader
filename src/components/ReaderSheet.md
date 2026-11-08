# Reader sheet

Owns one modal focus trap, background inert/aria-hidden restoration, Escape and backdrop dismissal. Children own content, not focus lifecycle. Source readers remain mounted under the overlay. VisualViewport notifications coalesce into one animation frame and affect only the sheet rectangle, never the reader height. Cleanup restores the connected trigger without scrolling and removes viewport/key listeners.
