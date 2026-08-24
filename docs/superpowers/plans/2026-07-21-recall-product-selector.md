# Recall Campaign Product Selector Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace manual recall campaign Stripe Price ID inputs with multi-selects populated from configured top-up and enabled subscription plans.

**Architecture:** Add a focused option-loading module that adapts the two existing authenticated APIs into shared `MultiSelect` options. Add a focused selector component that preserves selected-but-unavailable IDs, then wire it into the existing React Hook Form without changing the saved campaign contract.

**Tech Stack:** React 19, TypeScript, TanStack Query, React Hook Form, Bun test, i18next, existing `MultiSelect` component.

---

### Task 1: Product option loading and normalization

**Files:**
- Create: `web/default/src/features/recall-campaigns/product-options.ts`
- Create: `web/default/src/features/recall-campaigns/product-options.test.ts`
- Modify: `web/default/src/features/recall-campaigns/api.ts`
- Modify: `web/default/src/features/recall-campaigns/types.ts`

- [ ] **Step 1: Write failing normalization tests**

Cover sorted top-up labels, filtering disabled or missing-Price subscription plans, and retaining selected unknown IDs with an unavailable label.

```ts
expect(buildTopUpProductOptions({ 20: 'price_20' }, [])).toEqual([
  { value: 'price_20', label: '20 USD · price_20', unavailable: false },
])
expect(buildSubscriptionProductOptions(records, [])).toEqual([
  {
    value: 'price_pro_month',
    label: 'Pro · 20 USD · price_pro_month',
    unavailable: false,
  },
])
expect(appendUnavailableSelections([], ['price_removed'])).toEqual([
  {
    value: 'price_removed',
    label: 'Unavailable · price_removed',
    unavailable: true,
  },
])
```

- [ ] **Step 2: Run the test and verify RED**

Run: `bun test src/features/recall-campaigns/product-options.test.ts`

Expected: FAIL because `product-options.ts` does not exist.

- [ ] **Step 3: Add types, loaders, and pure builders**

Add a `RecallProductOption` type, `getRecallTopUpProducts()` calling `/api/user/topup/info`, `getRecallSubscriptionProducts()` calling `/api/subscription/admin/plans`, and pure functions that produce deterministic labels. Only enabled subscription records with a non-empty `stripe_price_id` become new choices; selected unknown IDs are appended with `unavailable: true`.

```ts
export interface RecallProductOption {
  value: string
  label: string
  unavailable: boolean
}

export function appendUnavailableSelections(
  options: RecallProductOption[],
  selected: string[]
): RecallProductOption[] {
  const known = new Set(options.map((option) => option.value))
  return [
    ...options,
    ...selected
      .filter((value) => !known.has(value))
      .map((value) => ({
        value,
        label: `Unavailable · ${value}`,
        unavailable: true,
      })),
  ]
}
```

- [ ] **Step 4: Run the option tests and verify GREEN**

Run: `bun test src/features/recall-campaigns/product-options.test.ts`

Expected: all product option tests pass.

### Task 2: Product multi-select component

**Files:**
- Create: `web/default/src/features/recall-campaigns/components/campaign-product-selector.tsx`
- Create: `web/default/src/features/recall-campaigns/components/campaign-product-selector.test.tsx`

- [ ] **Step 1: Write failing component rendering tests**

Render the component inside Query Client and i18n providers. Seed successful query data to assert friendly top-up/subscription labels and unavailable saved IDs. Seed errors and empty results to assert configuration guidance. Assert immutable mode disables both controls.

```tsx
<CampaignProductSelector
  topUpPriceIDs={['price_removed']}
  subscriptionPriceIDs={[]}
  onTopUpChange={() => undefined}
  onSubscriptionChange={() => undefined}
  immutable={false}
/>
```

- [ ] **Step 2: Run the component test and verify RED**

Run: `bun test src/features/recall-campaigns/components/campaign-product-selector.test.tsx`

Expected: FAIL because the selector component does not exist.

- [ ] **Step 3: Implement the selector with two existing MultiSelect controls**

Use two TanStack queries with stable recall product-option keys. Convert `RecallProductOption` to the existing `{ label, value }` shape, set `allowCreate={false}`, preserve selected IDs while loading or on errors, and show concise empty/error guidance below each group.

```tsx
<MultiSelect
  options={topUpOptions}
  selected={props.topUpPriceIDs}
  onChange={props.onTopUpChange}
  placeholder={t('Select top-up products')}
  emptyText={t('No configured Stripe top-up products')}
  disabled={props.immutable || topUpQuery.isLoading}
/>
```

- [ ] **Step 4: Run the component tests and verify GREEN**

Run: `bun test src/features/recall-campaigns/components/campaign-product-selector.test.tsx`

Expected: selector rendering, unavailable-value, immutable, empty, and error cases pass.

### Task 3: Integrate the selector and localize guidance

**Files:**
- Modify: `web/default/src/features/recall-campaigns/components/campaign-editor.tsx`
- Modify: `web/default/src/features/recall-campaigns/components/campaign-editor.test.tsx`
- Modify: `web/default/src/i18n/locales/en.json`
- Modify: `web/default/src/i18n/locales/zh.json`
- Modify: `web/default/src/i18n/locales/es.json`
- Modify: `web/default/src/i18n/locales/fr.json`
- Modify: `web/default/src/i18n/locales/pt.json`
- Modify: `web/default/src/i18n/locales/ru.json`
- Modify: `web/default/src/i18n/locales/ja.json`
- Modify: `web/default/src/i18n/locales/vi.json`
- Modify: `web/default/src/i18n/static-keys.ts`

- [ ] **Step 1: Write a failing editor integration assertion**

Assert the editor no longer renders free-form inputs for `product_scope.topup_price_ids` or `product_scope.subscription_price_ids`, and renders the two selector labels instead.

- [ ] **Step 2: Run the editor test and verify RED**

Run: `bun test src/features/recall-campaigns/components/campaign-editor.test.tsx`

Expected: FAIL while the old comma-separated inputs remain.

- [ ] **Step 3: Replace the two manual inputs**

Render `CampaignProductSelector` and update form arrays with validation enabled.

```tsx
<CampaignProductSelector
  topUpPriceIDs={topUpPrices}
  subscriptionPriceIDs={subscriptionPrices}
  onTopUpChange={(value) =>
    form.setValue('product_scope.topup_price_ids', value, {
      shouldDirty: true,
      shouldValidate: true,
    })
  }
  onSubscriptionChange={(value) =>
    form.setValue('product_scope.subscription_price_ids', value, {
      shouldDirty: true,
      shouldValidate: true,
    })
  }
  immutable={immutable}
/>
```

- [ ] **Step 4: Add all eight locale translations and static keys**

Translate selector placeholders, empty/error states, unavailable markers, and the instructions for configuring missing top-up or subscription products. Keep Price IDs and currency codes unchanged in every locale.

- [ ] **Step 5: Run focused and full verification**

Run from `web/default`:

```text
bun test src/features/recall-campaigns
bun run typecheck
bun run i18n:sync
bunx eslint src/features/recall-campaigns
bunx prettier --check src/features/recall-campaigns src/i18n/static-keys.ts src/i18n/locales
bun run build
```

Expected: all tests pass, typecheck succeeds, every locale reports zero missing/untranslated recall keys, lint/format checks pass, and the production build completes.

- [ ] **Step 6: Commit with Lore trailers**

Commit only selector implementation, tests, and i18n files. Record that existing APIs and the unchanged campaign payload were deliberate constraints.
