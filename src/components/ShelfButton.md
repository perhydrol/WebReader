# Shelf action presentation

Wraps Konsta Button through public color, rounded, clear and className props. Neutral glass applies only to shelf actions that opt into this component. Clear book surfaces remain transparent. Segmented controls use Konsta directly and are never restyled by this wrapper. Native button props and refs pass through unchanged.

For href actions, target and rel pass through to the anchor rendered by Konsta Button. Callers provide link semantics explicitly because Konsta defaults its role to button.
