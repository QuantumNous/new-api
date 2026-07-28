import { useEffect, useRef, useState } from 'react'
import {
  Controller,
  useFormState,
  useWatch,
  type UseFormReturn,
} from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { DateTimePicker } from '@/components/datetime-picker'
import { Switch } from '@/components/ui/switch'
import {
  formatRecallMinorAmount,
  getRecallEffectivePromotionExpiry,
  parseRecallMajorAmount,
  recallFixedCurrencies,
  recallPromotionDurationToSeconds,
  recallPromotionSecondsToDuration,
} from '../helpers'
import type {
  RecallCampaignDraft,
  RecallFixedCurrency,
  RecallMinimumSpendCurrency,
  RecallPromotionExpiryMode,
} from '../types'

interface CampaignOfferValidityFieldsProps {
  form: UseFormReturn<RecallCampaignDraft>
  immutable: boolean
  nowSeconds?: number
}

type RecallPromotionModeForm = Pick<
  UseFormReturn<RecallCampaignDraft>,
  'getValues' | 'setValue'
>
type RecallMinimumSpendForm = Pick<
  UseFormReturn<RecallCampaignDraft>,
  'getValues' | 'setValue'
>

const recallMinimumSpendCurrencyKeys: Record<
  RecallFixedCurrency,
  RecallMinimumSpendCurrency
> = {
  USD: 'usd',
  INR: 'inr',
  BRL: 'brl',
  JPY: 'jpy',
}

// eslint-disable-next-line react-refresh/only-export-components
export function setRecallPromotionExpiryMode(
  form: RecallPromotionModeForm,
  mode: RecallPromotionExpiryMode
): void {
  form.setValue('promotion_expiry_mode', mode, {
    shouldDirty: true,
    shouldValidate: true,
  })
  if (mode === 'fixed') {
    form.setValue('promotion_valid_seconds', 0, {
      shouldDirty: true,
      shouldValidate: true,
    })
    return
  }
  form.setValue('promotion_expires_at', 0, {
    shouldDirty: true,
    shouldValidate: true,
  })
  if (form.getValues('promotion_valid_seconds') <= 0) {
    form.setValue('promotion_valid_seconds', 86_400, {
      shouldDirty: true,
      shouldValidate: true,
    })
  }
}

// eslint-disable-next-line react-refresh/only-export-components
export function setRecallMinimumSpendEnabled(
  form: RecallMinimumSpendForm,
  enabled: boolean
): void {
  if (enabled) {
    const current = form.getValues('discount_config.minimum_spend')
    form.setValue(
      'discount_config.minimum_spend',
      { enabled: true, amounts: { ...(current?.amounts ?? {}) } },
      { shouldDirty: true, shouldValidate: true }
    )
    return
  }

  form.setValue(
    'discount_config.minimum_spend',
    { enabled: false, amounts: {} },
    { shouldDirty: true, shouldValidate: true }
  )
  form.setValue('discount_config.minimum_amount', 0, {
    shouldDirty: true,
    shouldValidate: true,
  })
  form.setValue('discount_config.minimum_amount_currency', '', {
    shouldDirty: true,
    shouldValidate: true,
  })
}

// eslint-disable-next-line react-refresh/only-export-components
export function setRecallMinimumSpendAmount(
  form: RecallMinimumSpendForm,
  currency: RecallFixedCurrency,
  value: string
): void {
  const currencyKey = recallMinimumSpendCurrencyKeys[currency]
  const amount = parseRecallMajorAmount(currency, value) ?? 0
  form.setValue(`discount_config.minimum_spend.amounts.${currencyKey}`, amount, {
    shouldDirty: true,
    shouldValidate: true,
  })
  if (currency === 'USD') {
    form.setValue('discount_config.minimum_amount', amount, {
      shouldDirty: true,
      shouldValidate: true,
    })
    form.setValue('discount_config.minimum_amount_currency', amount ? 'USD' : '', {
      shouldDirty: true,
      shouldValidate: true,
    })
  }
}

function unixSecondsToDate(value: number): Date | undefined {
  return value > 0 ? new Date(value * 1_000) : undefined
}

function dateToUnixSeconds(value: Date | undefined): number {
  return value ? Math.floor(value.getTime() / 1_000) : 0
}

function fieldErrorID(id: string, message?: string): string | undefined {
  return message ? `${id}-error` : undefined
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null
  return (
    <p id={`${id}-error`} className='text-destructive text-sm' role='alert'>
      {message}
    </p>
  )
}

function MinimumSpendAmountInput({
  currency,
  error,
  form,
  immutable,
}: {
  currency: RecallFixedCurrency
  error?: string
  form: UseFormReturn<RecallCampaignDraft>
  immutable: boolean
}) {
  const { t } = useTranslation()
  const currencyKey = recallMinimumSpendCurrencyKeys[currency]
  const id = `recall-minimum-spend-${currencyKey}`
  const path = `discount_config.minimum_spend.amounts.${currencyKey}` as const
  const errorID = fieldErrorID(id, error)
  const amount = useWatch({ control: form.control, name: path })
  const [rawValue, setRawValue] = useState(() =>
    formatRecallMinorAmount(currency, amount ?? 0)
  )
  const lastWrittenAmountRef = useRef<number | undefined>(undefined)

  useEffect(() => {
    if (lastWrittenAmountRef.current === amount) {
      lastWrittenAmountRef.current = undefined
      return
    }
    lastWrittenAmountRef.current = undefined
    setRawValue(formatRecallMinorAmount(currency, amount ?? 0))
  }, [amount, currency])

  return (
    <div className='space-y-2'>
      <Label htmlFor={id}>{t('{{currency}} minimum spend', { currency })}</Label>
      <Input
        id={id}
        type='number'
        min={currency === 'JPY' ? 1 : 0.01}
        step={currency === 'JPY' ? '1' : '0.01'}
        disabled={immutable}
        value={rawValue}
        aria-invalid={Boolean(error)}
        aria-describedby={errorID}
        onChange={(event) => {
          const nextValue = event.target.value
          const nextAmount = parseRecallMajorAmount(currency, nextValue) ?? 0
          lastWrittenAmountRef.current = nextAmount
          setRawValue(nextValue)
          setRecallMinimumSpendAmount(form, currency, nextValue)
        }}
        name={path}
      />
      <FieldError id={id} message={error ? t(String(error)) : undefined} />
    </div>
  )
}

export function CampaignOfferValidityFields({
  form,
  immutable,
  nowSeconds,
}: CampaignOfferValidityFieldsProps) {
  const { t } = useTranslation()
  const [mountedAtSeconds] = useState(() => Math.floor(Date.now() / 1_000))
  const effectiveNowSeconds = nowSeconds ?? mountedAtSeconds
  const [
    minimumSpendEnabled,
    mode,
    promotionExpiresAt,
    promotionValidSeconds,
    couponRedeemBy,
    executionMode,
    scheduledAt,
  ] = useWatch({
    control: form.control,
    name: [
      'discount_config.minimum_spend.enabled',
      'promotion_expiry_mode',
      'promotion_expires_at',
      'promotion_valid_seconds',
      'discount_config.coupon_redeem_by',
      'execution_mode',
      'schedule.scheduled_at',
    ],
  })
  const { errors } = useFormState({
    control: form.control,
    name: [
      'discount_config.minimum_amount',
      'discount_config.minimum_spend.amounts.usd',
      'discount_config.minimum_spend.amounts.inr',
      'discount_config.minimum_spend.amounts.brl',
      'discount_config.minimum_spend.amounts.jpy',
      'discount_config.coupon_redeem_by',
      'promotion_expires_at',
      'promotion_valid_seconds',
    ],
  })
  const couponError = errors.discount_config?.coupon_redeem_by?.message
  const fixedError = errors.promotion_expires_at?.message
  const durationError = errors.promotion_valid_seconds?.message
  const previewBaseSeconds =
    executionMode === 'scheduled_once' && scheduledAt > 0
      ? scheduledAt
      : effectiveNowSeconds
  const effectiveExpiry = getRecallEffectivePromotionExpiry(
    {
      promotion_expiry_mode: mode,
      promotion_expires_at: promotionExpiresAt,
      promotion_valid_seconds: promotionValidSeconds,
      discount_config: {
        ...form.getValues('discount_config'),
        coupon_redeem_by: couponRedeemBy,
      },
    },
    previewBaseSeconds
  )
  const effectiveExpiryText =
    effectiveExpiry > 0
      ? new Intl.DateTimeFormat(undefined, {
          dateStyle: 'medium',
          timeStyle: 'short',
        }).format(new Date(effectiveExpiry * 1_000))
      : ''

  return (
    <>
      <div className='space-y-3 md:col-span-2'>
        <div className='flex items-center gap-3'>
          <Switch
            id='recall-minimum-spend-enabled'
            checked={Boolean(minimumSpendEnabled)}
            disabled={immutable}
            onCheckedChange={(checked) =>
              setRecallMinimumSpendEnabled(form, checked)
            }
          />
          <Label htmlFor='recall-minimum-spend-enabled'>
            {t('Set minimum spend')}
          </Label>
        </div>
        {minimumSpendEnabled ? (
          <>
            <p className='text-muted-foreground text-sm'>
              {t(
                'Enter the minimum spend in each checkout currency. Amounts are not converted automatically.'
              )}
            </p>
            <div className='grid gap-4 sm:grid-cols-2'>
              {recallFixedCurrencies.map((currency) => (
                <MinimumSpendAmountInput
                  key={currency}
                  currency={currency}
                  error={
                    errors.discount_config?.minimum_spend?.amounts?.[
                      recallMinimumSpendCurrencyKeys[currency]
                    ]?.message
                  }
                  form={form}
                  immutable={immutable}
                />
              ))}
            </div>
          </>
        ) : null}
      </div>

      <div className='space-y-2'>
        <Label htmlFor='recall-coupon-redeem-by'>{t('Coupon redeem-by')}</Label>
        <Controller
          control={form.control}
          name='discount_config.coupon_redeem_by'
          render={({ field }) => (
            <DateTimePicker
              id='recall-coupon-redeem-by'
              value={unixSecondsToDate(field.value)}
              onChange={(value) => field.onChange(dateToUnixSeconds(value))}
              placeholder={t('Select coupon redeem-by')}
              disabled={immutable}
              aria-invalid={Boolean(couponError)}
              aria-describedby={fieldErrorID(
                'recall-coupon-redeem-by',
                couponError
              )}
            />
          )}
        />
        <FieldError id='recall-coupon-redeem-by' message={couponError} />
      </div>

      <fieldset className='space-y-2 md:col-span-2' disabled={immutable}>
        <legend className='text-sm font-medium'>
          {t('Promotion expiry mode')}
        </legend>
        <div className='flex flex-wrap gap-4' role='radiogroup'>
          {(['relative', 'fixed'] as const).map((value) => (
            <label className='flex items-center gap-2 text-sm' key={value}>
              <input
                type='radio'
                name='promotion_expiry_mode'
                value={value}
                checked={mode === value}
                onChange={() => setRecallPromotionExpiryMode(form, value)}
              />
              {t(value === 'relative' ? 'Relative duration' : 'Fixed date')}
            </label>
          ))}
        </div>
      </fieldset>

      {mode === 'fixed' ? (
        <div className='space-y-2 md:col-span-2'>
          <Label htmlFor='recall-promotion-fixed-expiry'>
            {t('Promotion expires at')}
          </Label>
          <Controller
            control={form.control}
            name='promotion_expires_at'
            render={({ field }) => (
              <DateTimePicker
                id='recall-promotion-fixed-expiry'
                value={unixSecondsToDate(field.value)}
                onChange={(value) => field.onChange(dateToUnixSeconds(value))}
                placeholder={t('Select promotion expiry')}
                disabled={immutable}
                aria-invalid={Boolean(fixedError)}
                aria-describedby={fieldErrorID(
                  'recall-promotion-fixed-expiry',
                  fixedError
                )}
              />
            )}
          />
          <FieldError id='recall-promotion-fixed-expiry' message={fixedError} />
        </div>
      ) : (
        <Controller
          control={form.control}
          name='promotion_valid_seconds'
          render={({ field }) => {
            const duration = recallPromotionSecondsToDuration(field.value)
            const errorID = fieldErrorID(
              'recall-promotion-validity',
              durationError
            )
            return (
              <div className='grid gap-4 md:col-span-2 md:grid-cols-2'>
                <div className='space-y-2'>
                  <Label htmlFor='recall-promotion-validity-days'>
                    {t('Validity days')}
                  </Label>
                  <Input
                    id='recall-promotion-validity-days'
                    type='number'
                    min={0}
                    step={1}
                    disabled={immutable}
                    value={duration.days}
                    aria-describedby={errorID}
                    onChange={(event) =>
                      field.onChange(
                        recallPromotionDurationToSeconds({
                          ...duration,
                          days: Number(event.target.value),
                        })
                      )
                    }
                  />
                </div>
                <div className='space-y-2'>
                  <Label htmlFor='recall-promotion-validity-hours'>
                    {t('Validity hours')}
                  </Label>
                  <Input
                    id='recall-promotion-validity-hours'
                    type='number'
                    min={0}
                    max={23}
                    step={1}
                    disabled={immutable}
                    value={duration.hours}
                    aria-describedby={errorID}
                    onChange={(event) =>
                      field.onChange(
                        recallPromotionDurationToSeconds({
                          ...duration,
                          hours: Number(event.target.value),
                        })
                      )
                    }
                  />
                </div>
                <FieldError
                  id='recall-promotion-validity'
                  message={durationError}
                />
              </div>
            )
          }}
        />
      )}

      {effectiveExpiryText ? (
        <p className='bg-muted/50 text-muted-foreground rounded-md p-3 text-sm md:col-span-2'>
          {t('Effective expiry: {{date}} (local time)', {
            date: effectiveExpiryText,
          })}
        </p>
      ) : null}
    </>
  )
}
