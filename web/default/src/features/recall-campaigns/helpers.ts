import type { UseFormReturn } from 'react-hook-form'
import {
  RECALL_EMAIL_STARTER_HTML,
  convertRecallBodyTextToHtml,
  normalizeRecallBodyInputToHtml,
} from './email-html'
import type {
  RecallCampaignDraft,
  RecallCouponSource,
  RecallDiscountType,
  RecallEmailStage,
  RecallFixedCurrency,
  RecallRecipient,
} from './types'

export {
  RECALL_EMAIL_ACTIONS,
  RECALL_EMAIL_STARTER_HTML,
  convertRecallBodyTextToHtml,
  insertRecallEmailAction,
  normalizeRecallBodyInputToHtml,
} from './email-html'

export const recallFixedCurrencies = ['USD', 'INR', 'BRL', 'JPY'] as const

export const recallFixedCurrencyDefaults = {
  amount_off: 500,
  currency_options: { inr: 45_000, brl: 2_500, jpy: 750 },
} as const

const recallCurrencyMinorUnitScale: Record<RecallFixedCurrency, number> = {
  USD: 100,
  INR: 100,
  BRL: 100,
  JPY: 1,
}

export function parseRecallMajorAmount(
  currency: RecallFixedCurrency,
  value: string
): number | null {
  const normalized = value.trim()
  const pattern = currency === 'JPY' ? /^\d+$/ : /^\d+(?:\.\d{1,2})?$/
  if (!pattern.test(normalized)) return null
  const amount = Number(normalized)
  const minorUnits = Math.round(amount * recallCurrencyMinorUnitScale[currency])
  if (amount <= 0 || !Number.isSafeInteger(minorUnits)) return null
  return minorUnits
}

export function formatRecallMinorAmount(
  currency: RecallFixedCurrency,
  value: number
): string {
  if (!Number.isSafeInteger(value) || value <= 0) return ''
  const scale = recallCurrencyMinorUnitScale[currency]
  return currency === 'JPY' ? String(value) : (value / scale).toFixed(2)
}

export function normalizeRecallCouponSource(
  draft: RecallCampaignDraft,
  couponSource: RecallCouponSource
): RecallCampaignDraft {
  const normalized = {
    ...draft,
    coupon_source: couponSource,
    existing_coupon_id:
      couponSource === 'automatic' ? '' : draft.existing_coupon_id,
  }
  return couponSource === 'automatic' && draft.discount_config.type === 'fixed'
    ? normalizeRecallDiscountType(normalized, 'fixed')
    : normalized
}

export function normalizeRecallGroupsForMode(
  groups: string[],
  mode: RecallCampaignDraft['audience_config']['group_mode']
): string[] {
  return mode === '' ? [] : groups
}

type RecallGroupModeForm = Pick<
  UseFormReturn<RecallCampaignDraft>,
  'getValues' | 'setValue' | 'trigger'
>

export function setRecallCampaignGroupMode(
  form: RecallGroupModeForm,
  mode: RecallCampaignDraft['audience_config']['group_mode']
): Promise<boolean> {
  form.setValue('audience_config.group_mode', mode, {
    shouldDirty: true,
    shouldValidate: true,
  })
  form.setValue(
    'audience_config.groups',
    normalizeRecallGroupsForMode(
      form.getValues('audience_config.groups'),
      mode
    ),
    { shouldDirty: true, shouldValidate: true }
  )
  return form.trigger('audience_config')
}

export function setRecallCampaignGroups(
  form: RecallGroupModeForm,
  groups: string[]
): Promise<boolean> {
  form.setValue('audience_config.groups', groups, {
    shouldDirty: true,
    shouldValidate: true,
  })
  return form.trigger('audience_config')
}

export function prepareRecallCampaignSubmitDraft(
  draft: RecallCampaignDraft
): RecallCampaignDraft {
  return {
    ...draft,
    audience_config: {
      ...draft.audience_config,
      groups: normalizeRecallGroupsForMode(
        draft.audience_config.groups,
        draft.audience_config.group_mode
      ),
    },
    email_sequence: draft.email_sequence.map((stage) => ({
      ...stage,
      templates: Object.fromEntries(
        Object.entries(stage.templates).map(([locale, template]) => {
          if (locale !== 'en') return [locale, { ...template }]
          const bodyHtml = template.body_html?.trim()
          if (bodyHtml) {
            return [
              locale,
              {
                ...template,
                body_text: '',
                body_html: normalizeRecallBodyInputToHtml(
                  template.body_html ?? ''
                ),
              },
            ]
          }
          const bodyText = template.body_text?.trim()
          return [
            locale,
            {
              ...template,
              body_text: '',
              body_html: bodyText
                ? convertRecallBodyTextToHtml(template.body_text ?? '')
                : RECALL_EMAIL_STARTER_HTML,
            },
          ]
        })
      ),
    })),
  }
}

export function normalizeRecallDiscountType(
  draft: RecallCampaignDraft,
  discountType: RecallDiscountType
): RecallCampaignDraft {
  const discount = draft.discount_config
  if (discountType === 'percent') {
    return {
      ...draft,
      discount_config: {
        ...discount,
        type: 'percent',
        percent_off:
          discount.percent_off > 0 && discount.percent_off <= 100
            ? discount.percent_off
            : 20,
        amount_off: 0,
        currency: '',
        currency_options: {},
        minimum_amount_currency:
          discount.minimum_amount > 0
            ? discount.minimum_amount_currency.trim().toUpperCase()
            : '',
      },
    }
  }

  if (draft.coupon_source === 'automatic') {
    return {
      ...draft,
      discount_config: {
        ...discount,
        type: 'fixed',
        percent_off: 0,
        amount_off:
          discount.amount_off > 0
            ? discount.amount_off
            : recallFixedCurrencyDefaults.amount_off,
        currency: 'USD',
        currency_options: {
          inr:
            discount.currency_options.inr > 0
              ? discount.currency_options.inr
              : recallFixedCurrencyDefaults.currency_options.inr,
          brl:
            discount.currency_options.brl > 0
              ? discount.currency_options.brl
              : recallFixedCurrencyDefaults.currency_options.brl,
          jpy:
            discount.currency_options.jpy > 0
              ? discount.currency_options.jpy
              : recallFixedCurrencyDefaults.currency_options.jpy,
        },
        minimum_amount: 0,
        minimum_amount_currency: '',
      },
    }
  }

  const currency =
    discount.currency.trim().toUpperCase() ||
    discount.minimum_amount_currency.trim().toUpperCase() ||
    'USD'
  return {
    ...draft,
    discount_config: {
      ...discount,
      type: 'fixed',
      percent_off: 0,
      amount_off: discount.amount_off > 0 ? discount.amount_off : 1,
      currency,
      minimum_amount_currency: discount.minimum_amount > 0 ? currency : '',
    },
  }
}

export function removeRecallEmailStage(
  stages: RecallEmailStage[],
  removeIndex: number
): RecallEmailStage[] {
  let previousDelay = -1
  return stages
    .filter((_stage, index) => index !== removeIndex)
    .map((stage, index) => {
      const delaySeconds =
        index === 0 ? 0 : Math.max(stage.delay_seconds, previousDelay + 1)
      previousDelay = delaySeconds
      return { ...stage, stage_no: index + 1, delay_seconds: delaySeconds }
    })
}

export function getRecallPageCount(total: number, pageSize: number): number {
  if (pageSize < 1) return 1
  return Math.max(1, Math.ceil(total / pageSize))
}

export function getRecallRecipientRetry(
  recipient: RecallRecipient,
  nowSeconds = Math.floor(Date.now() / 1000)
): {
  allowed: boolean
  acknowledgeUncertain: boolean
} {
  if (
    recipient.state === 'failed' ||
    recipient.messages.some((message) => message.state === 'failed')
  ) {
    return { allowed: true, acknowledgeUncertain: false }
  }
  if (recipient.messages.some((message) => message.state === 'uncertain')) {
    return { allowed: true, acknowledgeUncertain: true }
  }
  if (
    recipient.messages.some(
      (message) =>
        message.state === 'sending' &&
        message.lease_expires_at > 0 &&
        message.lease_expires_at < nowSeconds
    )
  ) {
    return { allowed: true, acknowledgeUncertain: true }
  }
  return { allowed: false, acknowledgeUncertain: false }
}
