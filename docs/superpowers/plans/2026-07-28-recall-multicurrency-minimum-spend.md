# Recall Multi-Currency Minimum Spend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Recall minimum spend optional, then require operator-entered USD, INR, BRL, and JPY thresholds when enabled so every supported checkout currency is evaluated correctly.

**Architecture:** Add a canonical optional `minimum_spend` object to `discount_config`, while dual-writing the USD legacy fields for rolling-deploy compatibility. Keep exact-currency eligibility and Stripe `restrictions.currency_options` mapping in the service adapter; keep human-readable major-unit entry and field-level validation in the React editor.

**Tech Stack:** Go 1.22, stripe-go v86, React 19, TypeScript 6, React Hook Form, Zod 4, Bun test runner.

---

## File Structure

- `service/recall_contract.go`: canonical backend minimum-spend types.
- `service/recall_campaign.go`: draft normalization, legacy compatibility, and validation entry point.
- `service/recall_stripe.go`: authoritative normalization, Stripe request mapping, and persisted Promotion Code reconciliation.
- `service/recall_claim.go`: exact checkout-currency threshold selection.
- `service/recall_campaign_test.go`: persistence and compatibility regression tests.
- `service/recall_stripe_test.go`: validation, Stripe request, and reconciliation tests.
- `service/recall_claim_test.go`: USD/INR/BRL/JPY and fail-closed eligibility tests.
- `web/default/src/features/recall-campaigns/types.ts`: frontend canonical draft type.
- `web/default/src/features/recall-campaigns/helpers.ts`: new-draft defaults, legacy hydration, submit dual-write, and major/minor conversion reuse.
- `web/default/src/features/recall-campaigns/schemas.ts`: exact four-currency field validation.
- `web/default/src/features/recall-campaigns/components/campaign-offer-validity-fields.tsx`: optional control and four operator inputs.
- `web/default/src/features/recall-campaigns/components/campaign-editor.tsx`: default form state and discount-type transitions.
- Matching `*.test.go`, `*.test.ts`, and `*.test.tsx` files: behavior-first regression coverage.

### Task 1: Backend Contract and Normalization

**Files:**
- Modify: `service/recall_contract.go`
- Modify: `service/recall_campaign.go`
- Test: `service/recall_campaign_test.go`

- [ ] **Step 1: Write failing normalization tests**

Add table cases proving that an enabled canonical object accepts exactly these minor-unit amounts and dual-writes USD:

```go
MinimumSpend: &RecallMinimumSpendConfig{
    Enabled: true,
    Amounts: map[string]int64{
        "usd": 2000,
        "inr": 180000,
        "brl": 10000,
        "jpy": 3000,
    },
}
```

Also assert that disabled data clears the map and legacy pair, mixed-case keys normalize to lowercase, duplicate normalized keys fail, partial/extra/non-positive maps fail, and a legacy draft with no canonical object retains its original exact-currency pair.

- [ ] **Step 2: Run the tests and verify RED**

Run:

```powershell
go test ./service -run 'Test(NewAndEditableRecallMinimumAmounts|RecallCampaignMinimumSpend)' -count=1
```

Expected: FAIL because `RecallMinimumSpendConfig` and canonical normalization do not exist.

- [ ] **Step 3: Implement the minimal contract and normalization**

Add the pointer-backed compatibility boundary:

```go
type RecallMinimumSpendConfig struct {
    Enabled bool             `json:"enabled"`
    Amounts map[string]int64 `json:"amounts"`
}

type RecallDiscountConfig struct {
    // existing fields remain unchanged
    MinimumSpend *RecallMinimumSpendConfig `json:"minimum_spend,omitempty"`
}
```

Normalize keys once, require exactly `usd`, `inr`, `brl`, and `jpy` when enabled, clear both canonical amounts and legacy fields when disabled, and dual-write `MinimumAmount` plus `MinimumAmountCurrency = "usd"` from the canonical USD value. When `MinimumSpend == nil`, preserve the legacy pair unchanged.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run the Step 2 command. Expected: PASS.

- [ ] **Step 5: Commit the backend contract**

Commit only the contract, normalization, and tests with Lore trailers including the focused test command.

### Task 2: Stripe Mapping and Checkout Eligibility

**Files:**
- Modify: `service/recall_stripe.go`
- Modify: `service/recall_claim.go`
- Test: `service/recall_stripe_test.go`
- Test: `service/recall_claim_test.go`
- Test: `service/recall_worker_test.go`

- [ ] **Step 1: Write failing Stripe and runtime tests**

Assert the generated Promotion Code request contains:

```text
minimum_amount=minimum_spend.amounts.usd
minimum_amount_currency=usd
currency_options[inr].minimum_amount=minimum_spend.amounts.inr
currency_options[brl].minimum_amount=minimum_spend.amounts.brl
currency_options[jpy].minimum_amount=minimum_spend.amounts.jpy
```

Assert reconciliation accepts exactly that set and rejects missing, extra, or mismatched thresholds. Add runtime cases showing every supported currency qualifies only at or above its own threshold, and that missing/unsupported currencies return zero discount.

- [ ] **Step 2: Run the tests and verify RED**

Run:

```powershell
go test ./service -run 'TestRecall(Stripe.*MinimumSpend|ActualDiscountAmountMinor.*MinimumSpend|FirstMonthDiscountAmountMinor.*MinimumSpend)' -count=1
```

Expected: FAIL because Stripe currency options and canonical runtime lookup are not implemented.

- [ ] **Step 3: Implement exact adapter and runtime behavior**

Use USD as Stripe's deterministic base restriction and populate `Restrictions.CurrencyOptions` only for INR, BRL, and JPY. Reconcile all four values. In `calculateRecallDiscountAmountMinor`, use the canonical map when present and enabled; return zero for a missing currency or subtotal below threshold. Preserve the existing exact-match legacy branch when the canonical object is absent.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run the Step 2 command plus:

```powershell
go test ./service -run 'TestRecallStripePromotion|TestRecallWorker.*Promotion' -count=1
```

Expected: PASS.

- [ ] **Step 5: Commit the backend behavior**

Commit only Stripe/runtime changes and tests with Lore trailers including both focused commands.

### Task 3: Frontend Draft Contract and Validation

**Files:**
- Modify: `web/default/src/features/recall-campaigns/types.ts`
- Modify: `web/default/src/features/recall-campaigns/helpers.ts`
- Modify: `web/default/src/features/recall-campaigns/schemas.ts`
- Test: `web/default/src/features/recall-campaigns/helpers.test.ts`
- Test: `web/default/src/features/recall-campaigns/schemas.test.ts`

- [ ] **Step 1: Write failing helper and schema tests**

Use this frontend shape:

```ts
type RecallMinimumSpendConfig = {
  enabled: boolean
  amounts: Partial<Record<'usd' | 'inr' | 'brl' | 'jpy', number>>
}
```

Prove new drafts default to `{ enabled: false, amounts: {} }`, enabled submit data preserves all four minor-unit values and dual-writes USD, disabling clears everything, legacy data hydrates the control without guessing missing currencies, USD/INR/BRL accept at most two decimals, and JPY accepts integers only.

- [ ] **Step 2: Run the tests and verify RED**

Run from `web/default`:

```powershell
bun test src/features/recall-campaigns/helpers.test.ts src/features/recall-campaigns/schemas.test.ts
```

Expected: FAIL because `minimum_spend` is absent and the schema still enforces a single USD field.

- [ ] **Step 3: Implement defaults, compatibility, and field-level errors**

Reuse the existing major/minor conversion utilities. Canonical submit output must contain integer minor units, use errors at `discount_config.minimum_spend.amounts.<currency>`, allow minimum spend for automatic percentage, automatic fixed, and existing Coupon sources, and keep legacy single-currency drafts incomplete until the operator enters the other three values.

- [ ] **Step 4: Run the tests and verify GREEN**

Run the Step 2 command. Expected: PASS.

### Task 4: Frontend Optional Control and Four Manual Inputs

**Files:**
- Modify: `web/default/src/features/recall-campaigns/components/campaign-offer-validity-fields.tsx`
- Modify: `web/default/src/features/recall-campaigns/components/campaign-editor.tsx`
- Test: `web/default/src/features/recall-campaigns/components/campaign-offer-validity-fields.test.tsx`
- Modify: `web/default/src/i18n/locales/en.json`
- Modify: `web/default/src/i18n/locales/zh.json`
- Modify: `web/default/src/i18n/locales/fr.json`
- Modify: `web/default/src/i18n/locales/ru.json`
- Modify: `web/default/src/i18n/locales/ja.json`
- Modify: `web/default/src/i18n/locales/vi.json`
- Modify: `web/default/src/i18n/locales/es.json`
- Modify: `web/default/src/i18n/locales/pt.json`

- [ ] **Step 1: Write failing interaction tests**

Prove the minimum-spend control is off by default, the four inputs are hidden until enabled, labels are associated with their controls, disabling clears all values, and each currency's schema error renders next to the matching input.

- [ ] **Step 2: Run the component test and verify RED**

Run from `web/default`:

```powershell
bun test src/features/recall-campaigns/components/campaign-offer-validity-fields.test.tsx
```

Expected: FAIL because the current component renders one always-visible USD input.

- [ ] **Step 3: Implement the optional control**

Render the existing project switch/checkbox primitive with `Set minimum spend`. When enabled, render USD, INR, BRL, and JPY numeric inputs in a responsive grid; convert each displayed major-unit value to the draft's minor-unit integer on change with currency-specific precision; translate every new visible label and error in all eight locale files. When disabled, synchronously set `enabled=false`, clear `amounts`, and zero the legacy pair.

- [ ] **Step 4: Run component and i18n checks and verify GREEN**

Run:

```powershell
bun test src/features/recall-campaigns/components/campaign-offer-validity-fields.test.tsx
bun run i18n:sync
```

Expected: tests pass and no changed key appears as untranslated in `src/i18n/locales/_reports`.

- [ ] **Step 5: Commit the frontend behavior**

Commit the frontend contract, validation, UI, translations, and tests with Lore trailers including the three focused test files and i18n check.

### Task 5: Integrated Verification, Review, PR, and Staging

**Files:**
- Review all changed files against `origin/main`.
- Update PR `SolveaCX/new-api#577`.
- Promote only verified feature commits to `staging`.

- [ ] **Step 1: Run focused and static validation**

Run:

```powershell
go test ./service -run 'Recall.*(Minimum|Promotion|Discount)' -count=1
go build ./...
```

From `web/default` run:

```powershell
bun test src/features/recall-campaigns/helpers.test.ts src/features/recall-campaigns/schemas.test.ts src/features/recall-campaigns/components/campaign-offer-validity-fields.test.tsx
bun run typecheck
bun run lint
bun run build:check
```

- [ ] **Step 2: Run impact and diff review**

Run GitNexus impact before each edited symbol and `gitnexus detect-changes --base-ref main` before commits. Review `git diff --check`, the branch diff against `origin/main`, and verify no unrelated commits or generated artifacts are included.

- [ ] **Step 3: Run independent code review**

Review correctness, rollout compatibility, Stripe request shape, unsupported-currency fail-closed behavior, form accessibility, i18n completeness, and deployment scope. The change adds no process-local coordination and is safe across multiple nodes because every node reads the persisted campaign JSON and applies the same deterministic normalization. Router nodes do not need deployment because this is Recall console/service behavior outside `/v1` relay paths; `newapi-console` and staging do.

- [ ] **Step 4: Update PR and review discussion**

Force-push the rebased feature branch with `--force-with-lease`, update PR #577 with problem/evidence/root cause/design/risk/validation, and reply to the serious USD review comment with the implementing commit and test evidence.

- [ ] **Step 5: Promote to staging and smoke test**

Cherry-pick only the verified feature commits onto current `origin/staging`, push `staging`, monitor the staging workflow, then smoke test one below-threshold and one qualifying checkout currency. Do not modify, merge, or push `main`.
