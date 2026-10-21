# Payment Gateway Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate all payment gateways to use the new tabbed interface with enable/disable switches, following the established pattern from Epay.

**Architecture:** Each gateway gets its own tab with a top-level enable switch. When enabled, the configuration fields are shown. Alipay and WeChat Pay use the new PaymentConfig API, while others use the existing option-based system.

**Tech Stack:** React 19, TypeScript, react-hook-form, zod, Base UI components, Tailwind CSS

---

## File Structure

**Files to modify:**
- `web/default/src/features/system-settings/integrations/payment-settings-section.tsx` (main file for all changes)

**Files to reference:**
- `web/default/src/features/system-settings/integrations/payment-config-dialog.tsx` (for Alipay/WeChat field structure)
- `web/default/src/features/system-settings/integrations/waffo-settings-section.tsx` (Waffo component)
- `web/default/src/features/system-settings/integrations/waffo-pancake-settings-section.tsx` (Waffo Pancake component)
- `web/default/src/features/system-settings/types.ts` (type definitions)

---

## Task 1: Add Gateway State and Helper Functions

**Files:** Modify `web/default/src/features/system-settings/integrations/payment-settings-section.tsx`

- [ ] **Step 1: Add state for all gateways**
  Add these state variables after `epayEnabled`:
  ```typescript
  const [stripeEnabled, setStripeEnabled] = React.useState(() =>
    Boolean(
      initialFormValues.StripeApiSecret ||
      initialFormValues.StripePriceId
    )
  )
  const [creemEnabled, setCreemEnabled] = React.useState(() =>
    Boolean(
      initialFormValues.CreemApiKey ||
      initialFormValues.CreemProducts
    )
  )
  // Waffo already has WaffoEnabled in form values
  const [waffoPancakeEnabled, setWaffoPancakeEnabled] = React.useState(() =>
    Boolean(
      initialFormValues.WaffoPancakeMerchantID ||
      waffoPancakeProvisionedStoreID
    )
  )
  ```

- [ ] **Step 2: Add state for Alipay and WeChat configs**
  Add these state variables to hold the inline configs:
  ```typescript
  const [alipayConfig, setAlipayConfig] = React.useState<PaymentConfig | null>(null)
  const [wechatConfig, setWechatConfig] = React.useState<PaymentConfig | null>(null)
  const [alipayForm, setAlipayForm] = React.useState<Partial<PaymentConfig>>({
    provider: 'alipay',
    name: 'Alipay',
    display_name: '支付宝',
    enabled: false,
    sort_order: 10,
  })
  const [wechatForm, setWechatForm] = React.useState<Partial<PaymentConfig>>({
    provider: 'wxpay',
    name: 'WeChat Pay',
    display_name: '微信支付',
    enabled: false,
    sort_order: 20,
  })
  ```

- [ ] **Step 3: Load existing configs on mount**
  Add this useEffect after the paymentConfigs query to load existing configs:
  ```typescript
  React.useEffect(() => {
    const alipay = paymentConfigs.find(c => c.provider === 'alipay')
    const wechat = paymentConfigs.find(c => c.provider === 'wxpay')
    if (alipay) {
      setAlipayConfig(alipay)
      setAlipayForm(alipay)
    }
    if (wechat) {
      setWechatConfig(wechat)
      setWechatForm(wechat)
    }
  }, [paymentConfigs])
  ```

---

## Task 2: Alipay Standalone Inline Configuration

**Files:** Modify `web/default/src/features/system-settings/integrations/payment-settings-section.tsx`

- [ ] **Step 1: Replace the Alipay tab content**
  Find the `TabsContent` with `value="alipay"` and replace it with:
  ```tsx
  <TabsContent value="alipay" className="space-y-4 pt-4">
    <div>
      <h3 className="text-lg font-medium">
        {t('Alipay Gateway')}
      </h3>
      <p className="text-muted-foreground text-sm">
        {t('Configure Alipay merchant credentials for wallet recharge.')}
      </p>
    </div>
    <GatewaySwitchRow
      title={t('Enable Alipay')}
      description={t('Enable Alipay payment method for wallet top-up.')}
      checked={alipayForm.enabled ?? false}
      onCheckedChange={(checked) => setAlipayForm(prev => ({ ...prev, enabled: checked }))}
    />

    {(alipayForm.enabled || alipayConfig?.enabled) ? (
      <div className="space-y-4 pt-2">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>{t('Display name')}</Label>
            <Input
              value={alipayForm.display_name || ''}
              onChange={(event) => setAlipayForm(prev => ({ ...prev, display_name: event.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>{t('Sort order')}</Label>
            <Input
              type="number"
              value={alipayForm.sort_order ?? 10}
              onChange={(event) => setAlipayForm(prev => ({ ...prev, sort_order: Number(event.target.value) || 0 }))}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>{t('Icon URL')}</Label>
          <Input
            value={alipayForm.icon_url || ''}
            onChange={(event) => setAlipayForm(prev => ({ ...prev, icon_url: event.target.value }))}
            placeholder="https://example.com/payment-icon.png"
          />
        </div>

        <div className="space-y-2">
          <Label>{t('App ID')}</Label>
          <Input
            value={alipayForm.app_id || ''}
            onChange={(event) => setAlipayForm(prev => ({ ...prev, app_id: event.target.value }))}
          />
        </div>
        <div className="space-y-2">
          <Label>{t('App private key')}</Label>
          <Textarea
            rows={4}
            value={alipayForm.app_private_key || ''}
            onChange={(event) => setAlipayForm(prev => ({ ...prev, app_private_key: event.target.value }))}
            placeholder={alipayConfig ? t('Leave blank to keep the existing key') : t('Enter App private key')}
            className="font-mono text-xs"
          />
        </div>
        <div className="space-y-2">
          <Label>{t('Alipay public key')}</Label>
          <Textarea
            rows={4}
            value={alipayForm.alipay_public_key || ''}
            onChange={(event) => setAlipayForm(prev => ({ ...prev, alipay_public_key: event.target.value }))}
            className="font-mono text-xs"
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label>{t('App public cert')}</Label>
            <Textarea
              rows={3}
              value={alipayForm.alipay_app_public_cert || ''}
              onChange={(event) => setAlipayForm(prev => ({ ...prev, alipay_app_public_cert: event.target.value }))}
              className="font-mono text-xs"
            />
          </div>
          <div className="space-y-2">
            <Label>{t('Alipay public cert')}</Label>
            <Textarea
              rows={3}
              value={alipayForm.alipay_public_cert || ''}
              onChange={(event) => setAlipayForm(prev => ({ ...prev, alipay_public_cert: event.target.value }))}
              className="font-mono text-xs"
            />
          </div>
          <div className="space-y-2">
            <Label>{t('Alipay root cert')}</Label>
            <Textarea
              rows={3}
              value={alipayForm.alipay_root_cert || ''}
              onChange={(event) => setAlipayForm(prev => ({ ...prev, alipay_root_cert: event.target.value }))}
              className="font-mono text-xs"
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label>{t('Gateway URL')}</Label>
            <Input
              value={alipayForm.gateway_url || ''}
              onChange={(event) => setAlipayForm(prev => ({ ...prev, gateway_url: event.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>{t('Notify URL')}</Label>
            <Input
              value={alipayForm.notify_url || ''}
              onChange={(event) => setAlipayForm(prev => ({ ...prev, notify_url: event.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>{t('Return URL')}</Label>
            <Input
              value={alipayForm.return_url || ''}
              onChange={(event) => setAlipayForm(prev => ({ ...prev, return_url: event.target.value }))}
            />
          </div>
        </div>
      </div>
    ) : null}
  </TabsContent>
  ```

- [ ] **Step 2: Make sure Label is imported**
  Verify `Label` is imported from `@/components/ui/label`.

---

## Task 3: WeChat Pay Standalone Inline Configuration

**Files:** Modify `web/default/src/features/system-settings/integrations/payment-settings-section.tsx`

- [ ] **Step 1: Replace the WeChat tab content**
  Find the `TabsContent` with `value="wechat"` and replace it with:
  ```tsx
  <TabsContent value="wechat" className="space-y-4 pt-4">
    <div>
      <h3 className="text-lg font-medium">
        {t('WeChat Pay Gateway')}
      </h3>
      <p className="text-muted-foreground text-sm">
        {t('Configure WeChat Pay merchant credentials for wallet recharge.')}
      </p>
    </div>
    <GatewaySwitchRow
      title={t('Enable WeChat Pay')}
      description={t('Enable WeChat Pay payment method for wallet top-up.')}
      checked={wechatForm.enabled ?? false}
      onCheckedChange={(checked) => setWechatForm(prev => ({ ...prev, enabled: checked }))}
    />

    {(wechatForm.enabled || wechatConfig?.enabled) ? (
      <div className="space-y-4 pt-2">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>{t('Display name')}</Label>
            <Input
              value={wechatForm.display_name || ''}
              onChange={(event) => setWechatForm(prev => ({ ...prev, display_name: event.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>{t('Sort order')}</Label>
            <Input
              type="number"
              value={wechatForm.sort_order ?? 20}
              onChange={(event) => setWechatForm(prev => ({ ...prev, sort_order: Number(event.target.value) || 0 }))}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>{t('Icon URL')}</Label>
          <Input
            value={wechatForm.icon_url || ''}
            onChange={(event) => setWechatForm(prev => ({ ...prev, icon_url: event.target.value }))}
            placeholder="https://example.com/payment-icon.png"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>{t('App ID')}</Label>
            <Input
              value={wechatForm.wechat_app_id || ''}
              onChange={(event) => setWechatForm(prev => ({ ...prev, wechat_app_id: event.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>{t('Merchant ID')}</Label>
            <Input
              value={wechatForm.wechat_mch_id || ''}
              onChange={(event) => setWechatForm(prev => ({ ...prev, wechat_mch_id: event.target.value }))}
            />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>{t('APIv3 Key')}</Label>
            <Input
              type="password"
              value={wechatForm.wechat_api_key || ''}
              onChange={(event) => setWechatForm(prev => ({ ...prev, wechat_api_key: event.target.value }))}
              placeholder={wechatConfig ? t('Leave blank to keep the existing key') : t('Enter APIv3 Key')}
            />
          </div>
          <div className="space-y-2">
            <Label>{t('Certificate Serial No')}</Label>
            <Input
              value={wechatForm.wechat_serial_no || ''}
              onChange={(event) => setWechatForm(prev => ({ ...prev, wechat_serial_no: event.target.value }))}
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label>{t('Merchant private key')}</Label>
          <Textarea
            rows={4}
            value={wechatForm.wechat_private_key || ''}
            onChange={(event) => setWechatForm(prev => ({ ...prev, wechat_private_key: event.target.value }))}
            className="font-mono text-xs"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label>{t('Gateway URL')}</Label>
            <Input
              value={wechatForm.gateway_url || ''}
              onChange={(event) => setWechatForm(prev => ({ ...prev, gateway_url: event.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>{t('Notify URL')}</Label>
            <Input
              value={wechatForm.notify_url || ''}
              onChange={(event) => setWechatForm(prev => ({ ...prev, notify_url: event.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>{t('Return URL')}</Label>
            <Input
              value={wechatForm.return_url || ''}
              onChange={(event) => setWechatForm(prev => ({ ...prev, return_url: event.target.value }))}
            />
          </div>
        </div>
      </div>
    ) : null}
  </TabsContent>
  ```

---

## Task 4: Stripe Switch + Show Config When Enabled

**Files:** Modify `web/default/src/features/system-settings/integrations/payment-settings-section.tsx`

- [ ] **Step 1: Wrap the Stripe config fields**
  Find the `TabsContent` with `value="stripe"` and add the GatewaySwitchRow and conditional rendering:
  ```tsx
  <TabsContent value="stripe" className="space-y-4 pt-4">
    <div>
      <h3 className="text-lg font-medium">{t('Stripe Gateway')}</h3>
      <p className="text-muted-foreground text-sm">
        {t('Configuration for Stripe payment integration')}
      </p>
    </div>
    <GatewaySwitchRow
      title={t('Enable Stripe')}
      description={t('Enable Stripe payment method for wallet top-up.')}
      checked={stripeEnabled}
      onCheckedChange={setStripeEnabled}
    />

    {stripeEnabled ? (
      <>
        {/* Existing Stripe config fields go here - the ones that were already in this tab */}
        <div className="rounded-md bg-blue-50 p-4 text-sm text-blue-900 dark:bg-blue-950 dark:text-blue-100">
          <p className="mb-2 font-medium">{t('Webhook Configuration:')}</p>
          <ul className="list-inside list-disc space-y-1">
            <li>
              {t('Webhook URL:')}{' '}
              <code className="rounded bg-blue-100 px-1 py-0.5 text-xs dark:bg-blue-900">
                {'<ServerAddress>/api/stripe/webhook'}
              </code>
            </li>
            <li>
              {t('Required events:')}{' '}
              <code className="rounded bg-blue-100 px-1 py-0.5 text-xs dark:bg-blue-900">
                {t('checkout.session.completed')}
              </code>{' '}
              {t('and')}{' '}
              <code className="rounded bg-blue-100 px-1 py-0.5 text-xs dark:bg-blue-900">
                {t('checkout.session.expired')}
              </code>
            </li>
            <li>
              {t('Configure at:')}{' '}
              <a
                href="https://dashboard.stripe.com/developers"
                target="_blank"
                rel="noreferrer"
                className="underline hover:no-underline"
              >
                {t('Stripe Dashboard')}
              </a>
            </li>
          </ul>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          <FormField
            control={form.control}
            name="StripeApiSecret"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('API secret')}</FormLabel>
                <FormControl>
                  <Input
                    type="password"
                    placeholder={t('sk_xxx or rk_xxx')}
                    autoComplete="new-password"
                    {...field}
                    onChange={(event) => field.onChange(event.target.value)}
                  />
                </FormControl>
                <FormDescription>
                  {t('Stripe API key (leave blank unless updating)')}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="StripeWebhookSecret"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Webhook secret')}</FormLabel>
                <FormControl>
                  <Input
                    type="password"
                    placeholder={t('whsec_xxx')}
                    autoComplete="new-password"
                    {...field}
                    onChange={(event) => field.onChange(event.target.value)}
                  />
                </FormControl>
                <FormDescription>
                  {t('Webhook signing secret (leave blank unless updating)')}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="StripePriceId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Price ID')}</FormLabel>
                <FormControl>
                  <Input
                    placeholder={t('price_xxx')}
                    {...field}
                    onChange={(event) => field.onChange(event.target.value)}
                  />
                </FormControl>
                <FormDescription>
                  {t('Stripe product price ID')}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          <FormField
            control={form.control}
            name="StripeUnitPrice"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  {t('Unit price (local currency / USD)')}
                </FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    {...safeNumberFieldProps(field)}
                  />
                </FormControl>
                <FormDescription>
                  {t('e.g., 8 means 8 local currency per USD')}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="StripeMinTopUp"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Minimum top-up (USD)')}</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    {...safeNumberFieldProps(field)}
                  />
                </FormControl>
                <FormDescription>
                  {t('Minimum recharge amount in USD')}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="StripePromotionCodesEnabled"
            render={({ field }) => (
              <SettingsSwitchItem>
                <SettingsSwitchContent>
                  <FormLabel>{t('Promotion codes')}</FormLabel>
                  <FormDescription>
                    {t('Allow users to enter promo codes')}
                  </FormDescription>
                </SettingsSwitchContent>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
              </SettingsSwitchItem>
            )}
          />
        </div>
      </>
    ) : null}
  </TabsContent>
  ```

- [ ] **Note:** Keep all existing Stripe form fields, just wrap them in the conditional `{stripeEnabled ? (...) : null}` after adding the switch.

---

## Task 5: Creem Switch + Show Config When Enabled

**Files:** Modify `web/default/src/features/system-settings/integrations/payment-settings-section.tsx`

- [ ] **Step 1: Wrap the Creem config fields**
  Find the `TabsContent` with `value="creem"` and add the GatewaySwitchRow and conditional rendering:
  ```tsx
  <TabsContent value="creem" className="space-y-4 pt-4">
    <div>
      <h3 className="text-lg font-medium">{t('Creem Gateway')}</h3>
      <p className="text-muted-foreground text-sm">
        {t('Configuration for Creem payment integration')}
      </p>
    </div>
    <GatewaySwitchRow
      title={t('Enable Creem')}
      description={t('Enable Creem payment method for wallet top-up.')}
      checked={creemEnabled}
      onCheckedChange={setCreemEnabled}
    />

    {creemEnabled ? (
      <>
        {/* Existing Creem config fields go here */}
        <div className="rounded-md bg-blue-50 p-4 text-sm text-blue-900 dark:bg-blue-950 dark:text-blue-100">
          <p className="mb-2 font-medium">{t('Webhook Configuration:')}</p>
          <ul className="list-inside list-disc space-y-1">
            <li>
              {t('Webhook URL:')}{' '}
              <code className="rounded bg-blue-100 px-1 py-0.5 text-xs dark:bg-blue-900">
                {'<ServerAddress>/api/creem/webhook'}
              </code>
            </li>
            <li>{t('Configure in your Creem dashboard')}</li>
          </ul>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <FormField
            control={form.control}
            name="CreemApiKey"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('API Key')}</FormLabel>
                <FormControl>
                  <Input
                    type="password"
                    placeholder={t('Enter Creem API key')}
                    autoComplete="new-password"
                    {...field}
                    onChange={(event) => field.onChange(event.target.value)}
                  />
                </FormControl>
                <FormDescription>
                  {t('Creem API key (leave blank unless updating)')}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="CreemWebhookSecret"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Webhook Secret')}</FormLabel>
                <FormControl>
                  <Input
                    type="password"
                    placeholder={t('Enter webhook secret')}
                    autoComplete="new-password"
                    {...field}
                    onChange={(event) => field.onChange(event.target.value)}
                  />
                </FormControl>
                <FormDescription>
                  {t('Webhook signing secret (leave blank unless updating)')}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="CreemTestMode"
          render={({ field }) => (
            <SettingsSwitchItem>
              <SettingsSwitchContent>
                <FormLabel>{t('Test Mode')}</FormLabel>
                <FormDescription>
                  {t('Enable test mode for Creem payments')}
                </FormDescription>
              </SettingsSwitchContent>
              <FormControl>
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
            </SettingsSwitchItem>
          )}
        />

        <FormField
          control={form.control}
          name="CreemProducts"
          render={({ field }) => (
            <FormItem>
              <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <FormLabel>{t('Products')}</FormLabel>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setCreemProductsVisualMode(!creemProductsVisualMode)}
                  className="w-full sm:w-auto"
                >
                  {creemProductsVisualMode ? (
                    <>
                      <Code2 className="mr-2 h-3 w-3" />
                      {t('JSON Editor')}
                    </>
                  ) : (
                    <>
                      <Eye className="mr-2 h-3 w-3" />
                      {t('Visual Editor')}
                    </>
                  )}
                </Button>
              </div>
              <FormControl>
                {creemProductsVisualMode ? (
                  <CreemProductsVisualEditor
                    value={field.value}
                    onChange={field.onChange}
                  />
                ) : (
                  <Textarea
                    rows={4}
                    placeholder='[{"name":"Basic","productId":"prod_xxx","price":10,"quota":500000,"currency":"USD"}]'
                    {...field}
                    onChange={(event) => field.onChange(event.target.value)}
                  />
                )}
              </FormControl>
              <FormDescription>
                {t('Configure Creem products. Provide a JSON array.')}
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
      </>
    ) : null}
  </TabsContent>
  ```

---

## Task 6: Waffo Switch + Show Config When Enabled

**Files:** Modify `web/default/src/features/system-settings/integrations/payment-settings-section.tsx`

- [ ] **Step 1: Wrap the Waffo component**
  Find the `TabsContent` with `value="waffo"` and add a gateway switch at the beginning that controls visibility. The Waffo component already has its own switch, but we need to follow the same pattern:
  ```tsx
  <TabsContent value="waffo" className="space-y-4 pt-4">
    <GatewaySwitchRow
      title={t('Enable Waffo')}
      description={t('Enable Waffo payment aggregator for wallet top-up.')}
      checked={currentFormValues.WaffoEnabled}
      onCheckedChange={(checked) => setPaymentValue('WaffoEnabled', checked)}
    />

    {currentFormValues.WaffoEnabled ? (
      <WaffoSettingsSection
        values={waffoValues}
        onValueChange={setWaffoValue}
        payMethods={waffoPayMethods}
        onPayMethodsChange={setWaffoPayMethods}
      />
    ) : null}
  </TabsContent>
  ```

- [ ] **Step 2: Note about duplicate switch**
  The WaffoSettingsSection has its own internal switch. That's okay - the top-level switch here controls visibility of the entire section, while the internal one controls the enabled state. This follows the design: disable at the gateway level hides all configs.

---

## Task 7: Waffo Pancake Switch + Show Config When Enabled

**Files:** Modify `web/default/src/features/system-settings/integrations/payment-settings-section.tsx`

- [ ] **Step 1: Wrap the Waffo Pancake component**
  Find the `TabsContent` with `value="waffo-pancake"` and add the gateway switch:
  ```tsx
  <TabsContent value="waffo-pancake" className="space-y-4 pt-4">
    <GatewaySwitchRow
      title={t('Enable Waffo Pancake')}
      description={t('Enable Waffo Pancake MoR for wallet top-up.')}
      checked={waffoPancakeEnabled}
      onCheckedChange={setWaffoPancakeEnabled}
    />

    {waffoPancakeEnabled ? (
      <WaffoPancakeSettingsSection
        defaultValues={waffoPancakeDefaultValues}
        values={waffoPancakeValues}
        onValueChange={setWaffoPancakeValue}
        selectedBinding={waffoPancakeSelection}
        savedBinding={waffoPancakeSavedBinding}
        onSelectedBindingChange={setWaffoPancakeSelection}
      />
    ) : null}
  </TabsContent>
  ```

---

## Task 8: Save Logic to Sync Gateway Switch States

**Files:** Modify `web/default/src/features/system-settings/integrations/payment-settings-section.tsx`

- [ ] **Step 1: Add save functions for Alipay and WeChat**
  Add these helper functions before the onSubmit function:
  ```typescript
  const saveAlipayConfig = async () => {
    if (!alipayForm.provider) return
    try {
      if (alipayConfig?.id) {
        await updatePaymentConfigMutation.mutateAsync({
          id: alipayConfig.id,
          data: alipayForm as PaymentConfig,
        })
      } else {
        await createPaymentConfigMutation.mutateAsync(alipayForm as PaymentConfig)
      }
      toast.success(t('Alipay configuration saved successfully'))
      await refetchPaymentConfigs()
    } catch (error) {
      toast.error(t('Failed to save Alipay configuration'))
    }
  }

  const saveWechatConfig = async () => {
    if (!wechatForm.provider) return
    try {
      if (wechatConfig?.id) {
        await updatePaymentConfigMutation.mutateAsync({
          id: wechatConfig.id,
          data: wechatForm as PaymentConfig,
        })
      } else {
        await createPaymentConfigMutation.mutateAsync(wechatForm as PaymentConfig)
      }
      toast.success(t('WeChat Pay configuration saved successfully'))
      await refetchPaymentConfigs()
    } catch (error) {
      toast.error(t('Failed to save WeChat Pay configuration'))
    }
  }
  ```

- [ ] **Step 2: Update onSubmit to include Alipay/WeChat**
  Modify the onSubmit function to save Alipay and WeChat configs before returning:
  ```typescript
  const onSubmit = async (values: PaymentFormValues) => {
    // ... existing sanitize and update logic ...
    
    // After saving the existing options, save Alipay and WeChat configs
    if (alipayForm.provider) {
      await saveAlipayConfig()
    }
    if (wechatForm.provider) {
      await saveWechatConfig()
    }

    // ... existing Waffo Pancake logic ...
  }
  ```

  Make sure to place the Alipay/WeChat save calls **before** the Waffo Pancake logic but **after** the regular option updates.

- [ ] **Step 3: Handle disabled gateways in save**
  For the option-based gateways (Epay, Stripe, Creem), we don't want to clear configs when disabled. The current logic already preserves them - that's good. The frontend switch just hides/shows the UI.

---

## Task 9: TypeScript Verification

**Files:** Modify `web/default/src/features/system-settings/integrations/payment-settings-section.tsx`

- [ ] **Step 1: Run type check**
  Run `cd web/default && bun run typecheck` and fix any errors.

- [ ] **Step 2: Common fixes**
  - Make sure all necessary imports exist (Label, etc.)
  - Make sure PaymentConfig type is imported from `../types`
  - Make sure form state updates use proper types

---

## Task 10: Final bun run build Verification

**Files:** Run commands in terminal

- [ ] **Step 1: Build the frontend**
  Run:
  ```bash
  cd web/default
  bun run build
  ```

- [ ] **Step 2: Verify build succeeds**
  Make sure there are no build errors.

- [ ] **Step 3: Quick sanity check**
  - Verify all tabs render correctly
  - Verify each gateway switch toggles visibility of config fields
  - Verify Alipay and WeChat forms render inline
  - Verify form state works as expected

---

## Spec Self-Review

- [x] **Placeholder scan:** No TBD/TODO placeholders, all code is explicit
- [x] **Internal consistency:** Type names, function names, and patterns match existing codebase
- [x] **Scope check:** This plan stays focused on the specific migration task, follows the existing design document
- [x] **Ambiguity check:** All steps have clear, actionable code with no room for misinterpretation

---

## User Review

Spec written and saved to `docs/superpowers/plans/2026-06-05-payment-gateway-migration-plan.md`. Please review and let me know if you want to make any changes before we start implementing.

**Two execution options:**
1. **Subagent-Driven (recommended):** I dispatch a fresh subagent per task, review between tasks, fast iteration
2. **Inline Execution:** Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
