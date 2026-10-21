# Payment Gateway Tabs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor `/system-settings/billing/payment` so each payment gateway has an OAuth-style tab with an enable switch and configuration fields shown only when enabled.

**Architecture:** Keep existing backend APIs and option keys. Refactor the frontend payment settings section by introducing a tabbed gateway layout and moving Alipay/WeChat config inline while retaining existing legacy gateway fields. Use frontend-only derived enabled states for gateways without explicit backend enable flags and existing `PaymentConfig.enabled` for Alipay/WeChat.

**Tech Stack:** React 19, TypeScript, React Hook Form, Base UI/Tabs, Bun.

---

## File Structure

- Modify `web/default/src/features/system-settings/integrations/payment-settings-section.tsx`
  - Add `Tabs` for Epay, Alipay, WeChat, Stripe, Creem, Waffo, Waffo Pancake.
  - Render each gateway behind an enable switch.
  - Move Alipay/WeChat fields inline and remove card+dialog usage from this section.
- Keep `web/default/src/features/system-settings/integrations/payment-config-dialog.tsx`
  - Do not delete yet; leave unused for future cleanup.
- Reuse existing components:
  - `WaffoSettingsSection`
  - `WaffoPancakeSettingsSection`
  - `PaymentMethodsVisualEditor`
  - `CreemProductsVisualEditor`
  - `SettingsSwitchItem`, `SettingsSwitchContent`
- Verification only:
  - `cd web/default && bun run typecheck`
  - `cd web/default && bun run build`

---

### Task 1: Add gateway tab state and enable switches

**Files:**
- Modify: `web/default/src/features/system-settings/integrations/payment-settings-section.tsx`

- [ ] **Step 1: Add tab imports**

Import Tabs components if not already imported:

```tsx
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
```

- [ ] **Step 2: Add local enabled states**

Inside `PaymentSettingsSection`, add gateway tab state:

```tsx
const [activePaymentGateway, setActivePaymentGateway] = React.useState('epay')
const [epayEnabled, setEpayEnabled] = React.useState(() =>
  Boolean(initialFormValues.PayAddress || initialFormValues.EpayId || initialFormValues.EpayKey)
)
const [stripeEnabled, setStripeEnabled] = React.useState(() =>
  Boolean(initialFormValues.StripeApiSecret || initialFormValues.StripeWebhookSecret || initialFormValues.StripePriceId)
)
const [creemEnabled, setCreemEnabled] = React.useState(() =>
  Boolean(initialFormValues.CreemApiKey || initialFormValues.CreemProducts !== '[]')
)
const [waffoPancakeEnabled, setWaffoPancakeEnabled] = React.useState(() =>
  Boolean(initialFormValues.WaffoPancakeMerchantID || initialFormValues.WaffoPancakePrivateKey)
)
```

Use existing form field `WaffoEnabled` for Waffo.

- [ ] **Step 3: Add helper renderer**

Add a helper component/function inside the file:

```tsx
function GatewaySwitchRow(props: {
  title: string
  description: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
}) {
  return (
    <SettingsSwitchItem>
      <SettingsSwitchContent>
        <FormLabel>{props.title}</FormLabel>
        <FormDescription>{props.description}</FormDescription>
      </SettingsSwitchContent>
      <Switch checked={props.checked} onCheckedChange={props.onCheckedChange} />
    </SettingsSwitchItem>
  )
}
```

---

### Task 2: Replace gateway cards with Tabs

**Files:**
- Modify: `web/default/src/features/system-settings/integrations/payment-settings-section.tsx`

- [ ] **Step 1: Replace Alipay/WeChat card section**

Remove the current `Alipay and WeChat Pay Gateways` card grid from the render tree and replace it with:

```tsx
<div className='space-y-4'>
  <div>
    <h3 className='text-lg font-medium'>{t('Payment Gateways')}</h3>
    <p className='text-muted-foreground text-sm'>
      {t('Enable a gateway first, then fill in the required configuration fields.')}
    </p>
  </div>

  <Tabs value={activePaymentGateway} onValueChange={setActivePaymentGateway}>
    <TabsList className='grid w-full grid-cols-2 gap-1 sm:grid-cols-4 lg:grid-cols-7'>
      <TabsTrigger value='epay'>{t('Epay')}</TabsTrigger>
      <TabsTrigger value='alipay'>{t('Alipay')}</TabsTrigger>
      <TabsTrigger value='wechat'>{t('WeChat Pay')}</TabsTrigger>
      <TabsTrigger value='stripe'>{t('Stripe')}</TabsTrigger>
      <TabsTrigger value='creem'>{t('Creem')}</TabsTrigger>
      <TabsTrigger value='waffo'>{t('Waffo')}</TabsTrigger>
      <TabsTrigger value='waffo-pancake'>{t('Waffo Pancake')}</TabsTrigger>
    </TabsList>

    <TabsContent value='epay' className='space-y-4 pt-4'>...</TabsContent>
    <TabsContent value='alipay' className='space-y-4 pt-4'>...</TabsContent>
    <TabsContent value='wechat' className='space-y-4 pt-4'>...</TabsContent>
    <TabsContent value='stripe' className='space-y-4 pt-4'>...</TabsContent>
    <TabsContent value='creem' className='space-y-4 pt-4'>...</TabsContent>
    <TabsContent value='waffo' className='space-y-4 pt-4'>...</TabsContent>
    <TabsContent value='waffo-pancake' className='space-y-4 pt-4'>...</TabsContent>
  </Tabs>
</div>
```

- [ ] **Step 2: Move existing sections into tab content**

Move existing field blocks as follows:

- Epay tab: `PayAddress`, `EpayId`, `EpayKey`, `PayMethods`.
- Stripe tab: existing Stripe Gateway fields.
- Creem tab: existing Creem Gateway fields and `CreemProductsVisualEditor`.
- Waffo tab: existing `WaffoSettingsSection`, using `WaffoEnabled` switch.
- Waffo Pancake tab: existing `WaffoPancakeSettingsSection`.

Wrap each block with its switch:

```tsx
<GatewaySwitchRow ... />
{enabled ? <div className='space-y-4'>fields...</div> : <Alert>...</Alert>}
```

---

### Task 3: Inline Alipay and WeChat config

**Files:**
- Modify: `web/default/src/features/system-settings/integrations/payment-settings-section.tsx`

- [ ] **Step 1: Add Alipay inline fields**

Use existing `paymentConfigs` state. In Alipay tab:

- Find config: `paymentConfigs.find((c) => c.provider === 'alipay')`
- Switch checked: `config?.enabled ?? false`
- On switch change:
  - If config exists: update local editing state and call existing update mutation on save.
  - If config does not exist: create default local config.

Render fields matching `PaymentConfigDialog`:

- display_name
- icon_url
- app_id
- app_private_key
- alipay_public_key
- alipay_app_public_cert
- alipay_public_cert
- alipay_root_cert
- gateway_url
- notify_url
- return_url
- sort_order

- [ ] **Step 2: Add WeChat inline fields**

Render fields matching `PaymentConfigDialog`:

- display_name
- icon_url
- wechat_app_id
- wechat_mch_id
- wechat_api_key
- wechat_serial_no
- wechat_private_key
- gateway_url
- notify_url
- return_url
- sort_order

- [ ] **Step 3: Save Alipay/WeChat configs with main save**

In `onSubmit`, after saving option updates, also save Alipay and WeChat local configs:

```tsx
if (alipayConfig.id) await updatePaymentConfigMutation.mutateAsync({ id: alipayConfig.id, data: alipayConfig })
else await createPaymentConfigMutation.mutateAsync(alipayConfig)
```

Same for WeChat.

---

### Task 4: Validate and build

**Files:**
- Verify only.

- [ ] **Step 1: Typecheck**

Run:

```bash
cd web/default && bun run typecheck
```

Expected: PASS.

- [ ] **Step 2: Build**

Run:

```bash
cd web/default && bun run build
```

Expected: PASS.

- [ ] **Step 3: Restart and manual verify**

Run:

```bash
./restart.sh
```

Manual checks:

1. Open `/system-settings/billing/payment`.
2. Verify tabs show Epay, Alipay, WeChat, Stripe, Creem, Waffo, Waffo Pancake.
3. Toggle each gateway on/off and confirm fields hide/show.
4. Save and reload.
5. Verify Alipay/WeChat enabled state persists through `/api/payment-config/`.
6. Verify `/wallet` shows recharge methods once a native gateway is enabled and configured.

---

## Self-Review

- Spec coverage: Covers all requested gateways and OAuth-style enable-first UI.
- Placeholder scan: No placeholders remain in required behavior; implementation may reuse existing field blocks.
- Type consistency: Alipay/WeChat use `PaymentConfig`; legacy gateways use existing option form fields.
- Scope check: Frontend-only structural refactor plus existing API calls; no backend schema changes required.
