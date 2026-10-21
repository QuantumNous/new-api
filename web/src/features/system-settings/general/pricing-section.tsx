/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery } from '@tanstack/react-query'
import { RefreshCw } from 'lucide-react'
import type { ReactNode } from 'react'
import type { Resolver } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import * as z from 'zod'

import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { api } from '@/lib/api'
import { DEFAULT_CURRENCY_CONFIG } from '@/stores/system-config-store'

import { FormDirtyIndicator } from '../components/form-dirty-indicator'
import { FormNavigationGuard } from '../components/form-navigation-guard'
import {
  SettingsForm,
  SettingsSwitchContent,
  SettingsSwitchItem,
} from '../components/settings-form-layout'
import { SettingsPageFormActions } from '../components/settings-page-context'
import { SettingsSection } from '../components/settings-section'
import { useSettingsForm } from '../hooks/use-settings-form'
import { useUpdateOption } from '../hooks/use-update-option'
import { safeNumberFieldProps } from '../utils/numeric-field'

const createPricingSchema = (t: (key: string) => string) =>
  z
    .object({
      QuotaPerUnit: z.coerce.number().min(0, t('Value must be at least 0')),
      USDExchangeRate: z.coerce
        .number()
        .min(0.0001, t('Exchange rate must be greater than 0')),
      DisplayInCurrencyEnabled: z.boolean(),
      DisplayTokenStatEnabled: z.boolean(),
      general_setting: z.object({
        quota_display_type: z.enum(['USD', 'CNY', 'TOKENS', 'CUSTOM']),
        custom_currency_symbol: z.string().max(8).optional(),
        custom_currency_exchange_rate: z.coerce
          .number()
          .min(0.0001, t('Exchange rate must be greater than 0'))
          .optional(),
      }),
    })
    .superRefine((data, ctx) => {
      const displayType = data.general_setting.quota_display_type

      if (displayType === 'CUSTOM') {
        if (!data.general_setting.custom_currency_symbol?.trim()) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['general_setting', 'custom_currency_symbol'],
            message: t('Custom currency symbol is required'),
          })
        }

        if (data.general_setting.custom_currency_exchange_rate == null) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['general_setting', 'custom_currency_exchange_rate'],
            message: t('Exchange rate is required'),
          })
        }
      }
    })

type PricingFormValues = z.infer<ReturnType<typeof createPricingSchema>>

type PricingSectionProps = {
  defaultValues: PricingFormValues
}

type LiveUsdRate = {
  rate: number
  base: string
  quote: string
  asOf: string
  source: string
  stale: boolean
}

// Reference rate comes from 中国货币网 (人民币汇率中间价, PBOC-authorised source
// via CFETS). The upstream endpoint does not send CORS headers, so it is
// proxied by the backend at /api/option/exchange_rate/usd_cny.
async function fetchLiveUsdCnyRate(): Promise<LiveUsdRate> {
  const res = await api.get('/api/option/exchange_rate/usd_cny', {
    disableDuplicate: true,
  } as Record<string, unknown>)
  const body = res.data as {
    success?: boolean
    message?: string
    stale?: boolean
    data?: {
      rate?: number
      base?: string
      quote?: string
      as_of?: string
      source?: string
    }
  }
  if (!body?.success || !body.data) {
    throw new Error(body?.message || 'Failed to fetch exchange rate')
  }
  const rate = body.data.rate
  if (typeof rate !== 'number' || !Number.isFinite(rate) || rate <= 0) {
    throw new Error('Invalid rate payload')
  }
  return {
    rate,
    base: body.data.base ?? 'USD',
    quote: body.data.quote ?? 'CNY',
    asOf: body.data.as_of ?? '',
    source: body.data.source ?? '',
    stale: body.stale === true,
  }
}

function useLiveUsdCnyRate() {
  return useQuery({
    queryKey: ['live-usd-cny-rate'],
    queryFn: fetchLiveUsdCnyRate,
    staleTime: 5 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    retry: 1,
    refetchOnWindowFocus: false,
  })
}

export function PricingSection({ defaultValues }: PricingSectionProps) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()

  const pricingSchema = createPricingSchema(t)

  const liveUsdCnyQuery = useLiveUsdCnyRate()

  const { form, handleSubmit, handleReset, isDirty, isSubmitting } =
    useSettingsForm<PricingFormValues>({
      resolver: zodResolver(pricingSchema) as Resolver<
        PricingFormValues,
        unknown,
        PricingFormValues
      >,
      defaultValues,
      onSubmit: async (_data, changedFields) => {
        for (const [key, value] of Object.entries(changedFields)) {
          if (value === undefined || value === null) continue
          if (typeof value === 'object') continue

          let serialized: string | boolean = value as string | boolean

          if (typeof value === 'boolean') {
            serialized = String(value)
          } else if (typeof value === 'number') {
            serialized = Number.isFinite(value) ? String(value) : '0'
          }

          await updateOption.mutateAsync({
            key,
            value: serialized,
          })
        }
      },
    })

  const displayType = form.watch('general_setting.quota_display_type') ?? 'USD'
  const displayInCurrencyEnabled = form.watch('DisplayInCurrencyEnabled')
  const showTokensOnlyOption = displayType === 'TOKENS'
  const showQuotaPerUnit =
    displayType === 'TOKENS' ||
    defaultValues.QuotaPerUnit !== DEFAULT_CURRENCY_CONFIG.quotaPerUnit
  const showDisplayInCurrencyOption = displayInCurrencyEnabled === false

  return (
    <>
      <FormNavigationGuard when={isDirty} />

      <SettingsSection title={t('Pricing & Display')}>
        <Form {...form}>
          <SettingsForm onSubmit={handleSubmit}>
            <SettingsPageFormActions
              onSave={handleSubmit}
              onReset={handleReset}
              isSaving={updateOption.isPending || isSubmitting}
              isResetDisabled={!isDirty}
            />
            <FormDirtyIndicator isDirty={isDirty} />
            {showQuotaPerUnit && (
              <FormField
                control={form.control}
                name='QuotaPerUnit'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Quota Per Unit')}</FormLabel>
                    <FormControl>
                      <Input
                        type='number'
                        step='0.01'
                        value={field.value as number}
                        disabled
                        name={field.name}
                        onBlur={field.onBlur}
                        ref={field.ref}
                      />
                    </FormControl>
                    <FormDescription>
                      {t('Number of tokens per unit quota')}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name='general_setting.quota_display_type'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Display Mode')}</FormLabel>
                  <Select
                    items={[
                      { value: 'USD', label: t('USD') },
                      { value: 'CNY', label: t('CNY') },
                      { value: 'CUSTOM', label: t('Custom Currency') },
                      { value: 'TOKENS', label: t('Tokens Only') },
                    ]}
                    value={field.value}
                    onValueChange={field.onChange}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={t('Select display mode')} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent alignItemWithTrigger={false}>
                      <SelectGroup>
                        <SelectItem value='USD'>{t('USD')}</SelectItem>
                        <SelectItem value='CNY'>{t('CNY')}</SelectItem>
                        <SelectItem value='CUSTOM'>
                          {t('Custom Currency')}
                        </SelectItem>
                        {showTokensOnlyOption && (
                          <SelectItem value='TOKENS'>
                            {t('Tokens Only')}
                          </SelectItem>
                        )}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    {t('Choose how quota values are shown to users')}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {displayType !== 'TOKENS' && (
              <>
                <LiveUsdCnyReference
                  query={liveUsdCnyQuery}
                  currentValue={form.watch('USDExchangeRate')}
                  displayType={displayType}
                  onApply={(rate) =>
                    form.setValue('USDExchangeRate', rate, {
                      shouldDirty: true,
                      shouldValidate: true,
                    })
                  }
                />
                <FormField
                  control={form.control}
                  name='USDExchangeRate'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {displayType === 'CNY'
                          ? t('CNY per USD')
                          : displayType === 'USD'
                            ? t('USD Exchange Rate')
                            : t('USD Exchange Rate')}
                      </FormLabel>
                      <FormControl>
                        <Input
                          type='number'
                          step='0.01'
                          {...safeNumberFieldProps(field)}
                        />
                      </FormControl>
                      <FormDescription>
                        {t(
                          'Real exchange rate between USD and your payment gateway currency'
                        )}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
            )}

            {displayType === 'CUSTOM' && (
              <div className='grid gap-4 sm:grid-cols-2'>
                <FormField
                  control={form.control}
                  name='general_setting.custom_currency_symbol'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('Custom Currency Symbol')}</FormLabel>
                      <FormControl>
                        <Input
                          type='text'
                          value={field.value ?? ''}
                          onChange={field.onChange}
                          name={field.name}
                          onBlur={field.onBlur}
                          ref={field.ref}
                          maxLength={8}
                          placeholder={t('e.g. ¥ or HK$')}
                        />
                      </FormControl>
                      <FormDescription>
                        {t('Prefix used when displaying prices')}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name='general_setting.custom_currency_exchange_rate'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('Units per USD')}</FormLabel>
                      <FormControl>
                        <Input
                          type='number'
                          step='0.01'
                          value={field.value ?? ''}
                          onChange={(e) =>
                            field.onChange(
                              e.target.value === ''
                                ? undefined
                                : e.target.valueAsNumber
                            )
                          }
                          name={field.name}
                          onBlur={field.onBlur}
                          ref={field.ref}
                          placeholder={t('e.g. 8 means 1 USD = 8 units')}
                        />
                      </FormControl>
                      <FormDescription>
                        {t('Conversion rate from USD to your custom currency')}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}

            {showDisplayInCurrencyOption && (
              <FormField
                control={form.control}
                name='DisplayInCurrencyEnabled'
                render={({ field }) => (
                  <SettingsSwitchItem>
                    <SettingsSwitchContent>
                      <FormLabel>{t('Display in Currency')}</FormLabel>
                      <FormDescription>
                        {displayType === 'TOKENS'
                          ? t(
                              'Tokens-only mode will show raw quota values regardless of this toggle.'
                            )
                          : t('Show prices in currency instead of quota.')}
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
            )}

            <FormField
              control={form.control}
              name='DisplayTokenStatEnabled'
              render={({ field }) => (
                <SettingsSwitchItem>
                  <SettingsSwitchContent>
                    <FormLabel>{t('Display Token Statistics')}</FormLabel>
                    <FormDescription>
                      {t('Show token usage statistics in the UI')}
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
          </SettingsForm>
        </Form>
      </SettingsSection>
    </>
  )
}

type LiveUsdCnyReferenceProps = {
  query: ReturnType<typeof useLiveUsdCnyRate>
  currentValue: number
  displayType: 'USD' | 'CNY' | 'TOKENS' | 'CUSTOM'
  onApply: (rate: number) => void
}

function LiveUsdCnyReference({
  query,
  currentValue,
  displayType,
  onApply,
}: LiveUsdCnyReferenceProps) {
  const { t } = useTranslation()
  const { data, isFetching, isError, refetch } = query

  const roundedRate = data ? Math.round(data.rate * 10000) / 10000 : null
  const currentIsFinite =
    typeof currentValue === 'number' && Number.isFinite(currentValue)
  const drift =
    roundedRate != null && currentIsFinite && currentValue > 0
      ? ((currentValue - roundedRate) / roundedRate) * 100
      : null
  const canApply =
    roundedRate != null &&
    displayType === 'CNY' &&
    (!currentIsFinite || Math.abs(currentValue - roundedRate) > 0.0001)

  let statusNode: ReactNode
  if (isError) {
    statusNode = (
      <span className='text-destructive text-xs'>
        {t('Failed to load live rate. Check network and retry.')}
      </span>
    )
  } else if (roundedRate == null) {
    statusNode = (
      <span className='text-muted-foreground text-xs'>
        {isFetching ? t('Loading…') : t('No data yet')}
      </span>
    )
  } else {
    statusNode = (
      <>
        <span className='text-foreground font-mono text-base font-semibold'>
          1 USD ≈ {roundedRate.toFixed(4)} CNY
        </span>
        {data?.asOf && (
          <span className='text-muted-foreground text-xs'>
            {t('As of')} {data.asOf}
          </span>
        )}
        {data?.stale && (
          <span className='text-muted-foreground text-xs'>
            {t('(cached, upstream unreachable)')}
          </span>
        )}
        {drift != null && Math.abs(drift) >= 0.5 && (
          <span
            className={
              Math.abs(drift) >= 3
                ? 'text-destructive text-xs'
                : 'text-muted-foreground text-xs'
            }
          >
            {t('Current setting deviates by')} {drift > 0 ? '+' : ''}
            {drift.toFixed(2)}%
          </span>
        )}
        {canApply && (
          <Button
            type='button'
            variant='link'
            size='sm'
            className='h-auto px-0'
            onClick={() => onApply(roundedRate)}
          >
            {t('Apply to exchange rate')}
          </Button>
        )}
      </>
    )
  }

  return (
    <div className='border-border bg-muted/30 rounded-md border border-dashed p-3 text-sm'>
      <div className='flex flex-wrap items-center justify-between gap-2'>
        <div className='flex flex-col gap-0.5'>
          <span className='text-foreground font-medium'>
            {t('Live USD → CNY reference rate')}
          </span>
          <span className='text-muted-foreground text-xs'>
            {t(
              'For reference only when filling in the exchange rate. Source: PBOC central parity via chinamoney.com.cn.'
            )}
          </span>
        </div>
        <Button
          type='button'
          variant='ghost'
          size='sm'
          onClick={() => {
            void refetch()
          }}
          disabled={isFetching}
        >
          <RefreshCw
            className={isFetching ? 'animate-spin' : undefined}
            aria-hidden='true'
          />
          {t('Refresh')}
        </Button>
      </div>
      <div className='mt-2 flex flex-wrap items-center gap-x-3 gap-y-1'>
        {statusNode}
      </div>
    </div>
  )
}
