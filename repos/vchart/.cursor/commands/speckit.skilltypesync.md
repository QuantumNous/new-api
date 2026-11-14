---
description: "After feature development, detect user-config/API changes and synchronize skill type resources under skills/vchart-development-assistant/references/type-meta and type-details."
---

## User Input

```text
$ARGUMENTS
```

You **MUST** consider user input if provided. Treat it as optional CLI-style overrides only (for example: `--base develop`, `--force`, `--types ILabelSpec,IData`).

## Outline

1. **Resolve diff scope**:
   - Default base branch is `develop`.
   - If `$ARGUMENTS` contains `--base <branch>`, use that branch as comparison base.
   - Collect changed files from:
     - staged + unstaged local changes, and
     - branch diff against base (`<base>...HEAD`).
   - De-duplicate all changed paths.

2. **Determine whether sync is required**:
   - Mark as **requires sync** when changes affect user-facing configuration or API/type definitions, including (but not limited to):
     - `packages/vchart/src/typings/**`
     - `packages/vchart/src/chart/**/interface/**`
     - `packages/vchart/src/component/**/interface/**`
     - `packages/vchart/src/series/**/interface/**`
     - `packages/vchart/src/theme/**`
     - any public API or option schema files referenced by VChart docs.
   - If no matching files and no `--force`, stop with a clear summary: "No user config/API changes detected, skill type sync skipped."

3. **Identify impacted type entities**:
   - From changed TypeScript definitions, extract impacted type/interface names (for example `ILabelSpec`, `IData`, `ITheme`).
   - Build two impact sets:
     - **Meta impact**: chart/common entries that need `type-meta/*.json` updates.
     - **Detail impact**: concrete types needing `type-details/*-Type-Definition.md` updates.
   - If `$ARGUMENTS` includes `--types`, merge explicit type names into the detail impact set.

4. **Update `type-meta` resources**:
   - Target directory: `skills/vchart-development-assistant/references/type-meta/`.
   - For each impacted chart/common meta file:
     - sync user-visible property paths,
     - sync `required` flags,
     - sync `type` and `isSimple` fields,
     - remove stale keys that no longer exist in source typings.
   - Keep JSON valid and stable (no duplicated keys, deterministic field ordering where possible).

5. **Update `type-details` resources**:
   - Target directory: `skills/vchart-development-assistant/references/type-details/`.
   - For each impacted type:
     - create or update `[TypeName]-Type-Definition.md` (for example `ILabelSpec-Type-Definition.md`),
     - ensure definitions reflect latest fields, value types, optional/required semantics, and usage notes,
     - include concise, runnable-style code examples that match current VChart API behavior.
   - Keep naming aligned with `references/FILE_NAMING_CONVENTIONS.md`.

6. **Consistency checks**:
   - Verify every complex type referenced in `type-meta` (`isSimple: false`) has a corresponding `type-details` document.
   - Verify removed/renamed types no longer leave broken references in `type-meta`.
   - Validate JSON syntax for all changed files under `type-meta`.
   - Ensure Markdown files under `type-details` are non-empty and include the target type name in title/content.

7. **Output report**:
   - Print:
     - base branch used,
     - whether sync was triggered by auto-detection or `--force`,
     - changed source files that triggered sync,
     - updated `type-meta` files,
     - updated `type-details` files,
     - unresolved gaps (if any manual follow-up is required).
   - If unresolved gaps exist, fail with actionable errors instead of silently succeeding.

## Notes

- This command only synchronizes skill reference assets; it does not commit, push, or create PR content.
- Preferred execution point is after implementation is complete and before `/speckit.changelog` or `/speckit.aftercode`.
