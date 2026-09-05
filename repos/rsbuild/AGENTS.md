# AGENTS.md

## Stack

- Use repo Node.js/pnpm versions (`package.json`, `.node-version`)
- `pnpm` workspace; shared deps in `pnpm-workspace.yaml` catalogs
- TypeScript strict, Rspack/Rsbuild
- Tests: Rstest; e2e: Playwright

## Commands

```bash
# setup
corepack enable && pnpm install

# dev checks
pnpm lint
pnpm test

# build / format / docs
pnpm build
pnpm format
pnpm doc

# focused work
pnpm --filter @rsbuild/core run build
pnpm test packages/core/tests/foo.test.ts
pnpm e2e css

# full e2e when needed
pnpm e2e
```

## Testing

- Prefer adding e2e tests over unit tests, unless testing single-function behavior.
- Update all affected unit test snapshots, not just a subset.
- Run `pnpm build` once before `pnpm test` or any `pnpm e2e` command, including focused cases.

## Project structure

```text
packages/core/              # core + CLI
packages/plugin-*/          # plugins
packages/create-rsbuild/    # scaffold
e2e/                        # e2e tests
examples/                   # runnable examples
website/                    # docs
scripts/                    # repo tooling
```

## Skills

Use matching `.agents/skills/*/SKILL.md` for release, Rspack upgrade, e2e, docs sync, PR, and perf tasks

## Code style

- Oxfmt; single quotes
- camelCase functions/files; PascalCase types/classes
