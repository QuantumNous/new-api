import * as React from 'react'
import { createFormControl, type UseFormReturn } from 'react-hook-form'
import { describe, expect, mock, test } from 'bun:test'
import { createInstance } from 'i18next'
import { renderToStaticMarkup } from 'react-dom/server'
import { I18nextProvider, initReactI18next } from 'react-i18next'
import type { RecallCampaignDraft } from '../types'

mock.module('@/components/datetime-picker', () => ({
  DateTimePicker: (props: {
    'aria-describedby'?: string
    id?: string
    onChange?: (value: Date | undefined) => void
    placeholder?: string
    value?: Date
  }) => (
    <input
      aria-describedby={props['aria-describedby']}
      data-datetime-picker='true'
      id={props.id}
      placeholder={props.placeholder}
      readOnly
      type='datetime-local'
      value={props.value?.toISOString() ?? ''}
    />
  ),
}))

const {
  CampaignOfferValidityFields,
  setRecallMinimumSpendAmount,
  setRecallMinimumSpendEnabled,
  setRecallPromotionExpiryMode,
} = await import('./campaign-offer-validity-fields')

const testI18n = createInstance()
await testI18n.use(initReactI18next).init({
  lng: 'en',
  fallbackLng: 'en',
  resources: { en: { translation: {} } },
  interpolation: { escapeValue: false },
})

function makeDraft(): RecallCampaignDraft {
  return {
    name: 'Offer validity',
    audience_template: 'first_purchase',
    audience_config: {
      registration_age_days: 30,
      min_request_count: 1,
      max_quota: 0,
      min_paid_amount: 0,
      last_api_call_age_days: 30,
      last_payment_age_days: 30,
      subscription_expired_days: 30,
      min_subscription_amount: 0,
      min_subscription_count: 1,
      payment_providers: [],
      groups: [],
      group_mode: '',
      require_verified_email: true,
      registration_start_at: 0,
      registration_end_at: 0,
      specified_user_ids: [],
      specified_emails: [],
    },
    execution_mode: 'manual',
    schedule: {
      scheduled_at: 0,
      timezone: 'UTC',
      frequency: 'daily',
      weekday: 1,
      hour: 9,
      minute: 0,
    },
    coupon_source: 'automatic',
    existing_coupon_id: '',
    discount_config: {
      type: 'percent',
      percent_off: 20,
      amount_off: 0,
      currency: '',
      currency_options: {},
      minimum_amount: 0,
      minimum_amount_currency: '',
      minimum_spend: { enabled: false, amounts: {} },
      coupon_redeem_by: 2_000_003_600,
    },
    product_scope: {
      topup_price_ids: ['price_topup_usd'],
      subscription_price_ids: [],
    },
    promotion_expiry_mode: 'relative',
    promotion_expires_at: 0,
    promotion_valid_seconds: 7_200,
    enrollment_limit: 1_000,
    worker_concurrency: 5,
    email_sequence: [],
    defer_localization: true,
  }
}

function createForm(
  draft: RecallCampaignDraft
): UseFormReturn<RecallCampaignDraft> {
  const form = createFormControl<RecallCampaignDraft>({
    defaultValues: draft,
  })
  form.subscribe({
    formState: { errors: true, values: true },
    callback: () => undefined,
  })
  for (const field of [
    'discount_config.minimum_amount',
    'discount_config.minimum_amount_currency',
    'discount_config.minimum_spend.enabled',
    'discount_config.minimum_spend.amounts.usd',
    'discount_config.minimum_spend.amounts.inr',
    'discount_config.minimum_spend.amounts.brl',
    'discount_config.minimum_spend.amounts.jpy',
    'discount_config.coupon_redeem_by',
    'promotion_expiry_mode',
    'promotion_expires_at',
    'promotion_valid_seconds',
  ] as const) {
    form.register(field)
  }
  return form as unknown as UseFormReturn<RecallCampaignDraft>
}

function renderFields(
  draft: RecallCampaignDraft,
  configure?: (form: UseFormReturn<RecallCampaignDraft>) => void
): string {
  const form = createForm(draft)
  configure?.(form)
  return renderToStaticMarkup(
    <I18nextProvider i18n={testI18n}>
      <CampaignOfferValidityFields
        form={form}
        immutable={false}
        nowSeconds={2_000_000_000}
      />
    </I18nextProvider>
  )
}

describe('CampaignOfferValidityFields', () => {
  test('uses a date-time picker for coupon redeem-by instead of a timestamp input', () => {
    const html = renderFields(makeDraft())

    expect(html).toContain('id="recall-coupon-redeem-by"')
    expect(html).toContain('data-datetime-picker="true"')
    expect(html).not.toContain('name="discount_config.coupon_redeem_by"')
  })

  test('shows fixed expiry as a second date-time picker and hides duration', () => {
    const draft = makeDraft()
    draft.promotion_expiry_mode = 'fixed'
    draft.promotion_valid_seconds = 0
    draft.promotion_expires_at = 2_000_007_200

    const html = renderFields(draft)

    expect(html.match(/data-datetime-picker="true"/g) ?? []).toHaveLength(2)
    expect(html).toContain('id="recall-promotion-fixed-expiry"')
    expect(html).not.toContain('id="recall-promotion-validity-days"')
    expect(html).not.toContain('id="recall-promotion-validity-hours"')
  })

  test('shows integer days and hours for relative validity and hides fixed expiry', () => {
    const html = renderFields(makeDraft())

    expect(html.match(/data-datetime-picker="true"/g) ?? []).toHaveLength(1)
    expect(html).toContain('id="recall-promotion-validity-days"')
    expect(html).toContain('id="recall-promotion-validity-hours"')
    expect(html).not.toContain('id="recall-promotion-fixed-expiry"')
  })

  test('clears the inactive serialized value when switching modes', () => {
    const form = createForm(makeDraft())

    setRecallPromotionExpiryMode(form, 'fixed')
    expect(form.getValues('promotion_expiry_mode')).toBe('fixed')
    expect(form.getValues('promotion_valid_seconds')).toBe(0)

    form.setValue('promotion_expires_at', 2_000_007_200)
    setRecallPromotionExpiryMode(form, 'relative')
    expect(form.getValues('promotion_expiry_mode')).toBe('relative')
    expect(form.getValues('promotion_expires_at')).toBe(0)
    expect(form.getValues('promotion_valid_seconds')).toBe(86_400)
  })

  test('shows the coupon-capped effective expiry in the local timezone', () => {
    const draft = makeDraft()
    const expected = new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(draft.discount_config.coupon_redeem_by * 1_000))

    const html = renderFields(draft)

    expect(html).toContain(expected)
    expect(html).toContain('local time')
  })

  test('previews relative validity from a scheduled-once run time', () => {
    const draft = makeDraft()
    draft.execution_mode = 'scheduled_once'
    draft.schedule.scheduled_at = 2_000_010_000
    draft.discount_config.coupon_redeem_by = 0
    const expected = new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(
      new Date(
        (draft.schedule.scheduled_at + draft.promotion_valid_seconds) * 1_000
      )
    )

    const html = renderFields(draft)

    expect(html).toContain(expected)
  })

  test('hides minimum spend amount inputs by default', () => {
    const html = renderFields(makeDraft())

    expect(html).toContain('Set minimum spend')
    expect(html).toContain('id="recall-minimum-spend-enabled"')
    expect(html).not.toContain(
      'name="discount_config.minimum_spend.amounts.usd"'
    )
    expect(html).not.toContain(
      'name="discount_config.minimum_spend.amounts.inr"'
    )
    expect(html).not.toContain(
      'name="discount_config.minimum_spend.amounts.brl"'
    )
    expect(html).not.toContain(
      'name="discount_config.minimum_spend.amounts.jpy"'
    )
    expect(html).not.toContain('name="discount_config.minimum_amount_currency"')
  })

  test('shows four associated minimum spend currency inputs when enabled', () => {
    const draft = makeDraft()
    draft.discount_config.minimum_spend = {
      enabled: true,
      amounts: { usd: 2500, inr: 90_000, brl: 2_500, jpy: 750 },
    }
    draft.discount_config.minimum_amount = 2500
    draft.discount_config.minimum_amount_currency = 'USD'

    const html = renderFields(draft)

    for (const [currency, value] of [
      ['usd', '25.00'],
      ['inr', '900.00'],
      ['brl', '25.00'],
      ['jpy', '750'],
    ]) {
      expect(html).toContain(`for="recall-minimum-spend-${currency}"`)
      expect(html).toContain(
        `name="discount_config.minimum_spend.amounts.${currency}"`
      )
      expect(html).toContain(`value="${value}"`)
    }
    expect(html).toContain('min="0.01"')
    expect(html).toContain('step="0.01"')
    expect(html).toContain('min="1"')
    expect(html).toContain('step="1"')
  })

  test('associates minimum spend field errors with each currency input', () => {
    const draft = makeDraft()
    draft.discount_config.minimum_spend = {
      enabled: true,
      amounts: { usd: 2500 },
    }
    draft.discount_config.minimum_amount = 2500
    draft.discount_config.minimum_amount_currency = 'USD'

    const html = renderFields(draft, (form) => {
      form.setError('discount_config.minimum_spend.amounts.usd', {
        message: 'USD minimum spend is required',
      })
      form.setError('discount_config.minimum_spend.amounts.inr', {
        message: 'INR minimum spend is required',
      })
      form.setError('discount_config.minimum_spend.amounts.brl', {
        message: 'BRL minimum spend is required',
      })
      form.setError('discount_config.minimum_spend.amounts.jpy', {
        message: 'JPY minimum spend is required',
      })
    })

    for (const currency of ['usd', 'inr', 'brl', 'jpy']) {
      expect(html).toContain(`aria-invalid="true"`)
      expect(html).toContain(
        `aria-describedby="recall-minimum-spend-${currency}-error"`
      )
      expect(html).toContain(`id="recall-minimum-spend-${currency}-error"`)
    }
    expect(html).toContain('USD minimum spend is required')
    expect(html).toContain('INR minimum spend is required')
    expect(html).toContain('BRL minimum spend is required')
    expect(html).toContain('JPY minimum spend is required')
  })

  test('minimum spend helpers enable, write canonical minor units, and clear legacy fields', () => {
    const form = createForm(makeDraft())

    setRecallMinimumSpendEnabled(form, true)
    expect(form.getValues('discount_config.minimum_spend')).toEqual({
      enabled: true,
      amounts: {},
    })

    setRecallMinimumSpendAmount(form, 'USD', '12.34')
    setRecallMinimumSpendAmount(form, 'JPY', '750')
    expect(form.getValues('discount_config.minimum_spend.amounts.usd')).toBe(
      1234
    )
    expect(form.getValues('discount_config.minimum_spend.amounts.jpy')).toBe(
      750
    )
    expect(form.getValues('discount_config.minimum_amount')).toBe(1234)
    expect(form.getValues('discount_config.minimum_amount_currency')).toBe(
      'USD'
    )

    setRecallMinimumSpendEnabled(form, false)
    expect(form.getValues('discount_config.minimum_spend')).toEqual({
      enabled: false,
      amounts: {},
    })
    expect(form.getValues('discount_config.minimum_amount')).toBe(0)
    expect(form.getValues('discount_config.minimum_amount_currency')).toBe('')
  })

  test('associates field labels and validation errors with their controls', () => {
    const html = renderFields(makeDraft(), (form) => {
      form.setError('discount_config.coupon_redeem_by', {
        message: 'Coupon redeem-by must be in the future',
      })
    })

    expect(html).toContain('for="recall-coupon-redeem-by"')
    expect(html).toContain('aria-describedby="recall-coupon-redeem-by-error"')
    expect(html).toContain('id="recall-coupon-redeem-by-error"')
    expect(html).toContain('Coupon redeem-by must be in the future')
  })
})
