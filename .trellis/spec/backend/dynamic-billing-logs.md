# Dynamic Billing Log Details

## 1. Scope / Trigger

Use this contract whenever tiered expression settlement data is added to logs or a frontend surface explains a historical dynamic charge. It prevents the UI from reconstructing billing with raw provider token counts or current catalog prices.

## 2. Signatures

- `billingexpr.TokenParams` serializes as `p`, `c`, `len`, `cr`, `cc`, `cc1h`, `img`, `img_o`, `ai`, and `ao`.
- `billingexpr.TieredResult.ActualUsage billingexpr.TokenParams` is the exact normalized input passed to the successful settlement expression.
- `billingexpr.TieredResult.ActualCostBeforeGroup float64` is the USD expression cost after request-rule multipliers and before the group multiplier.
- `service.InjectTieredBillingInfo` writes `other.billing_usage` and `other.billing_cost_before_group` only when settlement returned a non-nil result.
- `getTieredBillingSummary(other, { includeUnusedCache: true })` returns every explicitly declared matched-tier price, including zero.
- `getDynamicBillingDetails(other)` returns line items only after reconciling their sum with `billing_cost_before_group`.

## 3. Contracts

- Trace fields explain an already-computed charge. They never participate in pre-consume, settlement, refund, or quota conversion.
- `billing_usage` owns normalization at the backend boundary. Frontend code must not reimplement OpenAI/Claude cache subtraction from raw log counters.
- A line item is `normalized quantity × declared unit price / 1_000_000 × matched request-rule multipliers`.
- The sum must match `billing_cost_before_group` within `max(1e-12, abs(cost) * 1e-9)` before the UI exposes itemized details.
- The final logged charge remains authoritative because group ratios, quota rounding, and external surcharges can differ from expression line items.
- Declared zero and absent variables are different. Zero is a valid price; absence means the category falls back to its base `p`/`c` semantics.
- For Anthropic usage, `cc` is labeled as 5-minute cache creation and `cc1h` remains separate.
- Legacy logs and non-linear/special expressions may show parsed unit prices but must not show guessed line-item amounts.

## 4. Validation & Error Matrix

| Condition | Required behavior |
| --- | --- |
| Successful tiered settlement | Append normalized usage and pre-group expression cost |
| Settlement fallback returns no result | Omit both trace fields |
| Declared price is exactly zero | Preserve and display zero |
| Usage, price, multiplier, or recorded cost is negative/non-finite | Do not expose itemized details |
| Linear line sum reconciles | Expose verified bill details |
| Constant/non-linear/unsupported outer arithmetic changes the cost | Reconciliation fails; hide itemization |
| Old log lacks trace fields | Keep available unit prices; hide itemization |

## 5. Good / Base / Bad Cases

- Good: `tier("base", p * 2 + c * 10 + cr * 0.2 + cc1h * 0)` records normalized quantities; the UI shows the free 1-hour rate and itemizes only used dimensions.
- Base: a legacy dynamic log still shows its matched tier and parsed rates without a bill-details trigger.
- Bad: derive `p` by subtracting cache counters in React or query the current model catalog to fill a historical rate.
- Bad: show line items when their sum differs from the recorded expression cost.

## 6. Tests Required

- Billing-expression settlement test: exact `ActualUsage`, USD `ActualCostBeforeGroup`, unchanged quota before/after group.
- Log serialization test: lowercase JSON keys survive the shared `common.Marshal` / `common.Unmarshal` boundary.
- Frontend model tests: explicit zero, unused cache prices, matched/unmatched request multipliers, reconciliation failure, legacy traces, and unsupported outer arithmetic.
- Component tests: all declared prices remain visible; mouse hover and keyboard focus expose verified line items; old logs omit the trigger.
- Claude regression: `cc` renders as 5-minute cache write and `cc1h` as 1-hour cache write.

## 7. Wrong vs Correct

### Wrong

```ts
const inputCost = log.prompt_tokens * currentCatalog.inputPrice / 1_000_000
```

This mixes raw historical usage with mutable current pricing and ignores backend normalization.

### Correct

```ts
const details = getDynamicBillingDetails(parseLogOther(log.other))
if (details) renderVerifiedBillingDetails(details)
```

The shared projection validates the frozen settlement trace and suppresses unverifiable itemization.
