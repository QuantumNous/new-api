# Downstream Fork Rules

This repository is a downstream fork of the official project. Keeping the
working tree compatible with `upstream/main` and minimizing future merge
conflicts are primary engineering constraints.

## Upstream Baseline

- Treat `upstream/main` as the official source baseline and `origin/main` as
  the downstream branch.
- A path that exists in `upstream/main` is upstream-owned even when the
  downstream branch has already modified it. A path introduced only in the
  downstream branch is downstream-owned.
- Before changing existing code, compare the relevant files or history with
  `upstream/main` when the upstream remote is available.
- If the upstream remote or baseline is unavailable, do not make broad
  refactors based on assumptions about ownership; state the limitation.

## Change Placement

- Leave upstream-owned files unchanged by default. Before editing one, first
  determine whether the requirement can be met without that edit.
- Prefer existing configuration, extension points, registration tables,
  interfaces, and middleware hooks.
- Prefer adding a new file within the existing package or feature for
  downstream behavior. Keep the existing architecture and ownership model.
- Do not duplicate substantial upstream logic only to avoid touching an
  upstream-owned file.
- A required bug fix or integration may modify an upstream-owned file. When
  that is necessary, keep the change to the smallest possible number of
  files and hunks, and isolate downstream behavior behind a narrow hook or
  adapter where practical.

## Conflict Avoidance

- Do not perform unrelated cleanup, refactoring, renaming, moving, import
  reordering, whole-file formatting, dependency upgrades, or generated-file
  changes as part of a feature or bug fix.
- Preserve upstream APIs, naming, layout, and behavior unless the task
  explicitly requires a change.
- Keep upstream synchronization commits separate from downstream feature
  commits.
- When resolving an upstream merge, preserve the upstream implementation
  first, then reapply the smallest downstream integration necessary.

## Review Before Completion

- Inspect `git diff --stat` and `git diff --check` before finishing.
- Identify every existing upstream-owned file changed by the task and record
  why the change was necessary.
- Prefer solutions that could be accepted upstream without introducing
  fork-specific coupling, even when the final implementation remains in this
  downstream repository.
