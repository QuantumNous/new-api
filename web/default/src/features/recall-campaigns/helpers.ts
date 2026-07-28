import type { UseFormReturn } from 'react-hook-form'
import {
  RECALL_CONTENT_ONLY_EMAIL_STARTER_HTML,
  RECALL_EMAIL_STARTER_HTML,
  convertRecallBodyTextToHtml,
  normalizeRecallBodyInputToHtml,
} from './email-html'
import type {
  RecallCampaignDraft,
  RecallCampaignType,
  RecallCouponSource,
  RecallDiscountType,
  RecallEmailStage,
  RecallEmailLocaleStatus,
  RecallFixedCurrency,
  RecallRecipient,
} from './types'

export {
  RECALL_CONTENT_ONLY_EMAIL_ACTIONS,
  RECALL_CONTENT_ONLY_EMAIL_STARTER_HTML,
  RECALL_EMAIL_ACTION_DESCRIPTIONS,
  RECALL_EMAIL_ACTIONS,
  RECALL_EMAIL_STARTER_HTML,
  convertRecallBodyTextToHtml,
  insertRecallEmailAction,
  normalizeRecallBodyInputToHtml,
} from './email-html'

export const recallFixedCurrencies = ['USD', 'INR', 'BRL', 'JPY'] as const

export function formatRecallCampaignType(type: RecallCampaignType): string {
  return type === 'content_only' ? 'Content only' : 'Promotion'
}

export function isRecallPromotionCampaign(type: RecallCampaignType): boolean {
  return type === 'promotion'
}

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
  const starterHtml =
    draft.campaign_type === 'content_only'
      ? RECALL_CONTENT_ONLY_EMAIL_STARTER_HTML
      : RECALL_EMAIL_STARTER_HTML

  return {
    ...draft,
    discount_config: {
      ...draft.discount_config,
      minimum_amount_currency:
        draft.discount_config.minimum_amount > 0 ? 'USD' : '',
    },
    audience_config: {
      ...draft.audience_config,
      groups: normalizeRecallGroupsForMode(
        draft.audience_config.groups,
        draft.audience_config.group_mode
      ),
    },
    email_sequence: draft.email_sequence.map((stage) => {
      const templates = Object.fromEntries(
        Object.entries(stage.templates)
          .filter(
            ([locale, template]) =>
              locale === 'en' ||
              [
                template.subject,
                template.body_text ?? '',
                template.body_html ?? '',
              ].some((value) => value.trim() !== '')
          )
          .map(([locale, template]) => {
            const bodyHtml = template.body_html?.trim()
            if (bodyHtml) {
              return [
                locale,
                {
                  ...template,
                  subject: template.subject.trim() || draft.name.trim(),
                  body_text: '',
                  body_html: normalizeRecallBodyInputToHtml(
                    template.body_html ?? '',
                    draft.campaign_type
                  ),
                },
              ]
            }
            const bodyText = template.body_text?.trim()
            let normalizedBodyHTML = ''
            if (bodyText) {
              normalizedBodyHTML = convertRecallBodyTextToHtml(
                template.body_text ?? '',
                draft.campaign_type
              )
            } else if (locale === 'en') {
              normalizedBodyHTML = starterHtml
            }
            return [
              locale,
              {
                ...template,
                subject: template.subject.trim() || draft.name.trim(),
                body_text: '',
                body_html: normalizedBodyHTML,
              },
            ]
          })
      )

      return {
        ...stage,
        manual_locales: stage.manual_locales?.filter(
          (locale) => templates[locale] !== undefined
        ),
        templates,
      }
    }),
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
        minimum_amount_currency: discount.minimum_amount > 0 ? 'USD' : '',
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

  const currency = discount.currency.trim().toUpperCase() || 'USD'
  return {
    ...draft,
    discount_config: {
      ...discount,
      type: 'fixed',
      percent_off: 0,
      amount_off: discount.amount_off > 0 ? discount.amount_off : 1,
      currency,
      minimum_amount_currency: discount.minimum_amount > 0 ? 'USD' : '',
    },
  }
}

export interface RecallPromotionDuration {
  days: number
  hours: number
}

function normalizeRecallDurationPart(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.trunc(value))
}

export function recallPromotionDurationToSeconds({
  days,
  hours,
}: RecallPromotionDuration): number {
  return (
    normalizeRecallDurationPart(days) * 86_400 +
    normalizeRecallDurationPart(hours) * 3_600
  )
}

export function recallPromotionSecondsToDuration(
  seconds: number
): RecallPromotionDuration {
  const normalized = normalizeRecallDurationPart(seconds)
  return {
    days: Math.floor(normalized / 86_400),
    hours: Math.floor((normalized % 86_400) / 3_600),
  }
}

export function getRecallEffectivePromotionExpiry(
  draft: Pick<
    RecallCampaignDraft,
    | 'promotion_expiry_mode'
    | 'promotion_expires_at'
    | 'promotion_valid_seconds'
    | 'discount_config'
  >,
  runAtSeconds: number
): number {
  const promotionExpiry =
    draft.promotion_expiry_mode === 'fixed'
      ? draft.promotion_expires_at
      : runAtSeconds + draft.promotion_valid_seconds
  const couponRedeemBy = draft.discount_config.coupon_redeem_by
  return couponRedeemBy > 0
    ? Math.min(promotionExpiry, couponRedeemBy)
    : promotionExpiry
}

function hasRecallEmailTemplate(
  stage: RecallEmailStage,
  locale: string
): boolean {
  const template = stage.templates[locale]
  if (!template) return false
  const bodyCount = [template.body_text, template.body_html].filter((value) =>
    value?.trim()
  ).length
  return template.subject.trim() !== '' && bodyCount === 1
}

export function getRecallEmailLocaleStatus(
  stage: RecallEmailStage,
  locale: string
): RecallEmailLocaleStatus {
  if (!hasRecallEmailTemplate(stage, locale)) return 'missing'
  if (locale === 'en') return 'ready'
  if (
    (stage.translated_source_revision ?? 0) !== (stage.source_revision ?? 0)
  ) {
    return 'stale'
  }
  if (stage.manual_locales?.includes(locale)) return 'manual'
  return 'ready'
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
