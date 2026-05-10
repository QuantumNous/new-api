---
name: classic-to-default-sync
description: Inspect a given commit's web/classic changes and sync all features/fixes to web/default. Use when the user provides a commit ID and wants to audit whether web/default already has the same features as web/classic, port missing features, improve suboptimal implementations, fix bugs, and remove redundant code. Trigger phrases include: "/classic-to-default-sync <hash>", "classic-to-default-sync <hash>", "sync classic to default", "port from classic", "compare classic commit", "classic 和 default 对比", "把这次 classic 的修改同步到 default", "查看这次提交 classic 中的修改并同步", or any request supplying a commit hash together with classic/default comparison intent.
---

# Classic-to-Default Sync

Given a **commit ID**, audit all `web/classic` changes and ensure `web/default` reaches feature parity with the best possible implementation.

## Input

The user must supply a `<commit-id>`.

## Workflow

### Step 1 — Extract classic diff

```bash
git show <commit-id> -- web/classic
```

Read every changed file in `web/classic`. Identify the **logical changes** (new features, UI/UX improvements, bug fixes, config tweaks, removed dead code, etc.) — not just line diffs.

### Step 2 — Map to default counterparts

For each logical change found in Step 1, locate the equivalent file(s) in `web/default/src/`. Use Glob/Grep/SemanticSearch as needed. Consider that:

- `web/classic` uses **React 18 + Vite + Semi Design**
- `web/default` uses **React 19 + Rsbuild + Base UI + Tailwind CSS**
- Component names, file paths, and API shapes may differ; match by **functionality**, not filename.

### Step 3 — Triage each change

Classify every logical change as one of:

| Status | Meaning |
|--------|---------|
| ✅ Already present & optimal | No action needed |
| ⚠️ Present but suboptimal | Improve: logic, layout, style, or code quality |
| ❌ Missing | Implement from scratch in default's stack |

### Step 4 — Implement

For each **⚠️** or **❌** item:

1. **Read the target file(s) in `web/default`** before editing (required by project conventions).
2. Implement using `web/default` conventions:
   - React 19 patterns (hooks, Suspense, etc.)
   - Base UI primitives where applicable
   - Tailwind CSS for styling (no inline styles or Semi Design imports)
   - `useTranslation()` + `t('English key')` for all user-visible strings
   - TypeScript — explicit types, no `any`
   - No dead code, no redundant comments
3. Follow **Rule 6** (pointer types for optional relay DTOs) if touching relay-related TS types.
4. After editing, run `ReadLints` on changed files and fix any introduced lint errors.

### Step 5 — i18n

If any new user-visible strings were added, run the i18n sync:

```bash
cd web/default && bun run i18n:sync
```

Then add missing translations for all supported locales (en, zh, fr, ja, ru, vi) following the **i18n-translate** skill.

### Step 6 — Report

Summarise the work in a concise table:

| # | Change (from classic commit) | Status | Action taken |
|---|------------------------------|--------|--------------|
| 1 | … | ✅ / ⚠️ / ❌ | None / Improved / Implemented |

If every item is ✅ with no action needed, simply reply: **"已完成 — web/default 已具备此次提交的所有功能，且实现质量良好，无需修改。"**

## Quality bar

- No unused imports, variables, or components
- No commented-out code left behind
- Consistent naming with surrounding `web/default` code
- All interactive elements accessible (keyboard nav, ARIA labels where Radix doesn't provide them automatically)
- No regressions: existing behaviour in `web/default` must not break
