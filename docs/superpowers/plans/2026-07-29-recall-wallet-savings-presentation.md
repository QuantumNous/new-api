# Recall Wallet Savings Presentation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show eligible Recall invitation offers as complete coupon-style savings on Wallet top-up presets and subscription plans.

**Architecture:** Keep the current account-offer loading, strongest-offer selection, and pure client preview calculation unchanged. Extend only the two pricing components to render an OFF badge, primary discounted price, struck original price, and exact saved amount; checkout continues to resolve the authoritative offer server-side.

**Tech Stack:** React 19, TypeScript, react-i18next, Tailwind CSS 4, Bun test, Rsbuild.

---

## File map

- `web/default/src/features/wallet/components/recharge-form-card.tsx`: render the complete savings hierarchy inside eligible top-up amount tiles.
- `web/default/src/features/wallet/components/recharge-form-card.test.tsx`: cover percentage and fixed multi-currency top-up savings.
- `web/default/src/features/wallet/components/subscription-plans-card.tsx`: add the exact saved amount below the existing subscription price row.
- `web/default/src/features/wallet/components/subscription-plans-card.test.tsx`: extend existing percentage and fixed Recall assertions.

### Task 1: Top-up savings tile

**Files:**
- Modify: `web/default/src/features/wallet/components/recharge-form-card.test.tsx`
- Modify: `web/default/src/features/wallet/components/recharge-form-card.tsx`

- [ ] **Step 1: Write the failing percentage-off test**

Add a USD percentage offer fixture and a test that renders one eligible `$10` preset and asserts:

```tsx
expect(html).toContain('20% OFF')
expect(html).toContain('$8')
expect(html).toContain('$10')
expect(html).toContain('line-through')
expect(html).toContain('Save $2')
```

- [ ] **Step 2: Extend the fixed BRL test before implementation**

Add assertions to the existing BRL test:

```tsx
expect(html).toContain('2.00 BRL OFF')
expect(html).toContain('Save R$2')
```

- [ ] **Step 3: Run the focused test and verify RED**

Run from `web/default`:

```bash
bun test src/features/wallet/components/recharge-form-card.test.tsx
```

Expected: FAIL because the component does not yet render OFF or saved-amount text.

- [ ] **Step 4: Implement the minimum top-up presentation**

After `recallDiscount` is calculated, derive the label without changing eligibility:

```tsx
const recallDiscountLabel = recallDiscount
  ? recallDiscount.type === 'percent'
    ? `${Number(recallOffer?.discount.percent_off || 0)}% OFF`
    : t('{{amount}} {{currency}} off', {
        amount: recallDiscount.discountAmount.toFixed(2),
        currency: recallDiscount.currency,
      }).toUpperCase()
  : null
```

Change the top-up button from a fixed `h-12` to `h-auto min-h-12 py-2`, then render discounted content in this order:

```tsx
<span className='flex flex-col items-center gap-0.5 leading-tight'>
  {recallDiscountLabel ? (
    <span className='inline-flex rounded-full bg-[#dcfce7] px-2 py-0.5 text-[10px] font-semibold text-[#166534] uppercase dark:bg-[#14532d]/40 dark:text-[#86efac]'>
      {recallDiscountLabel}
    </span>
  ) : null}
  <span className='tabular-nums'>
    {recallDiscount
      ? `${checkoutCurrencySymbol}${formatNumber(recallDiscount.discountedAmount)}`
      : `$${formatNumber(preset.value)}`}
  </span>
  {recallDiscount ? (
    <span className='text-[10px] font-medium tabular-nums line-through opacity-75'>
      {checkoutCurrencySymbol}
      {formatNumber(preset.value)}
    </span>
  ) : null}
  {recallDiscount ? (
    <span className='text-[10px] font-medium text-[#166534] dark:text-[#86efac]'>
      {t('Save {{amount}}', {
        amount: `${checkoutCurrencySymbol}${formatNumber(recallDiscount.discountAmount)}`,
      })}
    </span>
  ) : null}
</span>
```

- [ ] **Step 5: Run the focused test and verify GREEN**

Run:

```bash
bun test src/features/wallet/components/recharge-form-card.test.tsx
```

Expected: PASS.

### Task 2: Subscription exact savings

**Files:**
- Modify: `web/default/src/features/wallet/components/subscription-plans-card.test.tsx`
- Modify: `web/default/src/features/wallet/components/subscription-plans-card.tsx`

- [ ] **Step 1: Add failing savings assertions**

Extend the existing percentage test with:

```tsx
expect(goSlice).toContain('Save $2')
```

Extend the existing fixed `$2` test with:

```tsx
expect(html).toContain('Save $2')
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
bun test src/features/wallet/components/subscription-plans-card.test.tsx
```

Expected: FAIL because the exact savings line is missing.

- [ ] **Step 3: Render the exact saved amount**

Immediately after the existing subscription price row, add:

```tsx
{recallDiscount ? (
  <div className='mt-1 text-xs font-medium text-[#166534] dark:text-[#86efac]'>
    {t('Save {{amount}}', {
      amount: formatPlanPrice(recallDiscount.discountAmount),
    })}
  </div>
) : null}
```

- [ ] **Step 4: Run the focused test and verify GREEN**

Run:

```bash
bun test src/features/wallet/components/subscription-plans-card.test.tsx
```

Expected: PASS.

### Task 3: Verification and delivery

**Files:**
- Modify only if a validation failure identifies a directly related issue.

- [ ] **Step 1: Run both focused component suites**

```bash
bun test src/features/wallet/components/recharge-form-card.test.tsx src/features/wallet/components/subscription-plans-card.test.tsx
```

Expected: PASS.

- [ ] **Step 2: Run shared Recall calculation coverage**

```bash
bun test src/features/wallet/lib/recall-claim.test.ts
```

Expected: PASS.

- [ ] **Step 3: Run frontend typecheck and production build check**

```bash
bun run typecheck
bun run build
```

Expected: both commands exit 0.

- [ ] **Step 4: Check scope and formatting**

```bash
git diff --check
git status --short
```

Expected: only the approved Wallet components, tests, and plan are changed.

- [ ] **Step 5: Commit and deliver**

Commit using the repository Lore Commit Protocol, push `fix/recall-account-offer-auto-apply`, cherry-pick only the new commits into `staging`, wait for the staging workflow health check, verify both staging origins return HTTP 200, and update PR #577.

## Self-review

- Spec coverage: Both purchase surfaces render all four approved pricing elements, eligibility remains unchanged, and checkout authority is preserved.
- Placeholder scan: No TBD, TODO, or unspecified implementation step remains.
- Type consistency: Both components consume the existing `RecallPriceDiscount` fields and current translation keys; no new API or type is introduced.
