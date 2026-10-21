# Currency Subscription Payment UI Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix currency display bugs in payment/subscription UI and hide subscription third-party payment ID fields unless their gateway is configured/enabled.

**Architecture:** This is a frontend-focused fix using existing currency utilities from `web/default/src/lib/currency.ts` and existing system options from `useSystemOptions()`. No backend payment semantics change and no new Stripe/Creem product creation APIs are added. Waffo Pancake continues to use the existing auto-create product endpoint.

**Tech Stack:** React 19, TypeScript, react-hook-form, i18next, Bun, Rsbuild

---

## File Structure

- Modify `web/default/src/features/system-settings/integrations/amount-options-visual-editor.tsx`
  - Replace hardcoded `$` display with `formatCurrencyFromUSD`.

- Modify `web/default/src/features/wallet/components/subscription-plans-card.tsx`
  - Replace hardcoded subscription plan `$` display with `formatLocalCurrencyAmount`.

- Modify `web/default/src/features/subscriptions/components/dialogs/subscription-purchase-dialog.tsx`
  - Replace hardcoded amount due `$` display with `formatLocalCurrencyAmount`.

- Modify `web/default/src/features/subscriptions/components/subscriptions-provider.tsx`
  - Derive Stripe/Creem/Waffo Pancake availability from system options.
  - Expose flags through subscription context.

- Modify `web/default/src/features/subscriptions/components/subscriptions-mutate-drawer.tsx`
  - Read gateway availability flags from subscription context.
  - Hide third-party section when no relevant gateway is available.
  - Show only enabled gateway fields.
  - Add current currency label to `Actual Amount`.
  - Add explanatory text to actual amount and provider ID fields.

- Modify `web/default/src/features/subscriptions/index.tsx`
  - Update subscription management notice.

- Modify `web/default/src/i18n/locales/en.json`
- Modify `web/default/src/i18n/locales/zh.json`

---

### Task 1: Fix payment amount option currency display

**Files:**
- Modify: `web/default/src/features/system-settings/integrations/amount-options-visual-editor.tsx`

- [ ] **Step 1: Import currency formatter**

Add this import near other imports:

```ts
import { formatCurrencyFromUSD } from '@/lib/currency'
```

- [ ] **Step 2: Replace hardcoded dollar badge**

Find:

```tsx
<span className='font-mono'>${amount}</span>
```

Replace with:

```tsx
<span className='font-mono'>{formatCurrencyFromUSD(amount)}</span>
```

This treats amount options as system USD credit amounts and displays them in the configured currency.

---

### Task 2: Fix wallet subscription card currency display

**Files:**
- Modify: `web/default/src/features/wallet/components/subscription-plans-card.tsx`

- [ ] **Step 1: Import local currency formatter**

Add this import near other imports:

```ts
import { formatLocalCurrencyAmount } from '@/lib/currency'
```

- [ ] **Step 2: Replace hardcoded price string**

Find:

```ts
const price = Number(plan.price_amount || 0).toFixed(2)
```

Replace with:

```ts
const price = formatLocalCurrencyAmount(Number(plan.price_amount || 0))
```

- [ ] **Step 3: Remove hardcoded `$` from rendering**

Find:

```tsx
<span className='text-primary text-2xl font-bold'>
  ${price}
</span>
```

Replace with:

```tsx
<span className='text-primary text-2xl font-bold'>{price}</span>
```

---

### Task 3: Fix subscription purchase dialog amount due currency display

**Files:**
- Modify: `web/default/src/features/subscriptions/components/dialogs/subscription-purchase-dialog.tsx`

- [ ] **Step 1: Import local currency formatter and currency label helper**

Add this import near other imports:

```ts
import { formatLocalCurrencyAmount } from '@/lib/currency'
```

- [ ] **Step 2: Replace hardcoded price string**

Find:

```ts
const price = Number(plan.price_amount || 0).toFixed(2)
```

Replace with:

```ts
const price = formatLocalCurrencyAmount(Number(plan.price_amount || 0))
```

- [ ] **Step 3: Remove hardcoded `$` from amount due rendering**

Find:

```tsx
<span className='text-primary text-lg font-bold'>${price}</span>
```

Replace with:

```tsx
<span className='text-primary text-lg font-bold'>{price}</span>
```

---

### Task 4: Expose subscription gateway availability in provider

**Files:**
- Modify: `web/default/src/features/subscriptions/components/subscriptions-provider.tsx`

- [ ] **Step 1: Extend context type**

Find `type SubscriptionsContextType = { ... }` and add:

```ts
  subscriptionPaymentAvailability: {
    stripe: boolean
    creem: boolean
    waffoPancake: boolean
  }
```

- [ ] **Step 2: Derive availability from system options**

After `complianceConfirmed`, add:

```ts
  const paymentOptions = getOptionValue(data?.data, {
    StripeApiSecret: '',
    StripeWebhookSecret: '',
    StripePriceId: '',
    CreemApiKey: '',
    CreemProducts: '',
    WaffoPancakeMerchantID: '',
    WaffoPancakePrivateKey: '',
  })

  const subscriptionPaymentAvailability = {
    stripe:
      complianceConfirmed &&
      Boolean(
        paymentOptions.StripeApiSecret &&
          paymentOptions.StripeWebhookSecret &&
          paymentOptions.StripePriceId
      ),
    creem:
      complianceConfirmed &&
      Boolean(
        paymentOptions.CreemApiKey &&
          paymentOptions.CreemProducts &&
          paymentOptions.CreemProducts !== '[]'
      ),
    waffoPancake:
      complianceConfirmed &&
      Boolean(
        paymentOptions.WaffoPancakeMerchantID &&
          paymentOptions.WaffoPancakePrivateKey
      ),
  }
```

- [ ] **Step 3: Provide the new value**

In the context `value={{ ... }}`, add:

```ts
subscriptionPaymentAvailability,
```

---

### Task 5: Hide unavailable subscription third-party fields and add amount guidance

**Files:**
- Modify: `web/default/src/features/subscriptions/components/subscriptions-mutate-drawer.tsx`

- [ ] **Step 1: Import currency label helper**

Add this import near other imports:

```ts
import { getCurrencyLabel } from '@/lib/currency'
```

- [ ] **Step 2: Read availability from context**

Find:

```ts
const { triggerRefresh } = useSubscriptions()
```

Replace with:

```ts
const { triggerRefresh, subscriptionPaymentAvailability } = useSubscriptions()
```

- [ ] **Step 3: Add local constants**

After `pancakeCreateReady`, add:

```ts
  const currencyLabel = getCurrencyLabel()
  const hasThirdPartyPaymentConfig =
    subscriptionPaymentAvailability.stripe ||
    subscriptionPaymentAvailability.creem ||
    subscriptionPaymentAvailability.waffoPancake
```

- [ ] **Step 4: Update Actual Amount label and description**

Find:

```tsx
<FormLabel>{t('Actual Amount')}</FormLabel>
```

Replace with:

```tsx
<FormLabel>
  {t('Actual Amount ({{currency}})', { currency: currencyLabel })}
</FormLabel>
```

Inside the same `FormItem`, after `</FormControl>` and before `<FormMessage />`, add:

```tsx
<FormDescription>
  {t(
    'Used as the actual amount charged by Epay, Alipay, WeChat Pay, and Waffo Pancake. Stripe and Creem use their configured product IDs.'
  )}
</FormDescription>
```

- [ ] **Step 5: Hide the entire third-party section when no provider is available**

Wrap the entire section starting with:

```tsx
{/* Payment Config */}
<SideDrawerSection>
```

and ending with its matching `</SideDrawerSection>` in:

```tsx
{hasThirdPartyPaymentConfig && (
  <SideDrawerSection>
    ...
  </SideDrawerSection>
)}
```

Keep the comment inside or immediately before the conditional.

- [ ] **Step 6: Conditionally show Stripe field**

Wrap the `FormField name='stripe_price_id'` block in:

```tsx
{subscriptionPaymentAvailability.stripe && (
  <FormField ... />
)}
```

Add this description inside the Stripe `FormItem` after `</FormControl>`:

```tsx
<FormDescription>
  {t('Create a Price in the Stripe dashboard for this plan, then paste the Price ID here.')}
</FormDescription>
```

- [ ] **Step 7: Conditionally show Creem field**

Wrap the `FormField name='creem_product_id'` block in:

```tsx
{subscriptionPaymentAvailability.creem && (
  <FormField ... />
)}
```

Add this description inside the Creem `FormItem` after `</FormControl>`:

```tsx
<FormDescription>
  {t('Create a Product in the Creem dashboard for this plan, then paste the Product ID here.')}
</FormDescription>
```

- [ ] **Step 8: Conditionally show Waffo Pancake field**

Wrap the `FormField name='waffo_pancake_product_id'` block in:

```tsx
{subscriptionPaymentAvailability.waffoPancake && (
  <FormField ... />
)}
```

Do not change the existing `+ Create` behavior.

---

### Task 6: Update subscriptions page notice

**Files:**
- Modify: `web/default/src/features/subscriptions/index.tsx`

- [ ] **Step 1: Replace notice string**

Find:

```tsx
{t(
  'Stripe/Creem requires creating products on the third-party platform and entering the ID'
)}
```

Replace with:

```tsx
{t(
  'Enabled third-party payment channels may require provider-specific product IDs. Waffo Pancake can create one automatically; Stripe and Creem currently require IDs from their dashboards.'
)}
```

---

### Task 7: Add English and Chinese translations

**Files:**
- Modify: `web/default/src/i18n/locales/en.json`
- Modify: `web/default/src/i18n/locales/zh.json`

- [ ] **Step 1: Add English entries**

Add these entries to the top-level `translation` object in `en.json` if missing:

```json
"Actual Amount ({{currency}})": "Actual Amount ({{currency}})",
"Used as the actual amount charged by Epay, Alipay, WeChat Pay, and Waffo Pancake. Stripe and Creem use their configured product IDs.": "Used as the actual amount charged by Epay, Alipay, WeChat Pay, and Waffo Pancake. Stripe and Creem use their configured product IDs.",
"Create a Price in the Stripe dashboard for this plan, then paste the Price ID here.": "Create a Price in the Stripe dashboard for this plan, then paste the Price ID here.",
"Create a Product in the Creem dashboard for this plan, then paste the Product ID here.": "Create a Product in the Creem dashboard for this plan, then paste the Product ID here.",
"Enabled third-party payment channels may require provider-specific product IDs. Waffo Pancake can create one automatically; Stripe and Creem currently require IDs from their dashboards.": "Enabled third-party payment channels may require provider-specific product IDs. Waffo Pancake can create one automatically; Stripe and Creem currently require IDs from their dashboards."
```

- [ ] **Step 2: Add Chinese entries**

Add these entries to the top-level `translation` object in `zh.json` if missing:

```json
"Actual Amount ({{currency}})": "实际支付金额（{{currency}}）",
"Used as the actual amount charged by Epay, Alipay, WeChat Pay, and Waffo Pancake. Stripe and Creem use their configured product IDs.": "作为 Epay、支付宝、微信支付和 Waffo Pancake 实际收取的金额。Stripe 和 Creem 使用各自配置的产品 ID。",
"Create a Price in the Stripe dashboard for this plan, then paste the Price ID here.": "请在 Stripe 控制台为该套餐创建 Price，然后将 Price ID 填写到这里。",
"Create a Product in the Creem dashboard for this plan, then paste the Product ID here.": "请在 Creem 控制台为该套餐创建 Product，然后将 Product ID 填写到这里。",
"Enabled third-party payment channels may require provider-specific product IDs. Waffo Pancake can create one automatically; Stripe and Creem currently require IDs from their dashboards.": "已启用的第三方支付渠道可能需要配置平台对应的产品 ID。Waffo Pancake 可自动创建；Stripe 和 Creem 当前需要从各自控制台获取 ID。"
```

---

### Task 8: Verify

**Files:**
- No additional code changes.

- [ ] **Step 1: Run TypeScript check**

Run:

```bash
cd web/default && bun run typecheck
```

Expected output includes:

```text
$ tsc -b
```

and exits with code `0`.

- [ ] **Step 2: Run frontend build**

Run:

```bash
cd web/default && bun run build
```

Expected output includes:

```text
ready   built in ...
```

and exits with code `0`.

---

## Self-Review

- Spec coverage: Covers currency display fixes, conditional subscription third-party fields, Waffo Pancake existing auto-create preservation, and i18n.
- Placeholder scan: No placeholders remain.
- Type consistency: Uses existing `CurrencyConfig`, `getCurrencyLabel`, `formatCurrencyFromUSD`, `formatLocalCurrencyAmount`, `useSystemOptions`, and `useSubscriptions` patterns.
- Scope check: Does not add Stripe/Creem backend creation APIs and does not change backend payment semantics.
