---
description: 'Generate Rush change entries for VChart monorepo using specs/<spec-id>/plan.md as the only semantic source; infer bump type from the spec with zero-input defaults.'
handoffs:
  - label: 'Commit Changes'
    agent: 'speckit.commit'
    prompt: 'Create a clean Conventional Commits commit and push if desired'
    send: true
---

## User Input

```text
$ARGUMENTS
```

## Outline

1.  **Resolve feature spec from branch**:
    - Treat this command as *zero/low-input*: if `$ARGUMENTS` is empty, infer everything from the current branch and `specs` directory.
    - Derive the feature prefix from the current branch name (for example, `001-fix-bug` → prefix `001`) and locate the matching directory under `specs/` whose name starts with that prefix.
    - From that directory, resolve:
      - `plan.md` as the primary source of truth for the change description.
      - `checklists/requirements.md` as an optional, secondary source when the plan lacks a clear summary.
    - If no matching `specs/<spec-id>/` can be found, return an error instead of guessing.

2.  **Extract Summary from specs-only context**:
    - From `plan.md`, read the `## Summary` section and take the first non-empty line as the feature summary.
    - If the `Summary` section is empty or missing, fall back in order to:
      - The top-level title of `plan.md` (for example, `Implementation Plan: ...`).
      - A concise line derived from `checklists/requirements.md`.
      - The feature directory name or branch name.
    - Normalize the final summary to a single line (strip markdown markers, collapse whitespace) without inventing new wording.

3.  **Infer bump type (spec-driven)**:
    - Default `bumpType` to `patch`.
    - Scan the content of `plan.md` (case-insensitive) for explicit markers:
      - If it contains `BREAKING CHANGE` or a clear `MAJOR` marker → use `major`.
      - Else if it contains a clear `MINOR` marker → use `minor`.
      - Else if it only contains `PATCH` or no marker at all → keep `patch`.
    - If the user passes an explicit bump type argument, validate it against `patch | minor | major | none` and override the inferred value. `none` means "no version bump" while still allowing a change file to be written if Rush supports it.

4.  **Construct the Rush change message (no git history)**:
    - Build a single-line message using the spec id and the inferred summary, for example:
      - `update changes for <spec-id>: <summary sentence>`
    - If the user provided an explicit message argument, prefer that over the inferred one.
    - Do **not** analyze git commit history, file diffs, or `common/changes` contents when constructing this message; the only semantic source is `specs/<spec-id>/`.

5.  **Execute Rush change (no push, no extra commits)**:
    - From the repository root, call Rush in bulk mode, for example:
      - `rush change --bulk --bump-type <inferred-or-override> --message "<message>"`
    - This command is responsible only for generating or updating change files under `common/changes/`.
    - It **must not**:
      - Push any branch.
      - Create additional commits.
      - Modify documentation-only changelog files.

6.  **Report outputs (spec-centric)**:
    - Echo the resolved values:
      - Feature id / spec directory.
      - Paths to `plan.md` and `requirements.md` used.
      - The final `bumpType` and `message`.
    - Optionally, list the `common/changes/*.json` files created or updated by this run (for example, by inspecting the directory or `git status`).
    - Ensure the final message is compatible with the repository's `commitlint` conventions when reused downstream by `/speckit.commit`.
