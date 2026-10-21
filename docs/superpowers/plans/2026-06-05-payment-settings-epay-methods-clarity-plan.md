# Payment Settings Epay Methods Clarity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make payment settings clearer by moving legacy Epay payment methods into the Epay gateway tab and adding explicit wallet-display guidance for top-up amount options.

**Architecture:** This is a frontend-only UI/i18n adjustment. The existing `PayMethods` form field, validation, save key, and backend behavior remain unchanged; only its placement and copy change. Translation entries are added only to `en.json` and `zh.json` as requested.

**Tech Stack:** React 19, TypeScript, react-hook-form, i18next, Bun, Rsbuild

---

## File Structure

- Modify `web/default/src/features/system-settings/integrations/payment-settings-section.tsx`
  - Move the existing `PayMethods` `FormField` block from General Settings into the Epay tab inside the `epayEnabled` fragment.
  - Change the label to `Epay payment methods`.
  - Change the description to clarify legacy Epay-only usage.
  - Append wallet display condition text to the `AmountOptions` description.

- Modify `web/default/src/i18n/locales/en.json`
  - Add English entries for the new/clarified keys.
  - Ensure existing `Payment Gateways` and gateway description keys are present.

- Modify `web/default/src/i18n/locales/zh.json`
  - Add Chinese translations for the new/clarified keys.
  - Ensure existing `Payment Gateways` and gateway description keys are present.

---

### Task 1: Move PayMethods editor into Epay tab

**Files:**
- Modify: `web/default/src/features/system-settings/integrations/payment-settings-section.tsx`

- [ ] **Step 1: Remove the PayMethods block from General Settings**

In `payment-settings-section.tsx`, locate the `FormField` with `name='PayMethods'` currently between General Settings minimum top-up fields and the `AmountOptions` / `AmountDiscount` grid. Remove that entire `FormField` block from its current location.

The removed block starts with:

```tsx
<FormField
  control={form.control}
  name='PayMethods'
```

and ends with:

```tsx
/>
```

right before:

```tsx
<div className='grid gap-6 md:grid-cols-2 md:items-start'>
```

- [ ] **Step 2: Insert the PayMethods block inside the Epay enabled fragment**

Find the Epay tab content. Inside:

```tsx
{epayEnabled && (
  <>
```

insert the `PayMethods` `FormField` after the Epay credential grid that contains `EpayId` and `EpayKey`, before the closing `</>` of the Epay fragment.

Use this exact block:

```tsx
<FormField
  control={form.control}
  name='PayMethods'
  render={({ field }) => (
    <FormItem>
      <div className='mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between'>
        <FormLabel>{t('Epay payment methods')}</FormLabel>
        <Button
          type='button'
          variant='outline'
          size='sm'
          onClick={() => setPayMethodsVisualMode(!payMethodsVisualMode)}
          className='w-full sm:w-auto'
        >
          {payMethodsVisualMode ? (
            <>
              <Code2 className='mr-2 h-3 w-3' />
              {t('JSON Editor')}
            </>
          ) : (
            <>
              <Eye className='mr-2 h-3 w-3' />
              {t('Visual Editor')}
            </>
          )}
        </Button>
      </div>
      <FormControl>
        {payMethodsVisualMode ? (
          <PaymentMethodsVisualEditor
            value={field.value}
            onChange={field.onChange}
          />
        ) : (
          <Textarea
            rows={4}
            placeholder={t(
              '[{"name":"支付宝","type":"alipay","color":"#1677FF"}]'
            )}
            {...field}
            onChange={(event) => field.onChange(event.target.value)}
          />
        )}
      </FormControl>
      <FormDescription>
        {t(
          'Only used by the legacy Epay gateway. Native Alipay and WeChat Pay are configured in their own gateway tabs.'
        )}
      </FormDescription>
      <FormMessage />
    </FormItem>
  )}
/>
```

- [ ] **Step 3: Confirm behavior is unchanged**

No save logic should change. The same `PayMethods` form value should still be included in `sanitized.PayMethods`, compared with `initial.PayMethods`, and saved with key `PayMethods`.

---

### Task 2: Add wallet-display helper text to top-up amount options

**Files:**
- Modify: `web/default/src/features/system-settings/integrations/payment-settings-section.tsx`

- [ ] **Step 1: Update the AmountOptions description**

Find the `FormField` with `name='AmountOptions'` and replace its `FormDescription` content:

```tsx
<FormDescription>
  {t('Preset recharge amounts (JSON array)')}
</FormDescription>
```

with:

```tsx
<FormDescription>
  {t('Preset recharge amounts (JSON array)')}
  {' '}
  {t(
    'Displayed on the wallet page only when at least one amount-based payment gateway is enabled.'
  )}
</FormDescription>
```

---

### Task 3: Add English and Chinese translations

**Files:**
- Modify: `web/default/src/i18n/locales/en.json`
- Modify: `web/default/src/i18n/locales/zh.json`

- [ ] **Step 1: Add/verify English keys in `en.json`**

Inside the top-level `translation` object, add these entries if they do not already exist:

```json
"Payment Gateways": "Payment Gateways",
"Enable a gateway first, then fill in the required configuration fields.": "Enable a gateway first, then fill in the required configuration fields.",
"Epay payment methods": "Epay payment methods",
"Only used by the legacy Epay gateway. Native Alipay and WeChat Pay are configured in their own gateway tabs.": "Only used by the legacy Epay gateway. Native Alipay and WeChat Pay are configured in their own gateway tabs.",
"Displayed on the wallet page only when at least one amount-based payment gateway is enabled.": "Displayed on the wallet page only when at least one amount-based payment gateway is enabled."
```

Keep valid JSON syntax: comma-separated entries, no trailing comma after the last property.

- [ ] **Step 2: Add/verify Chinese keys in `zh.json`**

Inside the top-level `translation` object, add these entries if they do not already exist:

```json
"Payment Gateways": "支付网关",
"Enable a gateway first, then fill in the required configuration fields.": "请先启用一个支付网关，然后填写所需的配置字段。",
"Epay payment methods": "Epay 支付方式",
"Only used by the legacy Epay gateway. Native Alipay and WeChat Pay are configured in their own gateway tabs.": "仅用于旧版 Epay 网关。独立支付宝和微信支付请在各自的网关标签页配置。",
"Displayed on the wallet page only when at least one amount-based payment gateway is enabled.": "仅当至少启用一个按金额充值的支付网关时，会在钱包页显示。"
```

Keep valid JSON syntax: comma-separated entries, no trailing comma after the last property.

---

### Task 4: Verify

**Files:**
- No code changes beyond Tasks 1-3.

- [ ] **Step 1: Run TypeScript check**

Run:

```bash
cd web/default && bun run typecheck
```

Expected result:

```text
$ tsc -b
```

with exit code `0`.

- [ ] **Step 2: Run frontend build**

Run:

```bash
cd web/default && bun run build
```

Expected result:

```text
ready   built in ...
```

with exit code `0`.

- [ ] **Step 3: Manual UI verification checklist**

Open `/system-settings/billing/payment` and verify:

- General Settings no longer displays `Payment methods` / `Epay payment methods`.
- Epay tab displays `Epay payment methods` when Epay is enabled.
- The Epay payment methods visual/JSON toggle still works.
- `Top-up amount options` description includes the wallet-display condition.
- With Chinese UI active, `Payment Gateways` displays as `支付网关` and its description displays as `请先启用一个支付网关，然后填写所需的配置字段。`.

---

## Self-Review

- Spec coverage: All requested UI moves, wording updates, and en/zh translation updates are covered.
- Placeholder scan: No placeholders or deferred implementation notes remain.
- Type consistency: Existing `PayMethods` field, `payMethodsVisualMode`, `PaymentMethodsVisualEditor`, and save key remain unchanged.
- Scope check: This is a focused frontend-only change with no backend schema or API changes.

