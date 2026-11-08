# Playwright configuration

`playwright.config.ts` runs the production browser suite using the committed synthetic fixtures. The preview server is built and started through pnpm, using the package-manager version declared in `package.json`.

The server has a fixed local address, is owned by the test run, and must not reuse an unrelated running instance. Tests target desktop Chrome with a default viewport of 1440×900; the safe-area suite resizes within that project to synthetic portrait and landscape sizes. Traces are retained only for failures and remain generated local output.

For the authoritative validation commands and browser installation instructions, see [AGENTS.md](AGENTS.md#commands). Switching the package manager changes the server command, not browser coverage or deployment permissions.
