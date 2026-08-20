# Wallet Locale Currency Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Display and submit Flatkey wallet top-ups in the code-configured currency selected from the active interface language, with USD fallback.

**Architecture:** Move the existing Stripe minor-unit prices into one backend map consumed by checkout validation and `/api/user/topup/info`. Parse that contract in the console, choose BRL for Portuguese, JPY for Japanese, and USD otherwise, while preserving valid explicit/manual choices. Render prices from the same contract sent to checkout.

**Tech Stack:** Go, Gin, Stripe Go SDK, React, TypeScript, react-i18next, Bun test.

## Global Constraints

- The currency source of truth is repository code; do not query Stripe to discover wallet currencies.
- Automatic mapping is Portuguese to BRL, Japanese to JPY, and every other language to USD.
- A valid inbound or manually selected currency has precedence over automatic language selection.
- INR remains available only through the existing explicit/manual selector path.
- Displayed price and submitted `stripe_currency` must use the same currency.
- Missing selected-currency configuration falls back to USD; a tier absent from USD is not purchasable.
- Wallet credit remains USD-denominated.
- Add no dependencies.

---

### Task 1: Share the backend Stripe top-up price contract

**Files:**
- Modify: `controller/topup_stripe.go`
- Modify: `controller/topup.go`
- Test: `controller/topup_info_test.go`
- Test: `controller/topup_stripe_test.go`

**Interfaces:**
- Produces: `stripeTopUpPriceContract map[string]map[int64]int64`
- Produces: `buildStripeTopUpCurrencyPrices([]int) map[string]map[int]int64`
- Preserves: `expectedStripeTopUpAmountMinor(string, int64) (int64, bool)`
- Produces API field: `stripe_currency_prices`

- [ ] **Step 1: Write failing contract-sharing tests**

```go
func TestBuildStripeTopUpCurrencyPricesFiltersUnconfiguredTiers(t *testing.T) {
	original := setting.StripeTopUpPriceIds
	t.Cleanup(func() { setting.StripeTopUpPriceIds = original })
	setting.StripeTopUpPriceIds = `{"20":"price_topup_20"}`

	require.Equal(t, map[string]map[int]int64{
		"USD": {20: 2000},
		"JPY": {20: 3000},
		"BRL": {20: 9990},
		"INR": {20: 179900},
	}, buildStripeTopUpCurrencyPrices([]int{20, 50}))
}
```

Extend `TestGetTopUpInfoExposesStripePriceIDsByAmount` to decode `stripe_currency_prices` and assert the exact 20/50 values for USD, JPY, BRL, and INR. Add a table test in `topup_stripe_test.go` proving `stripeTopUpCurrencySupported` and `expectedStripeTopUpAmountMinor` read the same currencies and amounts.

- [ ] **Step 2: Run the focused Go tests and confirm RED**

Run: `go test ./controller -run 'Test(BuildStripeTopUpCurrencyPrices|GetTopUpInfoExposesStripePriceIDs|StripeTopUpPriceContract)' -count=1`

Expected: build failure because `buildStripeTopUpCurrencyPrices` and the response field do not exist.

- [ ] **Step 3: Replace nested switches with one immutable contract map**

```go
var stripeTopUpPriceContract = map[string]map[int64]int64{
	"USD": {10: 1000, 20: 2000, 50: 5000, 100: 10000, 200: 20000},
	"JPY": {10: 1500, 20: 3000, 50: 7500, 100: 15000, 200: 30000},
	"BRL": {10: 4990, 20: 9990, 50: 24990, 100: 49900, 200: 99000},
	"INR": {10: 89900, 20: 179900, 50: 449900, 100: 899900, 200: 1799000},
}

func expectedStripeTopUpAmountMinor(currency string, packageAmount int64) (int64, bool) {
	prices, ok := stripeTopUpPriceContract[strings.ToUpper(strings.TrimSpace(currency))]
	if !ok {
		return 0, false
	}
	amountMinor, ok := prices[packageAmount]
	return amountMinor, ok
}
```

Implement `stripeTopUpCurrencySupported` as a map membership check. Implement `buildStripeTopUpCurrencyPrices` by iterating configured `amountOptions`, skipping tiers without a Stripe Price ID, and copying only positive contract amounts. Add the result to `GetTopUpInfo` as `stripe_currency_prices`.

- [ ] **Step 4: Run focused tests and confirm GREEN**

Run: `go test ./controller -run 'Test(BuildStripeTopUpCurrencyPrices|GetTopUpInfoExposesStripePriceIDs|StripeTopUpPriceContract)' -count=1`

Expected: PASS.

- [ ] **Step 5: Commit the backend contract**

```text
Expose wallet prices from the checkout contract

Constraint: Stripe validation and wallet rendering must share code-defined amounts
Confidence: high
Scope-risk: narrow
Tested: focused controller top-up contract tests
```

### Task 2: Parse prices and resolve locale currency

**Files:**
- Modify: `web/default/src/features/wallet/types.ts`
- Modify: `web/default/src/features/wallet/hooks/use-topup-info.ts`
- Modify: `web/default/src/features/wallet/lib/stripe-currency.ts`
- Modify: `web/default/src/features/wallet/lib/stripe-currency.test.ts`

**Interfaces:**
- Produces: `StripeCurrencyPrices = Partial<Record<StripeCheckoutCurrency, Record<number, number>>>`
- Produces: `parseStripeCurrencyPrices(unknown): StripeCurrencyPrices`
- Produces: `defaultCurrencyForLanguage(string | undefined): StripeCheckoutCurrency`
- Produces: `currencySupportsPresetAmounts(StripeCurrencyPrices, StripeCheckoutCurrency, number[]): boolean`
- Produces: `stripeTopUpDisplayAmount(StripeCurrencyPrices, StripeCheckoutCurrency, number): number | undefined`

- [ ] **Step 1: Write failing language, parsing, and display tests**

```ts
test('maps the active interface language and defaults to USD', () => {
  expect(defaultCurrencyForLanguage('pt')).toBe('BRL')
  expect(defaultCurrencyForLanguage('pt-BR')).toBe('BRL')
  expect(defaultCurrencyForLanguage('ja-JP')).toBe('JPY')
  expect(defaultCurrencyForLanguage('zh-CN')).toBe('USD')
  expect(defaultCurrencyForLanguage(undefined)).toBe('USD')
})

test('parses positive minor-unit prices and formats major units', () => {
  const prices = parseStripeCurrencyPrices({
    USD: { 20: 2000 },
    JPY: { 20: 3000 },
    EUR: { 20: 1800 },
  })
  expect(prices).toEqual({ USD: { 20: 2000 }, JPY: { 20: 3000 } })
  expect(stripeTopUpDisplayAmount(prices, 'USD', 20)).toBe(20)
  expect(stripeTopUpDisplayAmount(prices, 'JPY', 20)).toBe(3000)
})
```

Add coverage that a currency missing any configured preset is unsupported and that malformed/negative values are discarded.

- [ ] **Step 2: Run the currency helper test and confirm RED**

Run: `bun test src/features/wallet/lib/stripe-currency.test.ts`

Working directory: `web/default`

Expected: import/build failure for the new helpers.

- [ ] **Step 3: Implement strict parsing and language resolution**

Add `stripe_currency_prices?: StripeCurrencyPrices` to `TopupInfo`. Parse it in `useTopupInfo` instead of trusting the raw API object. Normalize the language with `language?.trim().toLowerCase().split('-')[0]`; return BRL only for `pt`, JPY only for `ja`, otherwise USD. Treat JPY as zero-decimal and divide USD/BRL/INR minor units by 100. Require every visible preset tier to have a positive amount before considering a currency supported.

- [ ] **Step 4: Run the helper tests and confirm GREEN**

Run: `bun test src/features/wallet/lib/stripe-currency.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit the console currency primitives**

```text
Resolve wallet currency from interface language

Constraint: Unmapped or unconfigured languages must fall back to USD
Confidence: high
Scope-risk: narrow
Tested: wallet Stripe currency helper tests
```

### Task 3: Render and submit one resolved checkout currency

**Files:**
- Modify: `web/default/src/features/wallet/index.tsx`
- Modify: `web/default/src/features/wallet/components/recharge-form-card.tsx`
- Test: `web/default/src/features/wallet/components/recharge-form-card.test.tsx`
- Test: `web/default/src/features/wallet/lib/stripe-currency.test.ts`

**Interfaces:**
- Consumes: `TopupInfo.stripe_currency_prices`
- Consumes: `defaultCurrencyForLanguage`, `currencySupportsPresetAmounts`, `stripeTopUpDisplayAmount`
- Preserves: `PaymentOptions.stripeCurrency`

- [ ] **Step 1: Write failing recharge rendering tests**

Render `RechargeFormCard` with tier 20 and contracts for USD 2000, BRL 9990, and JPY 3000. Assert BRL renders `R$99.9`, JPY renders `¥3,000`, USD renders `$20`, and clicking Continue passes the preset whose checkout is submitted with the same `checkoutCurrency`. Add a case where BRL is absent and USD is rendered.

- [ ] **Step 2: Run the focused component tests and confirm RED**

Run: `bun test src/features/wallet/components/recharge-form-card.test.tsx src/features/wallet/lib/stripe-currency.test.ts`

Working directory: `web/default`

Expected: BRL/JPY assertions fail because the component currently renders `$${preset.value}`.

- [ ] **Step 3: Apply precedence and price rendering**

In `Wallet`, obtain `i18n.resolvedLanguage ?? i18n.language`. Keep the inbound valid currency as the initial touched value. When prices and presets load, and the user has not explicitly selected a currency, choose the language currency only if it supports every preset; otherwise choose USD. Stop calling `defaultCurrencyForRegion`. Filter selector choices to configured currencies, while preserving region-based selector visibility and explicit-link visibility.

In `RechargeFormCard`, compute every non-recall amount through:

```ts
const amount = stripeTopUpDisplayAmount(
  props.topupInfo?.stripe_currency_prices ?? {},
  checkoutCurrency,
  preset.value
)
```

Do not render a preset if `amount` is undefined. Continue passing the resolved `checkoutCurrency` into `processPayment`.

- [ ] **Step 4: Run wallet component tests and confirm GREEN**

Run: `bun test src/features/wallet/components/recharge-form-card.test.tsx src/features/wallet/lib/stripe-currency.test.ts`

Working directory: `web/default`

Expected: PASS.

- [ ] **Step 5: Run wallet type and regression checks**

Run: `bun test src/features/wallet/components/recharge-form-card.test.tsx src/features/wallet/components/subscription-plans-card.test.tsx src/features/wallet/lib/stripe-currency.test.ts`

Run: `bun run typecheck`

Working directory: `web/default`

Expected: PASS.

- [ ] **Step 6: Commit the wallet integration**

```text
Keep displayed wallet prices aligned with checkout

Constraint: A wallet tier may not display one currency and submit another
Confidence: high
Scope-risk: moderate
Tested: wallet component tests and TypeScript typecheck
```

