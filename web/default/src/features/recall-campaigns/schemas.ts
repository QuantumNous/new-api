import { z } from 'zod'
import { isRecallSpecifiedEmail } from './audience-inputs'
import type { RecallCampaignDraft } from './types'

const campaignTypeSchema = z
  .enum(['promotion', 'content_only'])
  .default('promotion')
const nonNegativeInteger = z.number().int().min(0)
const nonNegativeNumber = z.number().min(0)
const integer = z.number().int()
const number = z.number()
const currencySchema = z.string().regex(/^[A-Z]{3}$/)
const legacyMinimumSpendCurrencies = ['USD', 'INR', 'BRL', 'JPY'] as const
const minimumSpendCurrencies = ['usd', 'inr', 'brl', 'jpy'] as const
type LegacyMinimumSpendCurrency = (typeof legacyMinimumSpendCurrencies)[number]

function normalizeSpecifiedEmails(emails: string[]): string[] {
  const normalizedEmails: string[] = []
  const seen = new Set<string>()
  for (const email of emails) {
    const normalized = email.trim().toLowerCase()
    if (!normalized || seen.has(normalized)) continue
    seen.add(normalized)
    normalizedEmails.push(normalized)
  }
  return normalizedEmails
}

function isIanaTimezone(value: string): boolean {
  if (value === '' || value === 'Local') return false
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value }).format()
    return true
  } catch {
    return false
  }
}

const audienceSchema = z
  .object({
    registration_age_days: integer,
    min_request_count: integer,
    max_quota: integer,
    min_paid_amount: number,
    last_api_call_age_days: integer,
    last_payment_age_days: integer,
    subscription_expired_days: integer,
    min_subscription_amount: number,
    min_subscription_count: integer,
    payment_providers: z.array(z.string()),
    groups: z.array(z.string()),
    group_mode: z.enum(['', 'allow', 'block']),
    require_verified_email: z.boolean(),
    registration_start_at: integer.default(0),
    registration_end_at: integer.default(0),
    specified_user_ids: z.array(z.number()).default([]),
    specified_emails: z.array(z.string()).default([]),
  })
  .strict()

const legacyAudienceThresholds = [
  ['registration_age_days', nonNegativeInteger],
  ['min_request_count', nonNegativeInteger],
  ['max_quota', nonNegativeInteger],
  ['min_paid_amount', nonNegativeNumber],
  ['last_api_call_age_days', nonNegativeInteger],
  ['last_payment_age_days', nonNegativeInteger],
  ['subscription_expired_days', nonNegativeInteger],
  ['min_subscription_amount', nonNegativeNumber],
  ['min_subscription_count', nonNegativeInteger],
] as const

function validateAudienceGroups(
  audience: z.infer<typeof audienceSchema>,
  context: z.RefinementCtx
): void {
  if (audience.groups.some((group) => group.trim() === '')) {
    context.addIssue({
      code: 'custom',
      path: ['audience_config', 'groups'],
      message: 'Groups are invalid',
    })
  }
  if (audience.groups.length === 0 && audience.group_mode !== '') {
    context.addIssue({
      code: 'custom',
      path: ['audience_config', 'group_mode'],
      message: 'Groups are required',
    })
  }
  if (audience.groups.length > 0 && audience.group_mode === '') {
    context.addIssue({
      code: 'custom',
      path: ['audience_config', 'group_mode'],
      message: 'Group mode is required',
    })
  }
}

function validateLegacyAudience(
  audience: z.infer<typeof audienceSchema>,
  context: z.RefinementCtx
): void {
  for (const [field, schema] of legacyAudienceThresholds) {
    if (!schema.safeParse(audience[field]).success) {
      context.addIssue({
        code: 'custom',
        path: ['audience_config', field],
        message: 'Audience threshold is invalid',
      })
    }
  }
  if (audience.payment_providers.some((provider) => provider.trim() === '')) {
    context.addIssue({
      code: 'custom',
      path: ['audience_config', 'payment_providers'],
      message: 'Payment providers are invalid',
    })
  }
  validateAudienceGroups(audience, context)
}

function validateRegistrationTimeRangeAudience(
  audience: z.infer<typeof audienceSchema>,
  context: z.RefinementCtx
): void {
  if (audience.registration_start_at <= 0) {
    context.addIssue({
      code: 'custom',
      path: ['audience_config', 'registration_start_at'],
      message: 'Registration start is required',
    })
  }
  if (audience.registration_end_at <= 0) {
    context.addIssue({
      code: 'custom',
      path: ['audience_config', 'registration_end_at'],
      message: 'Registration end is required',
    })
  } else if (
    audience.registration_start_at > 0 &&
    audience.registration_end_at < audience.registration_start_at
  ) {
    context.addIssue({
      code: 'custom',
      path: ['audience_config', 'registration_end_at'],
      message: 'Registration end must be on or after start',
    })
  }
  validateAudienceGroups(audience, context)
}

function validateRegisteredOnlyAudience(
  audience: z.infer<typeof audienceSchema>,
  context: z.RefinementCtx
): void {
  validateRegistrationTimeRangeAudience(audience, context)
}

function validateSpecifiedUsersAudience(
  audience: z.infer<typeof audienceSchema>,
  context: z.RefinementCtx
): void {
  const userIds = new Set<number>()
  for (const userId of audience.specified_user_ids) {
    if (!Number.isInteger(userId) || userId <= 0) {
      context.addIssue({
        code: 'custom',
        path: ['audience_config', 'specified_user_ids'],
        message: 'User IDs are invalid',
      })
      break
    }
    userIds.add(userId)
  }

  const emails = new Set<string>()
  for (const email of audience.specified_emails) {
    const normalized = email.trim().toLowerCase()
    if (!normalized || !isRecallSpecifiedEmail(normalized)) {
      context.addIssue({
        code: 'custom',
        path: ['audience_config', 'specified_emails'],
        message: 'Emails are invalid',
      })
      break
    }
    emails.add(normalized)
  }

  if (userIds.size + emails.size === 0) {
    context.addIssue({
      code: 'custom',
      path: ['audience_config', 'specified_user_ids'],
      message: 'At least one user or email is required',
    })
  }
  if (userIds.size + emails.size > 500) {
    context.addIssue({
      code: 'custom',
      path: ['audience_config', 'specified_emails'],
      message: 'Up to 500 users or emails are supported',
    })
  }
}

const scheduleSchema = z
  .object({
    scheduled_at: z.number().int(),
    timezone: z.string(),
    frequency: z.string(),
    weekday: z.number().int(),
    hour: z.number().int(),
    minute: z.number().int(),
  })
  .strict()

function validateRecallMinimumSpend(
  discount: {
    minimum_amount: number
    minimum_amount_currency: string
    minimum_spend?: {
      enabled: boolean
      amounts: Record<string, unknown>
    }
  },
  context: z.RefinementCtx
): void {
  const minimumSpend = discount.minimum_spend
  if (minimumSpend === undefined) return

  const amountKeys = Object.keys(minimumSpend.amounts)
  if (!minimumSpend.enabled) {
    if (amountKeys.length > 0) {
      context.addIssue({
        code: 'custom',
        path: ['minimum_spend', 'amounts'],
        message: 'Minimum spend amounts must be empty',
      })
    }
    if (discount.minimum_amount !== 0) {
      context.addIssue({
        code: 'custom',
        path: ['minimum_amount'],
        message: 'Minimum amount must be empty',
      })
    }
    if (discount.minimum_amount_currency !== '') {
      context.addIssue({
        code: 'custom',
        path: ['minimum_amount_currency'],
        message: 'Minimum amount currency must be empty',
      })
    }
    return
  }

  for (const currency of amountKeys) {
    if (
      !minimumSpendCurrencies.includes(
        currency as (typeof minimumSpendCurrencies)[number]
      )
    ) {
      context.addIssue({
        code: 'custom',
        path: ['minimum_spend', 'amounts', currency],
        message: 'Minimum spend currency is unsupported',
      })
    }
  }
  for (const currency of minimumSpendCurrencies) {
    const amount = minimumSpend.amounts[currency]
    if (
      typeof amount !== 'number' ||
      !Number.isSafeInteger(amount) ||
      amount <= 0
    ) {
      context.addIssue({
        code: 'custom',
        path: ['minimum_spend', 'amounts', currency],
        message: `${currency.toUpperCase()} minimum spend is required`,
      })
    }
  }
  if (discount.minimum_amount !== minimumSpend.amounts.usd) {
    context.addIssue({
      code: 'custom',
      path: ['minimum_amount'],
      message: 'Minimum amount must match USD minimum spend',
    })
  }
  if (discount.minimum_amount_currency !== 'USD') {
    context.addIssue({
      code: 'custom',
      path: ['minimum_amount_currency'],
      message: 'Minimum amount currency must be USD',
    })
  }
}

const promotionDiscountSchema = z
  .object({
    type: z.enum(['percent', 'fixed']),
    percent_off: z.number().min(0),
    amount_off: nonNegativeInteger,
    currency: z.string(),
    currency_options: z.record(z.string(), nonNegativeInteger),
    minimum_amount: nonNegativeInteger,
    minimum_amount_currency: z.string(),
    minimum_spend: z
      .object({
        enabled: z.boolean(),
        amounts: z.record(z.string(), z.unknown()),
      })
      .strict()
      .optional(),
    coupon_redeem_by: nonNegativeInteger,
  })
  .strict()
  .superRefine((discount, context) => {
    if (discount.type === 'percent') {
      if (discount.percent_off <= 0 || discount.percent_off > 100) {
        context.addIssue({
          code: 'custom',
          path: ['percent_off'],
          message: 'Percent is invalid',
        })
      }
      if (
        discount.amount_off !== 0 ||
        discount.currency !== '' ||
        Object.keys(discount.currency_options).length > 0
      ) {
        context.addIssue({
          code: 'custom',
          path: ['amount_off'],
          message: 'Fixed amounts must be empty',
        })
      }
    }
    if (discount.type === 'fixed') {
      if (discount.percent_off !== 0) {
        context.addIssue({
          code: 'custom',
          path: ['percent_off'],
          message: 'Percent must be zero',
        })
      }
      if (discount.amount_off <= 0) {
        context.addIssue({
          code: 'custom',
          path: ['amount_off'],
          message: 'Amount is required',
        })
      }
      if (!currencySchema.safeParse(discount.currency).success) {
        context.addIssue({
          code: 'custom',
          path: ['currency'],
          message: 'Currency is invalid',
        })
      }
    }
    validateRecallMinimumSpend(discount, context)
    if (discount.minimum_spend === undefined && discount.minimum_amount > 0) {
      if (
        !legacyMinimumSpendCurrencies.includes(
          discount.minimum_amount_currency as LegacyMinimumSpendCurrency
        )
      ) {
        context.addIssue({
          code: 'custom',
          path: ['minimum_amount_currency'],
          message: 'Minimum amount currency is invalid',
        })
      }
    } else if (
      discount.minimum_spend === undefined &&
      discount.minimum_amount_currency !== ''
    ) {
      context.addIssue({
        code: 'custom',
        path: ['minimum_amount_currency'],
        message: 'Minimum amount currency is not needed',
      })
    }
    if (
      discount.coupon_redeem_by > 0 &&
      discount.coupon_redeem_by <= Date.now() / 1000
    ) {
      context.addIssue({
        code: 'custom',
        path: ['coupon_redeem_by'],
        message: 'Coupon redeem-by must be in the future',
      })
    }
  })

const discountSchema = z
  .object({
    type: z.enum(['percent', 'fixed']),
    percent_off: z.number().min(0),
    amount_off: nonNegativeInteger,
    currency: z.string(),
    currency_options: z.record(z.string(), nonNegativeInteger),
    minimum_amount: nonNegativeInteger,
    minimum_amount_currency: z.string(),
    minimum_spend: z
      .object({
        enabled: z.boolean(),
        amounts: z.record(z.string(), z.unknown()),
      })
      .strict()
      .optional(),
    coupon_redeem_by: nonNegativeInteger,
  })
  .strict()

const productScopeSchema = z
  .object({
    topup_price_ids: z.array(z.string().trim().min(1)),
    subscription_price_ids: z.array(z.string().trim().min(1)),
  })
  .strict()

const MAX_BODY_HTML_BYTES = 100 * 1024
const recallTargetLocaleSchema = z.enum([
  'zh',
  'es',
  'fr',
  'pt',
  'ru',
  'ja',
  'vi',
])

const emailTemplateSchema = z
  .object({
    subject: z
      .string()
      .trim()
      .refine((value) => Array.from(value).length <= 200, {
        message: 'Subject must be 200 characters or fewer',
      }),
    body_text: z
      .string()
      .optional()
      .default('')
      .refine(
        (value) => value.trim() === '' || Array.from(value).length <= 2_000,
        {
          message: 'Body text must be 2000 characters or fewer',
        }
      ),
    body_html: z
      .string()
      .optional()
      .default('')
      .refine(
        (value) =>
          new TextEncoder().encode(value).length <= MAX_BODY_HTML_BYTES,
        {
          message: 'Body HTML must be 100 KiB or smaller',
        }
      ),
  })
  .strict()

const emailStageSchema = z
  .object({
    stage_no: z.number().int().min(1).max(3),
    delay_seconds: nonNegativeInteger,
    template_version: z.number().int().min(1),
    source_revision: nonNegativeInteger.optional().default(0),
    translated_source_revision: nonNegativeInteger.optional().default(0),
    manual_locales: z.array(recallTargetLocaleSchema).optional().default([]),
    templates: z.record(z.string().trim().min(1), emailTemplateSchema),
  })
  .strict()
  .refine((stage) => Boolean(stage.templates.en), {
    path: ['templates', 'en'],
    message: 'English template is required',
  })
  .superRefine((stage, context) => {
    for (const [locale, template] of Object.entries(stage.templates)) {
      const bodyCount = [template.body_text, template.body_html].filter(
        (value) => value.trim() !== ''
      ).length
      const emptyTarget =
        locale !== 'en' && template.subject.trim() === '' && bodyCount === 0
      if (emptyTarget) continue
      if (bodyCount !== 1) {
        context.addIssue({
          code: 'custom',
          path: ['templates', locale, 'body_html'],
          message: 'Exactly one email body is required',
        })
      }
    }
  })

const emailSequenceSchema = z
  .array(emailStageSchema)
  .min(1)
  .max(3)
  .superRefine((sequence, context) => {
    let previousDelay = -1
    sequence.forEach((stage, index) => {
      if (stage.stage_no !== index + 1) {
        context.addIssue({
          code: 'custom',
          path: [index, 'stage_no'],
          message: 'Email stages must be ordered from one',
        })
      }
      if (
        (index === 0 && stage.delay_seconds !== 0) ||
        stage.delay_seconds <= previousDelay
      ) {
        context.addIssue({
          code: 'custom',
          path: [index, 'delay_seconds'],
          message: 'Email delays must start at zero and increase',
        })
      }
      previousDelay = stage.delay_seconds
    })
  })

const activatedUpdateFieldsSchema = z
  .object({
    name: z.string().trim().min(1).max(128),
    email_sequence: emailSequenceSchema,
  })
  .passthrough()

export const recallCampaignActivatedUpdateSchema =
  activatedUpdateFieldsSchema as unknown as z.ZodType<
    RecallCampaignDraft,
    RecallCampaignDraft
  >

export const recallCampaignDraftSchema = z
  .object({
    campaign_type: campaignTypeSchema,
    name: z.string().trim().min(1).max(128),
    audience_template: z.enum([
      'first_purchase',
      'lapsed_payer',
      'expired_subscription',
      'registered_only',
      'registration_time_range',
      'specified_users',
    ]),
    audience_config: audienceSchema,
    execution_mode: z.enum(['manual', 'scheduled_once', 'recurring']),
    schedule: scheduleSchema,
    coupon_source: z.enum(['automatic', 'existing']),
    existing_coupon_id: z.string(),
    discount_config: discountSchema,
    product_scope: productScopeSchema,
    promotion_expiry_mode: z.enum(['relative', 'fixed']).default('relative'),
    promotion_expires_at: nonNegativeInteger.default(0),
    promotion_valid_seconds: nonNegativeInteger,
    enrollment_limit: z.number().int().min(1).max(100_000),
    worker_concurrency: z.number().int().min(1).max(20),
    email_sequence: emailSequenceSchema,
    defer_localization: z.boolean().default(true),
  })
  .strict()
  .superRefine((draft, context) => {
    if (
      draft.audience_template === 'first_purchase' ||
      draft.audience_template === 'lapsed_payer' ||
      draft.audience_template === 'expired_subscription'
    ) {
      validateLegacyAudience(draft.audience_config, context)
    }
    if (draft.audience_template === 'registered_only') {
      validateRegisteredOnlyAudience(draft.audience_config, context)
    }
    if (draft.audience_template === 'registration_time_range') {
      validateRegistrationTimeRangeAudience(draft.audience_config, context)
    }
    if (draft.audience_template === 'specified_users') {
      validateSpecifiedUsersAudience(draft.audience_config, context)
    }
    if (
      draft.campaign_type === 'content_only' &&
      draft.promotion_valid_seconds <= 0
    ) {
      context.addIssue({
        code: 'custom',
        path: ['promotion_valid_seconds'],
        message: 'Activity delivery validity is required',
      })
    }
    if (draft.campaign_type === 'content_only') {
      return
    }
    if (
      draft.coupon_source === 'automatic' &&
      draft.existing_coupon_id.trim() !== ''
    ) {
      context.addIssue({
        code: 'custom',
        path: ['existing_coupon_id'],
        message: 'Automatic coupons cannot use an existing coupon ID',
      })
    }
    const discountResult = promotionDiscountSchema.safeParse(
      draft.discount_config
    )
    if (!discountResult.success) {
      for (const issue of discountResult.error.issues) {
        context.addIssue({
          ...issue,
          path: ['discount_config', ...issue.path],
        })
      }
    }
    if (
      draft.coupon_source === 'automatic' &&
      draft.discount_config.type === 'fixed'
    ) {
      const discount = draft.discount_config
      if (discount.currency !== 'USD') {
        context.addIssue({
          code: 'custom',
          path: ['discount_config', 'currency'],
          message: 'Automatic fixed coupons must use USD as the base currency',
        })
      }
      const currencies = Object.keys(discount.currency_options).sort()
      if (currencies.join(',') !== 'brl,inr,jpy') {
        context.addIssue({
          code: 'custom',
          path: ['discount_config', 'currency_options'],
          message: 'INR, BRL, and JPY amounts are required',
        })
      }
      for (const currency of ['inr', 'brl', 'jpy']) {
        if ((discount.currency_options[currency] ?? 0) <= 0) {
          context.addIssue({
            code: 'custom',
            path: ['discount_config', 'currency_options', currency],
            message: `${currency.toUpperCase()} amount is required`,
          })
        }
      }
    }
    if (
      draft.coupon_source === 'existing' &&
      draft.existing_coupon_id.trim() === ''
    ) {
      context.addIssue({
        code: 'custom',
        path: ['existing_coupon_id'],
        message: 'Existing coupon ID is required',
      })
    }
    if (draft.promotion_expiry_mode === 'relative') {
      if (draft.promotion_valid_seconds <= 0) {
        context.addIssue({
          code: 'custom',
          path: ['promotion_valid_seconds'],
          message: 'Promotion validity must be positive',
        })
      }
      if (draft.promotion_expires_at !== 0) {
        context.addIssue({
          code: 'custom',
          path: ['promotion_expires_at'],
          message: 'Fixed promotion expiry must be empty',
        })
      }
    }
    if (draft.promotion_expiry_mode === 'fixed') {
      if (draft.promotion_expires_at <= Date.now() / 1000) {
        context.addIssue({
          code: 'custom',
          path: ['promotion_expires_at'],
          message: 'Fixed promotion expiry must be in the future',
        })
      }
      if (
        draft.execution_mode === 'scheduled_once' &&
        draft.promotion_expires_at <= draft.schedule.scheduled_at
      ) {
        context.addIssue({
          code: 'custom',
          path: ['promotion_expires_at'],
          message:
            'Fixed promotion expiry must be after the scheduled run time',
        })
      }
      if (draft.promotion_valid_seconds !== 0) {
        context.addIssue({
          code: 'custom',
          path: ['promotion_valid_seconds'],
          message: 'Relative promotion validity must be empty',
        })
      }
    }
    if (
      draft.execution_mode === 'scheduled_once' &&
      draft.schedule.scheduled_at <= Date.now() / 1000
    ) {
      context.addIssue({
        code: 'custom',
        path: ['schedule', 'scheduled_at'],
        message: 'Scheduled time must be in the future',
      })
    }
    if (
      draft.execution_mode === 'scheduled_once' &&
      draft.discount_config.coupon_redeem_by > 0 &&
      draft.discount_config.coupon_redeem_by <= draft.schedule.scheduled_at
    ) {
      context.addIssue({
        code: 'custom',
        path: ['discount_config', 'coupon_redeem_by'],
        message: 'Coupon redeem-by must be after the scheduled run time',
      })
    }
    if (draft.execution_mode === 'recurring') {
      if (!isIanaTimezone(draft.schedule.timezone)) {
        context.addIssue({
          code: 'custom',
          path: ['schedule', 'timezone'],
          message: 'IANA timezone is required',
        })
      }
      if (
        draft.schedule.frequency !== 'daily' &&
        draft.schedule.frequency !== 'weekly'
      ) {
        context.addIssue({
          code: 'custom',
          path: ['schedule', 'frequency'],
          message: 'Frequency is invalid',
        })
      }
      if (draft.schedule.hour < 0 || draft.schedule.hour > 23) {
        context.addIssue({
          code: 'custom',
          path: ['schedule', 'hour'],
          message: 'Hour is invalid',
        })
      }
      if (draft.schedule.minute < 0 || draft.schedule.minute > 59) {
        context.addIssue({
          code: 'custom',
          path: ['schedule', 'minute'],
          message: 'Minute is invalid',
        })
      }
      if (
        draft.schedule.frequency === 'weekly' &&
        (draft.schedule.weekday < 0 || draft.schedule.weekday > 6)
      ) {
        context.addIssue({
          code: 'custom',
          path: ['schedule', 'weekday'],
          message: 'Weekday is invalid',
        })
      }
    }
  })
  .transform((draft) =>
    draft.audience_template === 'specified_users'
      ? {
          ...draft,
          audience_config: {
            ...draft.audience_config,
            specified_emails: normalizeSpecifiedEmails(
              draft.audience_config.specified_emails
            ),
          },
        }
      : draft
  ) as unknown as z.ZodType<RecallCampaignDraft, RecallCampaignDraft>
