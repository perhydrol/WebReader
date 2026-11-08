# Offline and update acceptance

An isolated HTTP server serves the actual production dist under `/WebReader/`. A fresh browser context caches the shell, restarts offline, opens previously unvisited settings, feedback and reader panels, imports synthetic text, searches, restores and deletes. Offline failed feedback retains input without retrying automatically.

The upgrade test requires `WEBREADER_UPGRADE_BASELINE` pointing to an independently built previous production dist. Without it the test explicitly skips. It changes the server directory while the old client reads, checks a waiting service worker and continued navigation, explicitly activates from the shelf, then restarts offline and checks source retention and newly bundled panels. Build the baseline from an isolated source copy, never a production browser profile or user library. This test's old baseline is expected to predate the Konsta root.
