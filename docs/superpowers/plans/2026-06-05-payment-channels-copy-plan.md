# Payment Channels Copy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename the inner payment gateway tabs area to payment channels so the payment settings page does not show duplicate `Payment Gateway / 支付网关` wording.

**Architecture:** This is a frontend-only copy/i18n change. The outer page/section title remains `Payment Gateway`; only the inner tabs heading, helper description, and local save button copy change to `Payment Channels` wording. English and Chinese locale files are updated explicitly.

**Tech Stack:** React 19, TypeScript, i18next, Bun, Rsbuild

---

## File Structure

- Modify `web/default/src/features/system-settings/integrations/payment-settings-section.tsx`
  - Change inner tabs title and description keys.
  - Change local save button key.

- Modify `web/default/src/i18n/locales/en.json`
  - Add English entries for the new channel wording.

- Modify `web/default/src/i18n/locales/zh.json`
  - Add Chinese entries for the new channel wording.

---

### Task 1: Update inner tabs copy keys

**Files:**
- Modify: `web/default/src/features/system-settings/integrations/payment-settings-section.tsx`

- [ ] **Step 1: Change the inner title**

Replace:

```tsx
<h3 className='text-lg font-medium'>{t('Payment Gateways')}</h3>
```

with:

```tsx
<h3 className='text-lg font-medium'>{t('Payment Channels')}</h3>
```

- [ ] **Step 2: Change the inner helper description**

Replace:

```tsx
{t('Enable a gateway first, then fill in the required configuration fields.')}
```

with:

```tsx
{t('Enable a payment channel first, then fill in the required configuration fields.')}
```

- [ ] **Step 3: Change the local save button text**

Replace:

```tsx
: t('Save payment gateway settings')}
```

with:

```tsx
: t('Save payment channel settings')}
```

---

### Task 2: Update English and Chinese translations

**Files:**
- Modify: `web/default/src/i18n/locales/en.json`
- Modify: `web/default/src/i18n/locales/zh.json`

- [ ] **Step 1: Add English entries**

Inside `web/default/src/i18n/locales/en.json` top-level `translation` object, add these entries if missing:

```json
"Payment Channels": "Payment Channels",
"Enable a payment channel first, then fill in the required configuration fields.": "Enable a payment channel first, then fill in the required configuration fields.",
"Save payment channel settings": "Save payment channel settings"
```

Keep JSON valid.

- [ ] **Step 2: Add Chinese entries**

Inside `web/default/src/i18n/locales/zh.json` top-level `translation` object, add these entries if missing:

```json
"Payment Channels": "支付渠道",
"Enable a payment channel first, then fill in the required configuration fields.": "请先启用一个支付渠道，然后填写所需的配置字段。",
"Save payment channel settings": "保存支付渠道设置"
```

Keep JSON valid.

---

### Task 3: Verify

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

- Spec coverage: Covers title, helper description, save button, and en/zh translations.
- Placeholder scan: No placeholders remain.
- Type consistency: Existing React/i18n `t(...)` pattern is preserved.
- Scope check: Frontend copy-only change; no backend behavior changes.
