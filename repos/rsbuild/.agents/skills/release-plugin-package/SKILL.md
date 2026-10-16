---
name: release-plugin-package
description: Use when asked to create a release PR for an official Rsbuild plugin package under `packages/plugin-*`, such as `@rsbuild/plugin-react v2.1.0` or `@rsbuild/plugin-sass v2.0.0`.
---

# Release Plugin Package

## Input

- Plugin package name or short name, for example `@rsbuild/plugin-react` or `plugin-react`.
- Target version, for example `2.1.0`.

If the package or version is missing, ask for it before making changes.

## Scope

Use this skill only for official plugin packages in `packages/plugin-*`.

Do not use it for:

- `@rsbuild/core` or `create-rsbuild` releases. Use `release-core` instead.
- Publishing npm packages directly. This skill creates the release PR only.

## Changelog requirements

Every plugin release PR must update the plugin changelog:

```text
packages/plugin-<name>/CHANGELOG.md
```

If `CHANGELOG.md` does not exist, create it with `# @rsbuild/plugin-<name>` as the title.
Insert the new entry immediately below the title. If an entry for the target version already exists, update that entry instead of adding a duplicate.
Use this format:

```markdown
## <version> (<YYYY-MM-DD>)

### New features

- feat(plugin-<name>): change summary by @user in https://github.com/web-infra-dev/rsbuild/pull/<number>
```

Rules:

- Use the current date in `YYYY-MM-DD` format unless the user provides a release date.
- Do not add version compare links to version headings.
- Use `-` bullets.
- Use sentence-case section headings.
- Use this section order when sections are present: `Breaking changes`, `New features`, `Performance`, `Bug fixes`, `Refactor`, `Document`, `Other changes`.
- Add a section heading only when it has at least one bullet.
- If there are no plugin-specific changes, add `- No plugin-specific changes.` directly under the version heading and do not add `### Other changes`.
- Preserve change item wording, author, and PR URL as much as possible.
- Exclude the plugin release or version-bump PR itself from changelog items.

To collect changelog items:

1. Prefer related change PRs provided by the user or already listed in the release PR context.
2. If related PRs are missing or incomplete, inspect commits and merged PRs since the previous package version recorded before editing `package.json`.
3. Keep only changes that affect the released plugin, including:
   - files under `packages/plugin-<name>`
   - shared code, build config, or dependencies that directly affect the plugin
   - docs or template changes that are specifically about that plugin
4. Categorize items by conventional commit type:
   - `feat` -> `New features`
   - `perf` -> `Performance`
   - `fix` -> `Bug fixes`
   - `refactor` -> `Refactor`
   - `docs` -> `Document`
   - breaking changes marked with `!` or `BREAKING CHANGE` -> `Breaking changes`
   - everything else -> `Other changes`

## Workflow

1. Check the worktree:

   ```bash
   git status --short
   git branch --show-current
   ```

   If there are uncommitted edits, stop and ask the user how to proceed.

2. Resolve the package directory:

   - `@rsbuild/plugin-react` -> `packages/plugin-react`
   - `plugin-react` -> `packages/plugin-react`

   Confirm that `packages/plugin-<name>/package.json` exists and its `name` field matches the target package.
   Record the current package `version` before editing it; use that as the previous package version for changelog collection unless the user provides a different baseline.

3. Create and switch to a dedicated branch if the current branch is the default branch. Prefer:

   ```text
   release/plugin-<name>-v<version>
   ```

4. Update only the plugin package version first:

   ```text
   packages/plugin-<name>/package.json
   ```

5. Update `packages/plugin-<name>/CHANGELOG.md` for the target version using the changelog requirements above.

6. Sync `create-rsbuild` template dependency versions only when that plugin appears in template `package.json` files:

   ```bash
   rg -n '@rsbuild/plugin-<name>' packages/create-rsbuild --glob 'package.json'
   ```

   Update matching template dependency ranges to `^<version>`. Do not change `workspace:*` dev dependencies in `packages/create-rsbuild/package.json`.

7. Review the diff and confirm it is limited to:

   - the released plugin package version
   - the released plugin changelog
   - matching `packages/create-rsbuild/template-*/package.json` dependency ranges, if any

   If other files changed, stop and explain the unexpected diff.

8. Validate JSON and run focused checks:

   ```bash
   node -e "for (const f of process.argv.slice(1)) JSON.parse(require('fs').readFileSync(f, 'utf8'))" <edited-package-json-files>
   node --run check-spell
   pnpm --filter @rsbuild/plugin-<name> run build
   ```

   If `create-rsbuild` templates changed, also run `pnpm build` once and then the focused create-rsbuild e2e case when practical:

   ```bash
   pnpm build
   pnpm e2e create-rsbuild
   ```

   Report any skipped validation in the final response.

9. Commit with this exact title:

   ```text
   release: @rsbuild/plugin-<name> v<version>
   ```

10. Push the branch after re-checking it is not the default branch.

11. If running in Codex, create the PR with the GitHub connector/plugin. Otherwise, use the GitHub workflow available in the current environment.

## PR Body

Use the repository PR template. Keep the body concise.

For `Summary`, use:

```markdown
Release `@rsbuild/plugin-<name>` v<version>.
```

If related change PRs were provided or can be confidently identified, add a `Changes` section:

```markdown
## Changes

- https://github.com/web-infra-dev/rsbuild/pull/<number>
- https://github.com/web-infra-dev/rsbuild/pull/<number>
```

Use the same related change PRs that were added to the changelog. Do not invent change links.
If no related links are known, omit `Changes` instead of adding an empty section.
