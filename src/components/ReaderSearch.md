# Search content

Explicit submission starts bounded cancellable local search. Generations invalidate late results, and unmount always aborts. Dismissal clears highlights; choosing a result marks navigation before dispatch and closes while preserving the active highlight. App clears it on a new search or ordinary outline navigation.

Konsta Searchbar 5.5 does not forward native type and length attributes and resets input type on internal rerenders. The search field therefore uses Konsta ListInput with native type=search and maxLength; a separate named button clears the controlled value. ReaderSheet owns focus, and App synchronously focuses the mounted input in the opening user event.

An owned wrapper removes the list input's list-row padding without depending on className forwarding. The form has one flexible field plus two fixed 44px actions in a single row.
