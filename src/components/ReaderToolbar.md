# Floating controls

Konsta Toolbar/ToolbarPane retain default iOS glass and highlighting. The absolute header never participates in reader geometry. Hidden controls are inert and aria-hidden; CSS removes visibility and filters after the transition. Focus and pointer locks are separate. Business actions and reader identity remain in App.

The public Toolbar top variant suppresses its optional full-width background and safe-area filler; the header positions this compact variant at the bottom. Only ToolbarPane retains backdrop blur. The shell owns safe insets once; the pane sits 12px above the safe bottom.
