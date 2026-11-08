# Checks workflow

`checks.yml` validates non-main pushes and pull requests with read-only repository permissions. It installs pnpm from the version declared in the root package manifest before Node's pnpm cache is initialized, then installs the frozen lockfile and runs the project checks and production browser tests.

For the authoritative command list, see [AGENTS.md](../../AGENTS.md#commands). This workflow never publishes the application or receives deployment write permissions.
