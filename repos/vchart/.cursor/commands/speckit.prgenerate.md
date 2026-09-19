---
description: 'Generate a PR body using the GitHub pull request template and specs/<spec-id>/plan.md; default to the English template and write to .trae/output/pr.body.local.md.'
handoffs:
  - label: 'Create Pull Request'
    agent: 'speckit.prcreate'
    prompt: 'Create the GitHub Pull Request using the generated body'
    send: true
---

## User Input

```text
$ARGUMENTS
```

You **MUST** consider the user input before proceeding (if not empty), but treat it only as CLI-style flags (for example, `--lang`, `--out`); the PR content itself must be inferred from the specs directory, not from free-form user text.

## Outline

1.  **Determine template and feature context (specs-only)**:
    - Treat this command as zero-input by default: if `$ARGUMENTS` is empty, it still must be able to generate a useful PR body.
    - Parse `$ARGUMENTS` only for CLI-style options (for example, `--lang`, `--out`):
      - If `--lang zh` is present, use the Chinese template at `.github/PULL_REQUEST_TEMPLATE/pr_cn.md`.
      - Otherwise, use the English template at `.github/PULL_REQUEST_TEMPLATE.md` (the default; **do not** auto-detect language).
      - If an explicit output path is provided (for example, `--out specs/001-foo/PR_BODY.md`), respect it; otherwise, default to `.trae/output/pr.body.local.md`.
    - Resolve `specs/<spec-id>/` by deriving the numeric prefix from the current branch name and matching it to a directory under `specs/` whose name starts with that prefix.
    - From that directory, resolve `plan.md` as the primary context source for the PR.

2.  **Extract PR content from specs**:
    - From `plan.md`, read the `## Summary` section and take the first non-empty line as the high-level description of the change.
    - Read the `## Technical Context` section and remove any template-only comments, keeping only the concrete technical details.
    - Combine these into a structured background text:
      - When both are present: `Summary` paragraph followed by a blank line and the `Technical Context` content.
      - When only Summary exists: use Summary alone.
      - When neither exists: fall back to a short line like `Update for <spec-id>` derived from the spec directory name.
    - Optionally infer a coarse change type (`feat`, `fix`, `docs`, `perf`, `refactor`, `test`, `chore`) from the Summary/Technical Context using the same keyword mapping as `/speckit.commit`.

3.  **Apply type to the template checklist (no structural changes)**:
    - Load the chosen PR template as raw markdown and preserve its structure, comments, and placeholders (including any `copilot:summary` markers).
    - Locate the section headed `### 🤔 This is a ...` (English) or `### 🤔 这个分支是...` (Chinese).
    - Within that section:
      - Reset all checklist bullets to unchecked (`- [ ] ...`).
      - Identify the line whose label best matches the inferred type (for example, `New feature`, `Bug fix`, `Site / documentation update`, etc.).
      - Mark exactly that line as checked (`- [x] ...`).
    - Do **not** add, remove, or reorder any checklist items.

4.  **Fill “Background and solution” from specs**:
    - For the English template:
      - Locate the `### 💡 Background and solution` heading.
      - Keep any inline instructions or comments that live directly under the heading (for example, explanatory HTML comments).
      - After those instructions, insert the combined background text built from Summary + Technical Context.
    - For the Chinese template:
      - Locate the `### 💡 问题的背景&解决方案` heading and apply the same approach.
    - The inserted text should quote and lightly reformat the spec content but should not invent new requirements or implementation details.

5.  **Fill the Changelog table (English-only content)**:
    - Locate the `### 📝 Changelog` section and the language table beneath it.
    - Replace the `🇺🇸 English` row’s description cell with a concise English summary derived from the Summary sentence (trimmed to a reasonable length if necessary).
    - Leave the `🇨🇳 Chinese` row untouched for the English template; for the Chinese template, you may mirror the same summary there or leave it as a placeholder, depending on the template’s expectations.
    - Preserve all table headers, column layout, and any additional rows or comments around the table.

6.  **Write PR body file without touching templates**:
    - Render the updated markdown content (with checklist, background, and Changelog injected) into a single PR body string.
    - Write this string to the resolved output path (default `.trae/output/pr.body.local.md`), creating parent directories if needed.
    - Do **not** modify the original template files under `.github/`.

7.  **Validation checklist**:
    - Confirm that the output PR body file exists and is non-empty.
    - Confirm that the output PR body file maintains the integrity of the template content, with no additional or deleted part.
    - Verify that:
      - The “This is a …” / “这个分支是...” section is still present and exactly one checkbox is selected.
      - The “Background and solution” / “问题的背景&解决方案” section now references the feature in terms consistent with `plan.md`.
      - The Changelog table still renders correctly and has an updated `🇺🇸 English` row.
      - Any special placeholders (for example, `copilot:summary`) remain intact and in their original locations.
    - Ensure that no content was sourced from git logs, `common/changes`, or `.trae/output`; all semantics must come from the `specs` directory and the chosen PR template.
