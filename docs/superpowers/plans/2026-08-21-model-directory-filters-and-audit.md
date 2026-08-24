# Model Directory Filters and Production Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the staging `/models` filters follow the approved single-select, upper-bound context, and displayed-price rules, then generate a read-only production metadata completeness report.

**Architecture:** Extend the existing staging filter pipeline instead of creating a parallel system. `home-models.ts` remains the owner of final displayed pricing, `model-directory-filters.ts` consumes normalized numeric fields, `model-directory-url.ts` owns single-select URL normalization, and a new pure audit library plus thin Bun CLI compares production pricing data with static filter metadata without mutating production.

**Tech Stack:** Next.js 16, React 19, TypeScript 6, Bun test/runtime, Tailwind CSS 4, public `/api/website/pricing` data.

---

## File map

- Modify `website/src/lib/model-directory-filters.ts`: upper-bound context matching and effective filter-price row fields.
- Modify `website/src/lib/model-directory-filters.test.ts`: context, price-unit, URL, and single-select regression coverage.
- Modify `website/src/lib/model-directory-url.ts`: context/distillable replacement semantics and legacy normalization.
- Modify `website/src/lib/home-models.ts`: expose numeric final display/input/output price fields and normalized billing unit.
- Modify `website/src/lib/home-models-plg-pricing.test.ts`: prove numeric fields match displayed prices for token, request, and second billing.
- Modify `website/src/components/models-directory.tsx`: pass numeric normalized prices directly into filter rows.
- Modify `website/src/components/models-filter-sidebar.tsx`: make collapsed groups inert and hidden from assistive technology.
- Create `website/src/components/models-filter-sidebar.test.tsx`: collapsed/expanded accessibility regression tests.
- Create `website/src/lib/model-directory-audit.ts`: pure production completeness audit and JSON/Markdown rendering.
- Create `website/src/lib/model-directory-audit.test.ts`: deterministic audit and report tests.
- Create `website/scripts/audit-model-directory-metadata.ts`: read-only production fetch and report writer.
- Modify `website/package.json`: add the `audit:model-directory` script.
- Generate `website/reports/model-directory/production-model-directory-audit.json` and `.md`: operator-review artifacts from the production read-only catalog.

### Task 1: Lock and implement single-select filter semantics

**Files:**
- Modify: `website/src/lib/model-directory-filters.test.ts`
- Modify: `website/src/lib/model-directory-filters.ts`
- Modify: `website/src/lib/model-directory-url.ts`

- [ ] **Step 1: Replace the old context regression with upper-bound and invalid-value cases**

Add assertions equivalent to:

```ts
test("context length is a single upper-bound filter", () => {
  const filters = { ...EMPTY_DIRECTORY_FILTERS, context: [200_000] };
  expect(filterDirectoryRows([row({ name: "small", contextTokens: 128_000 })], filters)).toHaveLength(1);
  expect(filterDirectoryRows([row({ name: "exact", contextTokens: 200_000 })], filters)).toHaveLength(1);
  expect(filterDirectoryRows([row({ name: "large", contextTokens: 400_000 })], filters)).toHaveLength(0);
  expect(filterDirectoryRows([row({ name: "zero", contextTokens: 0 })], filters)).toHaveLength(0);
  expect(filterDirectoryRows([row({ name: "unknown", contextTokens: null })], filters)).toHaveLength(0);
});
```

- [ ] **Step 2: Add URL normalization and replacement tests**

Add tests that prove:

```ts
expect(parseDirectorySearch({ context: "8192,200000" }).context).toEqual([8192]);
expect(parseDirectorySearch({ distillable: "false,true" }).distillable).toEqual([false]);

const contextSelected = toggleDirectoryFilter(EMPTY_DIRECTORY_FILTERS, "context", 128000);
expect(toggleDirectoryFilter(contextSelected, "context", 200000).context).toEqual([200000]);
expect(toggleDirectoryFilter(contextSelected, "context", 128000).context).toEqual([]);

const distillableSelected = toggleDirectoryFilter(EMPTY_DIRECTORY_FILTERS, "distillable", true);
expect(toggleDirectoryFilter(distillableSelected, "distillable", false).distillable).toEqual([false]);
```

- [ ] **Step 3: Run the focused tests and verify they fail for the old behavior**

Run:

```bash
cd website
bun test src/lib/model-directory-filters.test.ts
```

Expected: failures identify lower-bound context behavior, legacy multi-value parsing, and append-style toggling.

- [ ] **Step 4: Implement the minimal matching and URL changes**

In `matchesGroup` use the sole normalized context value as an upper bound:

```ts
const [selected] = filters.context;
if (selected == null) return true;
return row.contextTokens != null && Number.isFinite(row.contextTokens) && row.contextTokens > 0 && row.contextTokens <= selected;
```

In `parseDirectorySearch`, normalize `context` and `distillable` with `.slice(0, 1)`. In `toggleDirectoryFilter`, route `context` and `distillable` through replacement behavior:

```ts
const SINGLE_SELECT_KEYS = new Set<DirectoryFilterKey>(["context", "distillable"]);
const next = current.includes(value)
  ? current.filter((item) => item !== value)
  : SINGLE_SELECT_KEYS.has(key)
    ? [value]
    : [...current, value];
```

- [ ] **Step 5: Run the focused tests and verify they pass**

Run `cd website && bun test src/lib/model-directory-filters.test.ts`.

Expected: all filter, facet, sorting, URL, and metadata tests in the file pass.

- [ ] **Step 6: Commit the single-select behavior**

Stage only the three task files and commit with a Lore-formatted message whose `Tested:` trailer records the focused Bun test.

### Task 2: Make filter prices identical to the displayed final price

**Files:**
- Modify: `website/src/lib/home-models.ts`
- Modify: `website/src/lib/home-models-plg-pricing.test.ts`
- Modify: `website/src/lib/model-directory-filters.ts`
- Modify: `website/src/lib/model-directory-filters.test.ts`
- Modify: `website/src/components/models-directory.tsx`

- [ ] **Step 1: Add numeric pricing fields to the row-shaping tests**

Extend the existing PLG pricing fixtures so they assert:

```ts
expect(tokenRow).toMatchObject({
  billingUnit: "token",
  inputFilterUsd: tokenRowExpectedInput,
  outputFilterUsd: tokenRowExpectedOutput,
});
expect(requestRow).toMatchObject({
  billingUnit: "request",
  inputFilterUsd: requestRow.discountedUsd,
  outputFilterUsd: requestRow.discountedUsd,
});
expect(secondRow).toMatchObject({
  billingUnit: "second",
  inputFilterUsd: secondRow.discountedUsd,
  outputFilterUsd: secondRow.discountedUsd,
});
```

Use the fixture's resolved numeric prices, not parsed localized strings.

- [ ] **Step 2: Add filter-engine tests for all billing units and missing values**

Create rows with `inputUsd` and `outputUsd` in boundary bands and assert that token prices filter independently while request/second rows place the same final display price into both bands. Add null, negative, and `Number.NaN` cases that match only while price filters are inactive.

- [ ] **Step 3: Run both focused tests and verify the new expectations fail**

Run:

```bash
cd website
bun test src/lib/home-models-plg-pricing.test.ts src/lib/model-directory-filters.test.ts
```

Expected: failures report missing billing/numeric filter fields or incorrect request/second output filtering.

- [ ] **Step 4: Extend `HomePricedModel` and `buildRowsForModels`**

Add:

```ts
type BillingUnit = "token" | "request" | "second";

billingUnit?: BillingUnit;
inputFilterUsd?: number;
outputFilterUsd?: number;
```

Resolve the unit from the same display-pricing result used by the table. For token rows use numeric `inputPrice?.value` and `outputPrice?.value`; for request/second rows assign `discountedUsd` to both filter fields. Keep `discountedUsd` as the source of truth for the final displayed hero/table price.

- [ ] **Step 5: Stop reparsing rendered price strings in `models-directory.tsx`**

Change the `buildDirectoryRow` call to pass `row.inputFilterUsd` and `row.outputFilterUsd`. Remove `parseUsd` when it has no remaining callers. Preserve `officialUsd` for discount sorting.

- [ ] **Step 6: Keep price banding strict and non-overlapping**

Use `priceBandFor` for normalized numeric values. Keep zero, negative, null, undefined, and non-finite values unpriced; do not convert token/request/second units.

- [ ] **Step 7: Run the focused tests and verify they pass**

Run `cd website && bun test src/lib/home-models-plg-pricing.test.ts src/lib/model-directory-filters.test.ts`.

Expected: all targeted pricing and filter tests pass.

- [ ] **Step 8: Commit displayed-price parity**

Stage only the five task files and commit with `Tested:` listing both focused test files.

### Task 3: Remove collapsed filter options from the accessibility tree

**Files:**
- Create: `website/src/components/models-filter-sidebar.test.tsx`
- Modify: `website/src/components/models-filter-sidebar.tsx`

- [ ] **Step 1: Write the failing server-render accessibility test**

Render `ModelsFilterSidebar` with one closed and one open group using `renderToStaticMarkup`. Assert that the closed content wrapper has `aria-hidden="true"` and `inert`, while the open wrapper has neither hidden state. Also assert the disclosure buttons expose `aria-expanded="false"` and `aria-expanded="true"` respectively.

- [ ] **Step 2: Run the test and verify it fails**

Run `cd website && bun test src/components/models-filter-sidebar.test.tsx`.

Expected: the closed wrapper lacks `aria-hidden` and `inert`.

- [ ] **Step 3: Add semantic collapsed state without changing the labels or layout**

On the animated content wrapper add:

```tsx
aria-hidden={!isOpen}
inert={!isOpen}
```

Keep the existing zero-row/opacity transition and chip `tabIndex` handling so visual behavior remains stable.

- [ ] **Step 4: Run the focused test and verify it passes**

Run `cd website && bun test src/components/models-filter-sidebar.test.tsx`.

Expected: all sidebar accessibility assertions pass.

- [ ] **Step 5: Commit the accessibility repair**

Stage the component and its test, then commit with the focused test in `Tested:`.

### Task 4: Build the read-only production metadata audit

**Files:**
- Create: `website/src/lib/model-directory-audit.ts`
- Create: `website/src/lib/model-directory-audit.test.ts`
- Create: `website/scripts/audit-model-directory-metadata.ts`
- Modify: `website/package.json`

- [ ] **Step 1: Write deterministic audit-library tests**

Cover these fixtures:

```ts
expect(auditCompleteFixture().issues).toEqual([]);
expect(issueStatuses(missingFixture())).toEqual(["missing"]);
expect(issueStatuses(invalidPriceFixture())).toEqual(["invalid"]);
expect(issueStatuses(unknownModelFixture())).toEqual(["unknown-model"]);
expect(issueStatuses(staleMetadataFixture())).toEqual(["stale-metadata"]);
```

Also assert that Markdown contains `No production writes were performed`, JSON preserves `reviewStatus: "pending"`, and suggestions are absent when no trusted source exists.

- [ ] **Step 2: Run the audit test and verify it fails because the module is absent**

Run `cd website && bun test src/lib/model-directory-audit.test.ts`.

Expected: import/module-not-found failure.

- [ ] **Step 3: Implement the pure audit library**

Export focused types and functions:

```ts
export type AuditIssueStatus = "missing" | "invalid" | "unknown-model" | "stale-metadata";
export type AuditIssue = { modelId: string; modelName: string; field: string; status: AuditIssueStatus; currentValue: unknown; suggestedValue?: unknown; suggestedSource?: string; confidence?: "high" | "medium" | "low"; affectedFilters: string[]; backfillSqlEligible: boolean; reviewStatus: "pending" };
export type ModelDirectoryAuditReport = { generatedAt: string; source: string; modelCount: number; metadataCount: number; issues: AuditIssue[]; wroteProduction: false };
export function auditModelDirectoryCatalog(input: AuditInput): ModelDirectoryAuditReport;
export function renderModelDirectoryAuditMarkdown(report: ModelDirectoryAuditReport): string;
```

Audit live model coverage, author, providers, modalities, explicit/null context, billing unit, effective prices, series, categories, release date, distillable, unknown models, and stale metadata. Use exact model names. Permit `contextTokens: null` when an explicit metadata entry marks it not applicable; treat a missing metadata entry as unknown rather than guessing every field.

- [ ] **Step 4: Implement a thin read-only Bun CLI**

The script must:

```ts
const origin = process.env.APP_CONSOLE_ORIGIN;
if (!origin) throw new Error("APP_CONSOLE_ORIGIN is required");
const response = await fetch(new URL("/api/website/pricing", origin), { headers: { accept: "application/json" } });
if (!response.ok) throw new Error(`pricing fetch failed: ${response.status}`);
```

It then builds the same display rows as the directory, runs the pure audit, and writes JSON plus Markdown under `MODEL_DIRECTORY_AUDIT_OUT_DIR` (default `reports/model-directory`). It must contain no mutation endpoint, SQL execution, or database client.

- [ ] **Step 5: Add the package script**

Add:

```json
"audit:model-directory": "bun scripts/audit-model-directory-metadata.ts"
```

- [ ] **Step 6: Run the audit tests and verify they pass**

Run `cd website && bun test src/lib/model-directory-audit.test.ts`.

Expected: complete, missing, invalid, unknown, stale, JSON, and Markdown cases pass.

- [ ] **Step 7: Commit the audit library and CLI**

Stage the library, test, CLI, and package script. Commit with a directive that the command must remain production-read-only.

### Task 5: Generate the production report and complete verification

**Files:**
- Generate: `website/reports/model-directory/production-model-directory-audit.json`
- Generate: `website/reports/model-directory/production-model-directory-audit.md`
- Modify only if verification exposes a defect: files from Tasks 1-4 and their tests.

- [ ] **Step 1: Run the production read-only audit**

Run from `website/` with the public production console origin:

```bash
APP_CONSOLE_ORIGIN=https://console.flatkey.ai bun run audit:model-directory
```

Expected: exit code 0, two report files written, and explicit output stating that no production write occurred. The command must not request credentials or call a mutation endpoint.

- [ ] **Step 2: Inspect the report for completeness and unsafe claims**

Confirm model totals, issue totals, affected filters, current values, suggested values/sources/confidence, and `reviewStatus: pending`. Confirm the Markdown states that the operator must review before any database update.

- [ ] **Step 3: Run all targeted tests**

Run:

```bash
cd website
bun test src/lib/model-directory-filters.test.ts src/lib/home-models-plg-pricing.test.ts src/components/models-filter-sidebar.test.tsx src/lib/model-directory-audit.test.ts
```

Expected: all targeted tests pass.

- [ ] **Step 4: Run full website verification**

Run:

```bash
cd website
bun test
bun run lint
bun run typecheck
bun run build
```

Expected: every command exits 0. Existing unrelated failures must be recorded with exact output and separated from regressions introduced by this work.

- [ ] **Step 5: Browser-check the local English and Chinese model directories**

Start the site on port 4000 with a staging-safe console origin, then verify `/models` and `/zh/models`: context selection replaces, upper-bound results update, distillable replaces, request/second rows match both price groups, URL reload restores state, reset clears state, mobile disclosure works, and collapsed groups expose no hidden options to keyboard or accessibility snapshots.

- [ ] **Step 6: Commit the reviewed audit artifacts and any verification repair**

Stage only the two generated reports plus necessary verified fixes. Commit with `Tested:` listing targeted tests, full test/lint/typecheck/build, and browser checks; use `Not-tested:` only for a concrete remaining gap.

- [ ] **Step 7: Final code review and completion evidence**

Run a comprehensive diff review against the design, confirm no production write path exists, confirm only `newapi-web` needs deployment, and report the audit artifact paths plus the exact verification evidence.
