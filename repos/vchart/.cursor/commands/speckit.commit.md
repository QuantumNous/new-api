---
description: "Create a local Conventional Commits-style commit using only specs/<spec-id>/plan.md for semantics; do not push to origin."
handoffs:
  - label: "Generate PR Body"
    agent: "speckit.prgenerate"
    prompt: "Generate a PR body from templates and artifacts"
    send: true
---

## User Input

```text
$ARGUMENTS
```

## Outline

1.  **Pre-flight checks (local-only)**:
    *   Treat this command as zero-input by default: if `$ARGUMENTS` is empty, it should still be able to run end-to-end.
    *   Verify the current branch name follows the feature convention (e.g. `001-some-feature`) so it can be mapped to a `specs/<spec-id>/` directory.
    *   Confirm there are staged or unstaged changes in the working tree; if there are no changes, abort without creating a commit.
    *   Interpret any CLI flags only as behaviour toggles (e.g. `--edit`, `--no-verify`) and **not** as a manual commit message.

2.  **Load spec context from specs/<spec-id>**:
    *   Derive the feature prefix from the current branch name and resolve the matching `specs/<spec-id>/` directory using prefix-based lookup (e.g. `001-` → `specs/001-...`).
    *   Read `specs/<spec-id>/plan.md` and extract:
        - The `## Summary` section — first non-empty line for the natural-language summary.
        - The top-level title (e.g. `Implementation Plan: ...`) as a fallback description.
        - The `### Source Code (repository root)` code block, which lists the source layout for this feature.

3.  **Infer `type` from Summary keywords**:
    *   Build a short text corpus from the Summary sentence and plan title.
    *   Using **only** that text, map the commit `type` according to the following rules (case-insensitive):
        - Contains `bug` or `fix` → `fix`
        - Contains `refactor` or `refactoring` → `refactor`
        - Contains `perf` or `performance` → `perf`
        - Contains `docs`, `doc`, or `documentation` → `docs`
        - Contains `test`, `tests`, or `unit` → `test`
        - Contains `implement`, `implementation`, `add`, `support`, or `feature` → `feat`
        - Otherwise → `chore`
    *   Do **not** inspect file paths, git history, or `common/changes` when choosing the type.

4.  **Infer `scope` from Source Code paths**:
    *   From the `Source Code (repository root)` block in `plan.md`, parse all paths that live under `packages/<name>/...`.
    *   Collect the second-level directory names (e.g. `packages/vchart/` → `vchart`, `packages/vchart-types/` → `vchart-types`), de-duplicate, and sort.
    *   Build the `scope` as:
        - A comma-separated list of all such package names when one or more packages are present.
        - The literal string `monorepo` when no `packages/*` paths can be found.
    *   Do not attempt to infer scope from other folders or git diffs.

5.  **Build a spec-driven `subject` (no AI rewriting)**:
    *   Take the first sentence from the Summary section of `plan.md` as the base subject (trim markdown, collapse whitespace).
    *   Enforce a minimum length of 16 characters:
        - If the subject is too short, append structured identifiers such as the spec id and primary package names:
          - Example: `Fix layout bug` → `Fix layout bug (spec 001-fix-subtitle-layout-bug; vchart)`
    *   Optionally truncate extremely long subjects to a reasonable maximum length (while keeping them readable).
    *   The subject must only be **reformatted** from the spec content; do not invent new semantics or free-form text.

6.  **Assemble and validate the commit header**:
    *   Compose the final header as:
        - ``<type>(<scope>): <subject>``  
          e.g. `fix(vchart): Handle subtitle-only title layout`
    *   If the repository has `commitlint` configured, perform a dry-run check by piping the header into `commitlint` with the local config.
    *   If validation fails:
        - First, clean up the header (e.g. strip non-ASCII control characters, compress spaces) and re-run the dry-run.
        - If it still fails and the user requested edit mode (e.g. `--edit`), write the header into a temporary commit message file and proceed with an interactive `git commit -t <file>` so the user can adjust it manually.
        - If edit mode is not enabled, surface a clear error and stop instead of guessing a new message.

7.  **Execute Git commit (no push)**:
    *   Run `git add -A` from the repository root to stage all changes.
    *   If edit mode is **not** required, execute `git commit -m "<header>"` with the validated header.
    *   If edit mode **is** required, execute `git commit -t <generated-message-file>` so the user can refine the message in their editor.
    *   This command **must not** push to `origin` or any remote; pushing remains a separate, explicit action.

8.  **Report outputs**:
    *   Return the final commit header string used for `git commit`.
    *   Indicate whether commitlint validation passed on the first try or required cleanup/edit mode.
    *   Do not report any `pushed_branch` field, because this command never pushes.
