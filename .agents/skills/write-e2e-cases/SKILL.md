---
name: write-e2e-cases
description: Use when adding or updating Rsbuild end-to-end tests in `e2e/cases`, including new feature coverage, bug reproduction, and regression prevention.
---

# Write E2E Cases

## Steps

1. Review uncommitted git changes to define test scope and target behavior.

2. Read `e2e/README.md` and follow its conventions.

3. Prefer `@e2e/helper` methods (for example `dev`, `build`, `getDistFiles`, `findFile`, `getFileContent`, `expectFile`, and `expectFileWithContent`) to keep tests minimal, including file and file-content assertions.

4. Add Playwright cases under `e2e/cases`, following existing directory patterns.

5. Use short, direct, and stable assertions. Avoid redundant setup and checks.

6. Run `pnpm build` once, then run `pnpm e2e` to validate.

## Case Structure

- Include a `src` directory in every case (required).
- Prefer putting static Rsbuild configurations in `rsbuild.config.ts` to enable easier debugging via `npx rsbuild`.
- Use inline config for dynamic values or minor per-test variations.
- Split into multiple case directories when cases need different `src` code or different Rsbuild configs.
- When static assets are needed, prefer reusing assets from `@e2e/assets` before adding new files.
- For package mocks used by one case, place them under that case's `_node_modules` directory and call `copyNodeModules()` before they are resolved.

## Constraints

- If tests can pass only after source-code changes, do not change source code directly. Explain the required source change and ask the user before proceeding.
