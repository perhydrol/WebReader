# Pages workflow

`pages.yml` builds the static application on main pushes or explicit dispatch. It installs the pnpm version declared in the root package manifest before initializing Node's pnpm cache, validates the frozen dependency graph and application with `pnpm run check`, and uploads only the generated application build. Browser E2E is not run in Actions; it remains a local validation command.

Deployment waits for the validated build. The existing Pages and OpenID permissions remain scoped to this workflow. See [AGENTS.md](../../AGENTS.md#deployment) for the authoritative deployment contract and [validation commands](../../AGENTS.md#commands).
