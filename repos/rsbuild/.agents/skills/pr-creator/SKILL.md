---
name: pr-creator
description: Use when asked to create a pull request for this repository. It helps the PR follow the repository's branch safety rules, title convention, pull request template, and concise English writing style.
metadata:
  internal: true
---

# Pull Request Creator

## Steps

1. Confirm the current branch with `git branch --show-current`.
   If it is the default branch, create and switch to a new branch before doing anything else.
   Use a descriptive branch name, preferably `feat-<topic>` or `fix-<topic>`.

2. Review local changes with `git status --short`.
   Do not revert unrelated user changes.
   Before creating the PR, ensure the intended changes are committed and never commit directly on the default branch.

3. If `.github/PULL_REQUEST_TEMPLATE.md` exists, read it and follow its structure.

4. Draft the PR title in the repository's standard format. If the repository uses Conventional Commits, common patterns include:
   - `feat(core): add ...`
   - `fix(types): ...`
   - `docs: ...`
   - `refactor(types): ...`
   - `chore(ci): ...` for CI workflow, check, or release automation changes
   - `chore(deps): ...`
   - `release: v1.2.0`

5. Write the PR body in concise, clear English.
   - In `Summary`, explain the change context first: the user-facing problem, maintenance goal, or compatibility constraint that makes the change necessary.
   - Prioritize high-signal information: public API changes, behavior changes, breaking changes, migration notes, and important compatibility implications.
   - Then describe the main implementation change only as much as needed to understand the review.
   - Keep the PR body concise and review-oriented: use 1-4 short standalone sentences for typical changes, covering why it matters, what changed, and any reviewer-important impact.
   - Avoid low-signal sections such as `Test plan` or `Validation`, routine verification commands, generated file lists, or obvious implementation details unless the repository template explicitly requires them or the change has unusual validation risk.
   - Good background examples:
     - `This PR adds support for custom logger injection so CLI output can be isolated per instance.`
     - `This PR fixes incorrect padding in URL labels to keep terminal output aligned across different label lengths.`
     - `This PR updates the English docs to clarify how the extraction option works and when to enable it.`

6. Fill `Related Links` with issue links, design docs, related PRs, or discussion pages.
   If the PR upgrades an npm dependency, add a link to the upgraded version's release notes or tag page when available.
   Example: `https://github.com/web-infra-dev/rspack/releases/tag/v1.0.0`
   If there is no relevant link, omit the entire `Related Links` section from the PR body.

7. Push the branch only after re-checking the branch name. Never push the default branch directly.

8. Create the PR.
   When running in Codex, use the Codex GitHub connector/plugin for GitHub operations.
   Use `gh pr create` only as a fallback when the connector is unavailable.

## Constraints

- Do not modify code while following this skill.
