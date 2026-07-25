# Recall Multi-Currency Fixed Coupon Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow automatic recall campaigns to create one Stripe Coupon that discounts configurable USD, INR, BRL, and JPY fixed amounts equivalent to approximately USD 5.

**Architecture:** Keep the API and persisted JSON in Stripe minor units by extending `RecallDiscountConfig` with `currency_options`. Enforce the exact four-currency contract only for automatic fixed Coupons, build Stripe `CouponParams.CurrencyOptions`, and keep human-readable major-unit strings at the campaign-editor boundary through tested conversion helpers.

**Tech Stack:** Go, stripe-go v81, React 19, TypeScript 6, React Hook Form, Zod 4, Bun test.

---

## File Map

- Modify `service/recall_contract.go`: add the persisted/API currency-options map.
- Modify `service/recall_stripe.go`: normalize currency-option keys, validate automatic fixed configuration, and build Stripe Coupon currency options.
- Modify `service/recall_stripe_test.go`: prove normalization, rejection cases, and exact Stripe parameters.
- Modify `service/recall_campaign_test.go`: prove draft save normalization and automatic-only validation.
- Modify `web/default/src/features/recall-campaigns/types.ts`: expose `currency_options` to the frontend.
- Modify `web/default/src/features/recall-campaigns/helpers.ts`: own defaults plus major/minor conversion and discount-mode normalization.
- Modify `web/default/src/features/recall-campaigns/helpers.test.ts`: lock conversion and mode-switch behavior.
- Modify `web/default/src/features/recall-campaigns/schemas.ts`: validate the exact automatic fixed-Coupon contract.
- Modify `web/default/src/features/recall-campaigns/schemas.test.ts`: cover missing/extra currencies and forbidden minimum spend.
- Modify `web/default/src/features/recall-campaigns/components/campaign-editor.tsx`: render four normal-amount inputs and hide minimum-spend controls for this mode.
- Modify `web/default/src/features/recall-campaigns/components/campaign-preview-dialog.tsx`: display the four configured discounts.
- Modify `E:/workspace/recall-campaign-configuration-guide.html`: document multi-currency fixed discounts and test steps.

### Task 1: Backend contract and automatic fixed validation

**Files:**
- Modify: `service/recall_contract.go`
- Modify: `service/recall_stripe.go`
- Test: `service/recall_stripe_test.go`
- Test: `service/recall_campaign_test.go`

- [ ] **Step 1: Write failing normalization and draft-validation tests**

Add a fixed discount fixture with:

```go
RecallDiscountConfig{
    Type:      "fixed",
    AmountOff: 500,
    Currency:  " USD ",
    CurrencyOptions: map[string]int64{
        " INR ": 45000,
        "brl":   2500,
        "JPY":   750,
    },
}
```

Assert normalization produces `usd` and exactly lowercase `inr`, `brl`, and `jpy`. Add table cases that reject automatic fixed drafts with a missing currency, an extra currency, a non-positive option, non-USD base currency, or nonzero minimum spend.

- [ ] **Step 2: Run focused Go tests and observe failure**

Run: `go test ./service -run 'TestRecallStripeFixed|TestRecallCampaignSaveDraft' -count=1`

Expected: compilation or assertion failure because `CurrencyOptions` and automatic validation do not exist.

- [ ] **Step 3: Add the contract and minimal validator**

Add to `RecallDiscountConfig`:

```go
CurrencyOptions map[string]int64 `json:"currency_options"`
```

Normalize keys with `strings.ToLower(strings.TrimSpace(currency))`, reject empty/duplicate normalized keys, normalize percentage discounts to a non-nil empty map so their JSON is `{}`, and add a helper used by automatic Coupon construction and automatic draft validation:

```go
func validateRecallAutomaticFixedDiscount(discount RecallDiscountConfig) error
```

It must require base `usd`, positive `amount_off`, exactly `inr`/`brl`/`jpy`, zero `percent_off`, and no minimum-spend fields. Percentage discounts must reject non-empty `currency_options`.

- [ ] **Step 4: Run focused Go tests**

Run: `go test ./service -run 'TestRecallStripeFixed|TestRecallCampaignSaveDraft' -count=1`

Expected: PASS.

- [ ] **Step 5: Commit the backend contract slice using the Lore protocol**

Commit the four backend files with an intent line explaining why automatic recall discounts need a complete settlement-currency contract, plus `Constraint`, `Confidence`, `Scope-risk`, `Directive`, and `Tested` trailers.

### Task 2: Stripe Coupon currency-options construction

**Files:**
- Modify: `service/recall_stripe.go`
- Test: `service/recall_stripe_test.go`

- [ ] **Step 1: Write the failing Stripe parameter assertion**

Extend `TestRecallStripeFixedCouponParams` to require:

```go
require.Equal(t, int64(500), *captured.AmountOff)
require.Equal(t, "usd", *captured.Currency)
require.Equal(t, int64(45000), *captured.CurrencyOptions["inr"].AmountOff)
require.Equal(t, int64(2500), *captured.CurrencyOptions["brl"].AmountOff)
require.Equal(t, int64(750), *captured.CurrencyOptions["jpy"].AmountOff)
```

- [ ] **Step 2: Run the test and observe failure**

Run: `go test ./service -run TestRecallStripeFixedCouponParams -count=1`

Expected: FAIL because `CouponParams.CurrencyOptions` is nil.

- [ ] **Step 3: Build the Stripe map from campaign data**

After automatic fixed validation, populate:

```go
params.CurrencyOptions = map[string]*stripe.CouponCurrencyOptionsParams{}
for currency, amountOff := range discount.CurrencyOptions {
    params.CurrencyOptions[currency] = &stripe.CouponCurrencyOptionsParams{
        AmountOff: stripe.Int64(amountOff),
    }
}
```

Do not hard-code the three amounts in the builder. Preserve the existing idempotency key, metadata, product scope, duration, and redemption limit.

- [ ] **Step 4: Run all recall Stripe tests**

Run: `go test ./service -run TestRecallStripe -count=1`

Expected: PASS.

- [ ] **Step 5: Commit the Stripe construction slice using the Lore protocol**

Commit with a narrow scope warning that existing-Coupon validation and promotion-code minimum restrictions are outside this change.

### Task 3: Frontend conversion helpers and schema

**Files:**
- Modify: `web/default/src/features/recall-campaigns/types.ts`
- Modify: `web/default/src/features/recall-campaigns/helpers.ts`
- Modify: `web/default/src/features/recall-campaigns/helpers.test.ts`
- Modify: `web/default/src/features/recall-campaigns/schemas.ts`
- Modify: `web/default/src/features/recall-campaigns/schemas.test.ts`

- [ ] **Step 1: Write failing helper tests**

Add tests proving:

```ts
expect(parseRecallMajorAmount('USD', '5.00')).toBe(500)
expect(parseRecallMajorAmount('INR', '450.00')).toBe(45_000)
expect(parseRecallMajorAmount('BRL', '25.00')).toBe(2_500)
expect(parseRecallMajorAmount('JPY', '750')).toBe(750)
expect(parseRecallMajorAmount('USD', '5.001')).toBeNull()
expect(parseRecallMajorAmount('JPY', '750.5')).toBeNull()
```

Update mode-switch tests so automatic fixed mode defaults to USD 500 plus `{ inr: 45000, brl: 2500, jpy: 750 }` and clears minimum-spend fields; percentage mode clears `currency_options`.

- [ ] **Step 2: Write failing schema tests**

Require automatic fixed drafts to use uppercase `USD` in the frontend form, positive USD amount, exact lowercase option keys, positive option values, and zero/empty minimum-spend fields. Reject missing `jpy`, extra `eur`, and nonzero `minimum_amount`.

- [ ] **Step 3: Run focused Bun tests and observe failure**

Run: `bun test src/features/recall-campaigns/helpers.test.ts src/features/recall-campaigns/schemas.test.ts`

Expected: compilation or assertion failure because the map and helpers do not exist.

- [ ] **Step 4: Implement the frontend contract and pure helpers**

Add `currency_options: Record<string, number>` to `RecallDiscountConfig`, default percentage drafts to `{}`, and export:

```ts
export const recallFixedCurrencyDefaults = {
  amount_off: 500,
  currency_options: { inr: 45_000, brl: 2_500, jpy: 750 },
}

export function parseRecallMajorAmount(
  currency: 'USD' | 'INR' | 'BRL' | 'JPY',
  value: string
): number | null

export function formatRecallMinorAmount(
  currency: 'USD' | 'INR' | 'BRL' | 'JPY',
  value: number
): string
```

The parser must accept at most two decimals for USD/INR/BRL, no decimals for JPY, reject non-positive/unsafe values, and return integer minor units.

- [ ] **Step 5: Run focused Bun tests**

Run: `bun test src/features/recall-campaigns/helpers.test.ts src/features/recall-campaigns/schemas.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit the frontend contract slice using the Lore protocol**

Commit the five files with test evidence and a directive that API/persistence values remain minor units.

### Task 4: Campaign editor and preview

**Files:**
- Modify: `web/default/src/features/recall-campaigns/components/campaign-editor.tsx`
- Modify: `web/default/src/features/recall-campaigns/components/campaign-preview-dialog.tsx`

- [ ] **Step 1: Add editor-local display state backed by tested helpers**

Keep React Hook Form values in minor units. Maintain four display strings initialized by `formatRecallMinorAmount`, and on each input change call `parseRecallMajorAmount`; write the parsed value or zero to the appropriate form field so invalid display text cannot pass schema validation.

- [ ] **Step 2: Replace the single amount/currency controls**

For automatic fixed mode, render four labeled numeric inputs with `step="0.01"` for USD/INR/BRL, `step="1"` for JPY, and the no-live-conversion explanation. USD writes `discount_config.amount_off`; other currencies write `discount_config.currency_options.inr|brl|jpy`. Do not expose a mutable base-currency field.

- [ ] **Step 3: Remove incompatible minimum-spend controls from this mode**

When `coupon_source === 'automatic' && discountType === 'fixed'`, hide both minimum-spend inputs. Keep them unchanged for other modes.

- [ ] **Step 4: Show all four discounts in preview**

When `data.stripe.discount.type === 'fixed'`, render formatted USD, INR, BRL, and JPY amounts from the returned minor-unit configuration.

- [ ] **Step 5: Run formatting, focused tests, and typecheck**

Run: `bunx prettier --write src/features/recall-campaigns`

Run: `bun test src/features/recall-campaigns/helpers.test.ts src/features/recall-campaigns/schemas.test.ts`

Run: `bun run typecheck`

Expected: all commands succeed.

- [ ] **Step 6: Commit the UI slice using the Lore protocol**

Commit the editor and preview changes with `Tested` trailers for Bun tests and TypeScript typecheck.

### Task 5: Guide and full verification

**Files:**
- Modify: `E:/workspace/recall-campaign-configuration-guide.html`

- [ ] **Step 1: Update the standalone guide**

Document the four default human-readable amounts, Stripe minor-unit examples, the fact that Stripe does not live-convert Coupon amounts, the absence of minimum spend, and Test Mode checkout checks for all four currencies.

- [ ] **Step 2: Run backend verification**

Run: `go test ./service -count=1`

Expected: PASS.

- [ ] **Step 3: Run frontend verification**

From `web/default`, run:

```text
bun test
bun run typecheck
bun run build
```

Expected: all tests pass, typecheck exits zero, and the production build completes.

- [ ] **Step 4: Verify repository scope and HTML structure**

Run `git diff --check`, inspect `git diff --stat origin/feature/stripe-user-winback...HEAD`, and confirm the standalone HTML still has valid anchors and no unclosed top-level sections using the existing validation method.

- [ ] **Step 5: Run Stripe Test Mode when credentials are available**

Create the automatic Coupon through the validated test path and confirm USD, INR, BRL, and JPY Checkout each apply the configured amount. If test credentials are unavailable, record this exact verification gap without substituting a production call.

- [ ] **Step 6: Commit documentation changes where applicable**

The standalone HTML is outside the repository and is delivered as an artifact. Commit any in-repository documentation corrections with Lore trailers; do not add unrelated artifacts to the feature branch.
