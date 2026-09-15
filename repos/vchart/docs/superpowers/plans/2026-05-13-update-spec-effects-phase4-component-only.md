# updateSpec Effects Phase 4 Component-only Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:test-driven-development for behavior changes and superpowers:verification-before-completion before reporting completion.

**Goal:** Let component-only update effects stop before unrelated series/data/domain stages while still allowing layout/render work when the component needs it.

**Scope:** Start with title text-only updates. Do not change title visible/orient remake behavior in this step.

**Architecture:** Components can return `effects.component` with optional `effects.layout` and `effects.render`. Chart-level updateSpec should treat this as a scoped component update when no remake/compile/data/series/domain effects or legacy global flags are present.

---

### Task 1: Lock Title Component-only Behavior

**Files:**
- Modify: `packages/vchart/__tests__/unit/core/update-effects.test.ts`

- [x] **Step 1: Add a titled bar spec helper**

Create a small bar spec with a visible title and stable data/fields.

- [x] **Step 2: Add a regression test**

The test should:

1. Render the initial spec.
2. Spy on the first series `reInit`.
3. Spy on chart `updateDataSpec` and `updateGlobalScaleDomain`.
4. Update only `title.text`.
5. Assert render still runs.
6. Assert series/data/domain stages do not run.

### Task 2: Add Component-only Effect Predicate

**Files:**
- Modify: `packages/vchart/src/chart/util.ts`

- [x] **Step 1: Add a pure component-only predicate**

The predicate must not mutate `result.effects`. It should allow component-local `layout`/`render`, and reject remake/compile/data/scaleDomain/series plus legacy global flags.

### Task 3: Route Component-only Results In BaseChart

**Files:**
- Modify: `packages/vchart/src/chart/base/base-chart.ts`

- [x] **Step 1: Import the component-only predicate**

- [x] **Step 2: Stop after component update when the result is component-only**

After the existing local-only check, return before `updateSeriesSpec`, `reInit`, `updateDataSpec`, and `updateGlobalScaleDomain`.

- [x] **Step 3: Preserve layout dirtying for component layout effects**

Set the chart layout tag when `effects.layout` is present.

### Task 4: Emit Title Effects

**Files:**
- Modify: `packages/vchart/src/component/title/title.ts`

- [x] **Step 1: Keep visible/orient behavior unchanged**

Do not alter existing remake behavior for visible/orient changes.

- [x] **Step 2: Mark non-remake title updates as component layout/render effects**

Return `effects: { component: true, layout: true, render: true }` for text/style-like title updates.

### Task 5: Verify

**Files:**
- Verify only.

- [x] **Step 1: Run focused update effects test**

```bash
cd packages/vchart
./node_modules/.bin/jest __tests__/unit/core/update-effects.test.ts --runInBand
```

- [x] **Step 2: Run related updateSpec and animation regressions**

```bash
cd packages/vchart
./node_modules/.bin/jest __tests__/unit/core/update-effects.test.ts __tests__/unit/core/update-spec.test.ts __tests__/unit/animation/manual-ticker.test.ts --runInBand
```

- [x] **Step 3: Run lint, typecheck, and diff check**

```bash
cd packages/vchart
./node_modules/.bin/eslint src/chart/base/base-chart.ts src/chart/util.ts src/component/title/title.ts __tests__/unit/core/update-effects.test.ts
./node_modules/.bin/tsc --noEmit --project tsconfig.json
git diff --check
```
