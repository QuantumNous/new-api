---
name: upgrade-rspack
description: Use when asked to upgrade `@rspack/core` in this repository to a specific version, run dependency installation and validation, then commit and create a pull request.
---

# Upgrade Rspack

## Input

- Target version, for example `2.0.0`

If the version is missing, ask for it before making changes.

## Steps

1. Check the worktree with `git status --short`. If there are uncommitted edits, stop and ask the user how to proceed.

2. Run `pnpm update @rspack/core@<version> --recursive` to update the dependency across all packages in the workspace.

3. Run `pnpm i` at the repository root.

4. Run `pnpm build`, `pnpm test`, and then `pnpm e2e`. If any command fails, stop, report the failure, and do not commit or create a PR.

5. Review the diff and confirm it only contains the intended dependency upgrade and lockfile changes. If `@rspack/core` is already at the target version and there is no diff, report that nothing changed and stop.

6. Commit with this exact message: `feat(deps): update @rspack/core to <version>`

7. Before pushing, confirm the current branch with `git branch --show-current`. If it is the default branch, create and switch to a dedicated branch first. Never push the default branch directly.

8. If `.github/PULL_REQUEST_TEMPLATE.md` exists, keep its structure exactly.
   Create the PR with:
   - Title: `feat(deps): update @rspack/core to <version>`
   - `Summary`: `Update @rspack/core to <version>.`
   - `Related Links`: `https://github.com/web-infra-dev/rspack/releases/tag/v<version>`
