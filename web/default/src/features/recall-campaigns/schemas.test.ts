import { describe, expect, test } from 'bun:test'
import {
  recallCampaignActivatedUpdateSchema,
  recallCampaignDraftSchema,
} from './schemas'

const FUTURE_TIMESTAMP = Math.floor(Date.now() / 1000) + 86_400

function makeDraft() {
  return {
    name: 'Win back inactive customers',
    audience_template: 'first_purchase',
    audience_config: {
      registration_age_days: 14,
      min_request_count: 1,
      max_quota: 10,
      min_paid_amount: 0,
      last_api_call_age_days: 0,
      last_payment_age_days: 0,
      subscription_expired_days: 0,
      min_subscription_amount: 0,
      min_subscription_count: 0,
      payment_providers: [],
      groups: [],
      group_mode: '',
      require_verified_email: true,
    },
    execution_mode: 'manual',
    schedule: {
      scheduled_at: 0,
      timezone: '',
      frequency: '',
      weekday: 0,
      hour: 0,
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
      coupon_redeem_by: 0,
    },
    product_scope: {
      topup_price_ids: ['price_topup_20'],
      subscription_price_ids: [],
    },
    promotion_valid_seconds: 604_800,
    enrollment_limit: 1_000,
    worker_concurrency: 5,
    email_sequence: [
      {
        stage_no: 1,
        delay_seconds: 0,
        template_version: 1,
        templates: {
          en: {
            subject: 'We miss you',
            body_text: 'Come back and save on your next purchase.',
          },
        },
      },
    ],
  }
}

describe('recallCampaignDraftSchema', () => {
  test.each([
    {
      template: 'first_purchase',
      thresholds: {
        registration_age_days: 14,
        min_request_count: 5,
        max_quota: 20,
      },
    },
    {
      template: 'lapsed_payer',
      thresholds: {
        min_paid_amount: 50,
        last_payment_age_days: 60,
        last_api_call_age_days: 30,
      },
    },
    {
      template: 'expired_subscription',
      thresholds: {
        subscription_expired_days: 30,
        min_subscription_amount: 100,
        min_subscription_count: 2,
      },
    },
  ])(
    'accepts the $template audience thresholds',
    ({ template, thresholds }) => {
      const draft = makeDraft()
      draft.audience_template = template
      Object.assign(draft.audience_config, thresholds)

      expect(recallCampaignDraftSchema.safeParse(draft).success).toBe(true)
    }
  )

  test('defaults new audience fields for legacy drafts', () => {
    const draft = makeDraft()

    const result = recallCampaignDraftSchema.safeParse(draft)

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.audience_config.registration_start_at).toBe(0)
      expect(result.data.audience_config.registration_end_at).toBe(0)
      expect(result.data.audience_config.specified_user_ids).toEqual([])
      expect(result.data.audience_config.specified_emails).toEqual([])
    }
  })

  test('validates registered_only registration range on active controls', () => {
    const missing = makeDraft()
    missing.audience_template = 'registered_only'
    const missingResult = recallCampaignDraftSchema.safeParse(missing)
    expect(missingResult.success).toBe(false)
    if (!missingResult.success) {
      expect(missingResult.error.issues).toContainEqual(
        expect.objectContaining({
          path: ['audience_config', 'registration_start_at'],
        })
      )
      expect(missingResult.error.issues).toContainEqual(
        expect.objectContaining({
          path: ['audience_config', 'registration_end_at'],
        })
      )
    }

    const reversed = makeDraft()
    reversed.audience_template = 'registered_only'
    reversed.audience_config.registration_start_at = 200
    reversed.audience_config.registration_end_at = 100
    const reversedResult = recallCampaignDraftSchema.safeParse(reversed)
    expect(reversedResult.success).toBe(false)
    if (!reversedResult.success) {
      expect(reversedResult.error.issues).toContainEqual(
        expect.objectContaining({
          path: ['audience_config', 'registration_end_at'],
          message: 'Registration end must be on or after start',
        })
      )
    }

    const sameBoundary = makeDraft()
    sameBoundary.audience_template = 'registered_only'
    sameBoundary.audience_config.registration_start_at = 100
    sameBoundary.audience_config.registration_end_at = 100
    expect(recallCampaignDraftSchema.safeParse(sameBoundary).success).toBe(true)

    const valid = makeDraft()
    valid.audience_template = 'registered_only'
    valid.audience_config.registration_start_at = 100
    valid.audience_config.registration_end_at = 200
    expect(recallCampaignDraftSchema.safeParse(valid).success).toBe(true)
  })

  test('validates specified_users active IDs and emails', () => {
    const empty = makeDraft()
    empty.audience_template = 'specified_users'
    const emptyResult = recallCampaignDraftSchema.safeParse(empty)
    expect(emptyResult.success).toBe(false)
    if (!emptyResult.success) {
      expect(emptyResult.error.issues).toContainEqual(
        expect.objectContaining({
          path: ['audience_config', 'specified_user_ids'],
        })
      )
    }

    const invalidId = makeDraft()
    invalidId.audience_template = 'specified_users'
    invalidId.audience_config.specified_user_ids = [1, 0]
    expect(recallCampaignDraftSchema.safeParse(invalidId).success).toBe(false)

    const invalidEmail = makeDraft()
    invalidEmail.audience_template = 'specified_users'
    invalidEmail.audience_config.specified_emails = ['valid@example.com', 'bad']
    const invalidEmailResult = recallCampaignDraftSchema.safeParse(invalidEmail)
    expect(invalidEmailResult.success).toBe(false)
    if (!invalidEmailResult.success) {
      expect(invalidEmailResult.error.issues).toContainEqual(
        expect.objectContaining({
          path: ['audience_config', 'specified_emails'],
        })
      )
    }

    const valid = makeDraft()
    valid.audience_template = 'specified_users'
    valid.audience_config.specified_user_ids = [1, 2]
    valid.audience_config.specified_emails = ['a@example.com']
    expect(recallCampaignDraftSchema.safeParse(valid).success).toBe(true)
  })

  test('limits specified_users to 500 normalized recipients', () => {
    const valid = makeDraft()
    valid.audience_template = 'specified_users'
    valid.audience_config.specified_user_ids = Array.from(
      { length: 250 },
      (_, index) => index + 1
    )
    valid.audience_config.specified_emails = Array.from(
      { length: 250 },
      (_, index) => `user-${index}@example.com`
    )
    expect(recallCampaignDraftSchema.safeParse(valid).success).toBe(true)

    const tooMany = structuredClone(valid)
    tooMany.audience_config.specified_emails.push('overflow@example.com')
    const result = recallCampaignDraftSchema.safeParse(tooMany)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues).toContainEqual(
        expect.objectContaining({
          path: ['audience_config', 'specified_emails'],
        })
      )
    }
  })

  test('dedupes specified_users recipients before enforcing the 500 limit', () => {
    const draft = makeDraft()
    draft.audience_template = 'specified_users'
    draft.audience_config.specified_emails = Array.from(
      { length: 501 },
      (_, index) =>
        index % 2 === 0 ? 'Duplicate@Example.com' : 'duplicate@example.com'
    )

    const result = recallCampaignDraftSchema.safeParse(draft)

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.audience_config.specified_emails).toEqual([
        'duplicate@example.com',
      ])
    }
  })

  test('rejects blank specified_users emails before normalized dedupe', () => {
    const draft = makeDraft()
    draft.audience_template = 'specified_users'
    draft.audience_config.specified_user_ids = [1]
    draft.audience_config.specified_emails = ['   ']

    const result = recallCampaignDraftSchema.safeParse(draft)

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues).toContainEqual(
        expect.objectContaining({
          path: ['audience_config', 'specified_emails'],
        })
      )
    }
  })

  test('rejects backend-incompatible specified_users email shapes', () => {
    for (const email of [
      'a..b@example.com',
      'a@example..com',
      'a@example.com.',
      'Alice <a@example.com>',
      'a@example.com (Alice)',
      'a@example.com; b@example.com',
      'a@-example.com',
      'a@example-.com',
    ]) {
      const draft = makeDraft()
      draft.audience_template = 'specified_users'
      draft.audience_config.specified_emails = [email]

      const result = recallCampaignDraftSchema.safeParse(draft)

      expect(result.success, email).toBe(false)
      if (!result.success) {
        expect(result.error.issues).toContainEqual(
          expect.objectContaining({
            path: ['audience_config', 'specified_emails'],
          })
        )
      }
    }
  })

  test('does not validate hidden template-specific fields for other audiences', () => {
    const firstPurchase = makeDraft()
    firstPurchase.audience_config.registration_start_at = 200
    firstPurchase.audience_config.registration_end_at = 100
    firstPurchase.audience_config.specified_user_ids = [0]
    firstPurchase.audience_config.specified_emails = ['bad-email']
    expect(recallCampaignDraftSchema.safeParse(firstPurchase).success).toBe(
      true
    )

    const specified = makeDraft()
    specified.audience_template = 'specified_users'
    specified.audience_config.specified_user_ids = [1]
    specified.audience_config.registration_start_at = 200
    specified.audience_config.registration_end_at = 100
    specified.audience_config.registration_age_days = -1
    expect(recallCampaignDraftSchema.safeParse(specified).success).toBe(true)
  })

  test.each([
    'registration_age_days',
    'min_request_count',
    'max_quota',
    'min_paid_amount',
    'last_api_call_age_days',
    'last_payment_age_days',
    'subscription_expired_days',
    'min_subscription_amount',
    'min_subscription_count',
  ] as const)('rejects a negative audience threshold: %s', (field) => {
    const draft = makeDraft()
    draft.audience_config[field] = -1

    expect(recallCampaignDraftSchema.safeParse(draft).success).toBe(false)
  })

  test('validates percent discounts', () => {
    const valid = makeDraft()
    expect(recallCampaignDraftSchema.safeParse(valid).success).toBe(true)

    const zeroPercent = makeDraft()
    zeroPercent.discount_config.percent_off = 0
    expect(recallCampaignDraftSchema.safeParse(zeroPercent).success).toBe(false)

    const overOneHundred = makeDraft()
    overOneHundred.discount_config.percent_off = 101
    expect(recallCampaignDraftSchema.safeParse(overOneHundred).success).toBe(
      false
    )

    const amountAlsoSet = makeDraft()
    amountAlsoSet.discount_config.amount_off = 500
    expect(recallCampaignDraftSchema.safeParse(amountAlsoSet).success).toBe(
      false
    )
  })

  test('validates fixed discounts and currency', () => {
    const fixed = makeDraft()
    fixed.discount_config = {
      ...fixed.discount_config,
      type: 'fixed',
      percent_off: 0,
      amount_off: 500,
      currency: 'USD',
      currency_options: { inr: 45_000, brl: 2_500, jpy: 750 },
    }
    expect(recallCampaignDraftSchema.safeParse(fixed).success).toBe(true)

    for (const currency of ['', 'usd', 'US', 'USDD']) {
      const invalid = structuredClone(fixed)
      invalid.discount_config.currency = currency
      expect(recallCampaignDraftSchema.safeParse(invalid).success).toBe(false)
    }

    const noAmount = structuredClone(fixed)
    noAmount.discount_config.amount_off = 0
    expect(recallCampaignDraftSchema.safeParse(noAmount).success).toBe(false)

    const percentAlsoSet = structuredClone(fixed)
    percentAlsoSet.discount_config.percent_off = 10
    expect(recallCampaignDraftSchema.safeParse(percentAlsoSet).success).toBe(
      false
    )

    const missingCurrency = structuredClone(fixed)
    delete missingCurrency.discount_config.currency_options.jpy
    expect(recallCampaignDraftSchema.safeParse(missingCurrency).success).toBe(
      false
    )

    const extraCurrency = structuredClone(fixed)
    extraCurrency.discount_config.currency_options.eur = 500
    expect(recallCampaignDraftSchema.safeParse(extraCurrency).success).toBe(
      false
    )

    const zeroCurrency = structuredClone(fixed)
    zeroCurrency.discount_config.currency_options.brl = 0
    expect(recallCampaignDraftSchema.safeParse(zeroCurrency).success).toBe(
      false
    )
  })

  test('rejects a minimum amount for an automatic fixed discount', () => {
    const fixed = makeDraft()
    fixed.discount_config = {
      ...fixed.discount_config,
      type: 'fixed',
      percent_off: 0,
      amount_off: 500,
      currency: 'USD',
      currency_options: { inr: 45_000, brl: 2_500, jpy: 750 },
      minimum_amount: 1_000,
      minimum_amount_currency: 'USD',
    }

    expect(recallCampaignDraftSchema.safeParse(fixed).success).toBe(false)
  })

  test('accepts automatic coupons and requires an ID for existing coupons', () => {
    expect(recallCampaignDraftSchema.safeParse(makeDraft()).success).toBe(true)

    const existing = makeDraft()
    existing.coupon_source = 'existing'
    existing.existing_coupon_id = 'coupon_existing_1'
    expect(recallCampaignDraftSchema.safeParse(existing).success).toBe(true)

    existing.existing_coupon_id = ''
    expect(recallCampaignDraftSchema.safeParse(existing).success).toBe(false)
  })

  test('requires at least one Stripe Price', () => {
    const subscriptionOnly = makeDraft()
    subscriptionOnly.product_scope.topup_price_ids = []
    subscriptionOnly.product_scope.subscription_price_ids = [
      'price_subscription_monthly',
    ]
    expect(recallCampaignDraftSchema.safeParse(subscriptionOnly).success).toBe(
      true
    )

    subscriptionOnly.product_scope.subscription_price_ids = []
    expect(recallCampaignDraftSchema.safeParse(subscriptionOnly).success).toBe(
      false
    )
  })

  test('ignores schedule validation in manual mode', () => {
    const draft = makeDraft()
    draft.schedule = {
      scheduled_at: 1,
      timezone: 'not/a-zone',
      frequency: 'not-a-frequency',
      weekday: 9,
      hour: 30,
      minute: 90,
    }

    expect(recallCampaignDraftSchema.safeParse(draft).success).toBe(true)
  })

  test('requires a future timestamp for scheduled_once', () => {
    const draft = makeDraft()
    draft.execution_mode = 'scheduled_once'
    draft.schedule.scheduled_at = FUTURE_TIMESTAMP
    expect(recallCampaignDraftSchema.safeParse(draft).success).toBe(true)

    draft.schedule.scheduled_at = 1
    expect(recallCampaignDraftSchema.safeParse(draft).success).toBe(false)
  })

  test('validates recurring IANA timezones and daily fields', () => {
    const draft = makeDraft()
    draft.execution_mode = 'recurring'
    draft.schedule = {
      scheduled_at: 0,
      timezone: 'America/New_York',
      frequency: 'daily',
      weekday: 0,
      hour: 9,
      minute: 30,
    }
    expect(recallCampaignDraftSchema.safeParse(draft).success).toBe(true)

    draft.schedule.timezone = 'Local'
    expect(recallCampaignDraftSchema.safeParse(draft).success).toBe(false)

    draft.schedule.timezone = 'America/New_York'
    draft.schedule.hour = 24
    expect(recallCampaignDraftSchema.safeParse(draft).success).toBe(false)
  })

  test('validates recurring weekly fields', () => {
    const draft = makeDraft()
    draft.execution_mode = 'recurring'
    draft.schedule = {
      scheduled_at: 0,
      timezone: 'Europe/Paris',
      frequency: 'weekly',
      weekday: 6,
      hour: 18,
      minute: 45,
    }
    expect(recallCampaignDraftSchema.safeParse(draft).success).toBe(true)

    draft.schedule.weekday = 7
    expect(recallCampaignDraftSchema.safeParse(draft).success).toBe(false)
  })

  test('requires one to three ordered email stages with increasing delays', () => {
    const draft = makeDraft()
    draft.email_sequence = []
    expect(recallCampaignDraftSchema.safeParse(draft).success).toBe(false)

    draft.email_sequence = [1, 2, 3, 4].map((stageNo) => ({
      ...makeDraft().email_sequence[0],
      stage_no: stageNo,
      delay_seconds: (stageNo - 1) * 86_400,
    }))
    expect(recallCampaignDraftSchema.safeParse(draft).success).toBe(false)

    draft.email_sequence = [
      makeDraft().email_sequence[0],
      {
        ...makeDraft().email_sequence[0],
        stage_no: 2,
        delay_seconds: 86_400,
      },
    ]
    expect(recallCampaignDraftSchema.safeParse(draft).success).toBe(true)

    draft.email_sequence[1].stage_no = 1
    expect(recallCampaignDraftSchema.safeParse(draft).success).toBe(false)

    draft.email_sequence[1].stage_no = 2
    draft.email_sequence[1].delay_seconds = 0
    expect(recallCampaignDraftSchema.safeParse(draft).success).toBe(false)
  })

  test('requires the first email stage delay to be exactly zero', () => {
    const draft = makeDraft()
    draft.email_sequence[0].delay_seconds = 1

    expect(recallCampaignDraftSchema.safeParse(draft).success).toBe(false)
  })

  test('requires an English template and body while allowing a fallback subject', () => {
    const missingEnglish = makeDraft()
    missingEnglish.email_sequence[0].templates = {
      fr: { subject: 'Revenez', body_text: 'Vous nous manquez.' },
    }
    expect(recallCampaignDraftSchema.safeParse(missingEnglish).success).toBe(
      false
    )

    const missingSubject = makeDraft()
    missingSubject.email_sequence[0].templates.en.subject = ''
    expect(recallCampaignDraftSchema.safeParse(missingSubject).success).toBe(
      true
    )

    const missingBody = makeDraft()
    missingBody.email_sequence[0].templates.en.body_text = ''
    expect(recallCampaignDraftSchema.safeParse(missingBody).success).toBe(false)
  })

  test('counts subject and body limits in Unicode characters', () => {
    const valid = makeDraft()
    valid.email_sequence[0].templates.en.subject = '😀'.repeat(200)
    valid.email_sequence[0].templates.en.body_text = '界'.repeat(2_000)
    expect(recallCampaignDraftSchema.safeParse(valid).success).toBe(true)

    const longSubject = structuredClone(valid)
    longSubject.email_sequence[0].templates.en.subject = '😀'.repeat(201)
    const longSubjectResult = recallCampaignDraftSchema.safeParse(longSubject)
    expect(longSubjectResult.success).toBe(false)
    if (!longSubjectResult.success) {
      expect(longSubjectResult.error.issues).toContainEqual(
        expect.objectContaining({
          path: ['email_sequence', 0, 'templates', 'en', 'subject'],
          message: 'Subject must be 200 characters or fewer',
        })
      )
    }

    const longBody = structuredClone(valid)
    longBody.email_sequence[0].templates.en.body_text = '界'.repeat(2_001)
    const longBodyResult = recallCampaignDraftSchema.safeParse(longBody)
    expect(longBodyResult.success).toBe(false)
    if (!longBodyResult.success) {
      expect(longBodyResult.error.issues).toContainEqual(
        expect.objectContaining({
          path: ['email_sequence', 0, 'templates', 'en', 'body_text'],
          message: 'Body text must be 2000 characters or fewer',
        })
      )
    }
  })

  test('requires positive email template versions', () => {
    const draft = makeDraft()
    draft.email_sequence[0].template_version = 0

    expect(recallCampaignDraftSchema.safeParse(draft).success).toBe(false)
  })

  test.each([
    ['enrollment_limit', 0],
    ['enrollment_limit', 100_001],
    ['worker_concurrency', 0],
    ['worker_concurrency', 21],
  ] as const)('rejects %s=%d outside its supported range', (field, value) => {
    const draft = makeDraft()
    draft[field] = value

    expect(recallCampaignDraftSchema.safeParse(draft).success).toBe(false)
  })

  test.each([
    ['enrollment_limit', 1],
    ['enrollment_limit', 100_000],
    ['worker_concurrency', 1],
    ['worker_concurrency', 20],
  ] as const)('accepts %s=%d at its supported boundary', (field, value) => {
    const draft = makeDraft()
    draft[field] = value

    expect(recallCampaignDraftSchema.safeParse(draft).success).toBe(true)
  })
})

describe('recallCampaignActivatedUpdateSchema', () => {
  test('allows future email edits when immutable timestamps are in the past', () => {
    const draft = makeDraft()
    draft.execution_mode = 'scheduled_once'
    draft.schedule.scheduled_at = 1
    draft.discount_config.coupon_redeem_by = 1
    draft.email_sequence[0].templates.en.subject = 'Updated subject'

    expect(recallCampaignActivatedUpdateSchema.safeParse(draft).success).toBe(
      true
    )
  })

  test('still validates activated email content', () => {
    const draft = makeDraft()
    draft.email_sequence[0].templates.en.body_text = ''

    expect(recallCampaignActivatedUpdateSchema.safeParse(draft).success).toBe(
      false
    )
  })

  test('applies email character limits to activated updates', () => {
    const draft = makeDraft()
    draft.email_sequence[0].templates.en.subject = '界'.repeat(201)

    expect(recallCampaignActivatedUpdateSchema.safeParse(draft).success).toBe(
      false
    )
  })
})
