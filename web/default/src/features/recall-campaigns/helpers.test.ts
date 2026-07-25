import { createFormControl } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { describe, expect, test } from 'bun:test'
import {
  convertRecallBodyTextToHtml,
  formatRecallMinorAmount,
  getRecallPageCount,
  getRecallRecipientRetry,
  insertRecallEmailAction,
  normalizeRecallGroupsForMode,
  normalizeRecallCouponSource,
  normalizeRecallDiscountType,
  parseRecallMajorAmount,
  prepareRecallCampaignSubmitDraft,
  removeRecallEmailStage,
  setRecallCampaignGroups,
  setRecallCampaignGroupMode,
} from './helpers'
import { recallCampaignDraftSchema } from './schemas'
import type {
  RecallCampaignDraft,
  RecallEmailStage,
  RecallRecipient,
} from './types'

function makeDraft(): RecallCampaignDraft {
  return {
    coupon_source: 'existing',
    existing_coupon_id: 'coupon_old',
    discount_config: {
      type: 'fixed',
      percent_off: 0,
      amount_off: 500,
      currency: 'usd',
      currency_options: { inr: 45_000, brl: 2_500, jpy: 750 },
      minimum_amount: 100,
      minimum_amount_currency: 'usd',
      coupon_redeem_by: 0,
    },
  } as RecallCampaignDraft
}

function makeValidDraft(): RecallCampaignDraft {
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
      groups: ['paid'],
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
          en: { subject: 'We miss you', body_text: 'Come back soon.' },
        },
      },
    ],
  }
}

function makeStage(stageNo: number, delaySeconds: number): RecallEmailStage {
  return {
    stage_no: stageNo,
    delay_seconds: delaySeconds,
    template_version: 1,
    templates: { en: { subject: `Stage ${stageNo}`, body_text: 'Body' } },
  }
}

function makeRecipient(
  state: RecallRecipient['state'],
  messageStates: RecallRecipient['messages'][number]['state'][],
  leaseExpiresAt: number[] = []
): RecallRecipient {
  return {
    state,
    messages: messageStates.map((messageState, index) => ({
      id: index + 1,
      state: messageState,
      lease_expires_at: leaseExpiresAt[index] ?? 0,
    })),
  } as RecallRecipient
}

describe('recall campaign editor normalization', () => {
  test('normalizes legacy English text to HTML without changing hidden translations', () => {
    const draft = makeValidDraft()
    draft.email_sequence[0].templates = {
      en: { subject: 'English subject', body_text: 'English body' },
      fr: {
        subject: 'Localized subject',
        body_text: 'Localized text',
        body_html: '<p>Localized HTML</p>',
      },
    }

    const normalized = prepareRecallCampaignSubmitDraft(draft)

    expect(normalized.email_sequence[0].templates.en).toMatchObject({
      subject: 'English subject',
      body_text: '',
    })
    expect(normalized.email_sequence[0].templates.en.body_html).toContain(
      '<p>English body</p>'
    )
    expect(normalized.email_sequence[0].templates.fr).toEqual(
      draft.email_sequence[0].templates.fr
    )
  })

  test('clones hidden localized templates when preserving their values', () => {
    const draft = makeValidDraft()
    draft.email_sequence[0].templates = {
      en: { subject: 'English subject', body_text: 'English body' },
      fr: {
        subject: 'Localized subject',
        body_text: 'Localized text',
        body_html: '<p>Localized HTML</p>',
      },
    }

    const normalized = prepareRecallCampaignSubmitDraft(draft)

    expect(normalized.email_sequence[0].templates.fr).toEqual(
      draft.email_sequence[0].templates.fr
    )
    expect(normalized.email_sequence[0].templates.fr).not.toBe(
      draft.email_sequence[0].templates.fr
    )

    normalized.email_sequence[0].templates.fr.body_html = '<p>Changed</p>'
    expect(draft.email_sequence[0].templates.fr.body_html).toBe(
      '<p>Localized HTML</p>'
    )
  })

  test('preserves English HTML drafts and clears submitted body text', () => {
    const draft = makeValidDraft()
    draft.email_sequence[0].templates.en = {
      subject: 'English subject',
      body_text: 'stale text',
      body_html: '<p>Editable HTML</p>',
    }

    const normalized = prepareRecallCampaignSubmitDraft(draft)

    expect(normalized.email_sequence[0].templates.en).toEqual({
      subject: 'English subject',
      body_text: '',
      body_html: '<p>Editable HTML</p>',
    })
  })

  test('converts plain English body input from the HTML editor before submit', () => {
    const draft = makeValidDraft()
    draft.email_sequence[0].templates.en = {
      subject: 'English subject',
      body_text: '',
      body_html: 'Plain line\n2 < 3',
    }

    const normalized = prepareRecallCampaignSubmitDraft(draft)

    expect(normalized.email_sequence[0].templates.en).toMatchObject({
      subject: 'English subject',
      body_text: '',
    })
    expect(normalized.email_sequence[0].templates.en.body_html).toContain(
      '<p>Plain line</p>'
    )
    expect(normalized.email_sequence[0].templates.en.body_html).toContain(
      '<p>2 &lt; 3</p>'
    )
    expect(normalized.email_sequence[0].templates.en.body_html).toContain(
      'href="{{.ClaimURL}}"'
    )
  })

  test('validates exactly one email body and preserves hidden localized HTML', () => {
    const validHtml = makeValidDraft()
    validHtml.audience_config.groups = []
    validHtml.email_sequence[0].templates = {
      en: { subject: 'English subject', body_html: '<p>English body</p>' },
      fr: { subject: 'Localized subject', body_html: '<p>Localized HTML</p>' },
    }
    const htmlResult = recallCampaignDraftSchema.safeParse(validHtml)
    expect(htmlResult.success).toBe(true)
    if (htmlResult.success) {
      expect(htmlResult.data.email_sequence[0].templates.fr.body_html).toBe(
        '<p>Localized HTML</p>'
      )
    }

    const validText = makeValidDraft()
    validText.audience_config.groups = []
    validText.email_sequence[0].templates.en = {
      subject: 'English subject',
      body_text: 'English body',
    }
    expect(recallCampaignDraftSchema.safeParse(validText).success).toBe(true)

    const neither = makeValidDraft()
    neither.audience_config.groups = []
    neither.email_sequence[0].templates.en = {
      subject: 'English subject',
      body_text: ' ',
      body_html: '',
    }
    const neitherResult = recallCampaignDraftSchema.safeParse(neither)
    expect(neitherResult.success).toBe(false)
    if (!neitherResult.success) {
      expect(neitherResult.error.issues).toContainEqual(
        expect.objectContaining({
          path: ['email_sequence', 0, 'templates', 'en', 'body_html'],
        })
      )
    }

    const both = makeValidDraft()
    both.audience_config.groups = []
    both.email_sequence[0].templates.en = {
      subject: 'English subject',
      body_text: 'English body',
      body_html: '<p>English body</p>',
    }
    const bothResult = recallCampaignDraftSchema.safeParse(both)
    expect(bothResult.success).toBe(false)
    if (!bothResult.success) {
      expect(bothResult.error.issues).toContainEqual(
        expect.objectContaining({
          path: ['email_sequence', 0, 'templates', 'en', 'body_html'],
        })
      )
    }
  })

  test('rejects HTML bodies over 100 KiB by UTF-8 byte length', () => {
    const valid = makeValidDraft()
    valid.audience_config.groups = []
    valid.email_sequence[0].templates.en = {
      subject: 'English subject',
      body_html: '界'.repeat(Math.floor(102_400 / 3)),
    }
    expect(recallCampaignDraftSchema.safeParse(valid).success).toBe(true)

    const tooLarge = makeValidDraft()
    tooLarge.audience_config.groups = []
    tooLarge.email_sequence[0].templates.en = {
      subject: 'English subject',
      body_html: `${'界'.repeat(Math.floor(102_400 / 3))}界`,
    }
    const result = recallCampaignDraftSchema.safeParse(tooLarge)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues).toContainEqual(
        expect.objectContaining({
          path: ['email_sequence', 0, 'templates', 'en', 'body_html'],
          message: 'Body HTML must be 100 KiB or smaller',
        })
      )
    }
  })

  test('converts legacy recall body text to HTML with required actions', () => {
    expect(convertRecallBodyTextToHtml('Hello\nSecond line')).toContain(
      '<p>Hello</p>'
    )
    expect(convertRecallBodyTextToHtml('Hello')).toContain('{{.ClaimURL}}')
    expect(convertRecallBodyTextToHtml('Hello')).toContain(
      '{{.UnsubscribeURL}}'
    )
  })

  test('inserts recall email actions at the active selection', () => {
    expect(insertRecallEmailAction('abc', 1, 2, '{{.ClaimURL}}')).toEqual({
      value: 'a{{.ClaimURL}}c',
      selection: 14,
    })
  })

  test('canonicalizes no-filter groups at the editor submission boundary without dropping translations', () => {
    const draft = makeDraft()
    draft.audience_config = {
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
      groups: ['stale-group'],
      group_mode: '',
      require_verified_email: true,
    }
    draft.email_sequence = [
      {
        stage_no: 1,
        delay_seconds: 0,
        template_version: 1,
        templates: {
          en: { subject: 'English subject', body_text: 'English body' },
          fr: { subject: 'Sujet français', body_text: 'Corps français' },
        },
      },
    ]

    const normalized = prepareRecallCampaignSubmitDraft(draft)

    expect(normalized).not.toBe(draft)
    expect(draft.audience_config.groups).toEqual(['stale-group'])
    expect(normalized.audience_config.groups).toEqual([])
    expect(normalized.email_sequence[0].templates.en).toMatchObject({
      subject: 'English subject',
      body_text: '',
    })
    expect(normalized.email_sequence[0].templates.en.body_html).toContain(
      '<p>English body</p>'
    )
    expect(normalized.email_sequence[0].templates.fr).toEqual({
      subject: 'Sujet français',
      body_text: 'Corps français',
    })
  })

  test('clears groups when no group filter is selected', () => {
    expect(normalizeRecallGroupsForMode(['paid', 'trial'], '')).toEqual([])
  })

  test.each(['allow', 'block'] as const)(
    'preserves normalized groups in %s mode',
    (mode) => {
      const groups = ['paid', 'trial']

      expect(normalizeRecallGroupsForMode(groups, mode)).toEqual(groups)
    }
  )

  test.each([
    ['', []],
    ['allow', ['paid']],
  ] as const)(
    'revalidates the audience after switching group mode to %s',
    async (mode, expectedGroups) => {
      const form = createFormControl<RecallCampaignDraft>({
        resolver: zodResolver(recallCampaignDraftSchema),
        defaultValues: makeValidDraft(),
      })
      const subscription = form.subscribe({
        formState: { values: true },
        callback: () => undefined,
      })
      form.register('audience_config.group_mode')
      form.register('audience_config.groups')
      await form.trigger('audience_config')
      expect(
        form.getFieldState('audience_config.group_mode').error?.message
      ).toBe('Group mode is required')

      await setRecallCampaignGroupMode(form, mode)

      expect(form.getValues('audience_config.groups')).toEqual(expectedGroups)
      expect(
        form.getFieldState('audience_config.group_mode').error
      ).toBeUndefined()
      subscription()
    }
  )

  test('revalidates the audience after entering groups for an active filter', async () => {
    const draft = makeValidDraft()
    draft.audience_config.groups = []
    const form = createFormControl<RecallCampaignDraft>({
      resolver: zodResolver(recallCampaignDraftSchema),
      defaultValues: draft,
    })
    const subscription = form.subscribe({
      formState: { values: true },
      callback: () => undefined,
    })
    form.register('audience_config.group_mode')
    form.register('audience_config.groups')

    await setRecallCampaignGroupMode(form, 'allow')
    expect(
      form.getFieldState('audience_config.group_mode').error?.message
    ).toBe('Groups are required')

    await setRecallCampaignGroups(form, ['paid'])

    expect(form.getValues('audience_config.groups')).toEqual(['paid'])
    expect(
      form.getFieldState('audience_config.group_mode').error
    ).toBeUndefined()
    subscription()
  })

  test('clears the hidden existing coupon ID when switching to automatic', () => {
    const normalized = normalizeRecallCouponSource(makeDraft(), 'automatic')

    expect(normalized.coupon_source).toBe('automatic')
    expect(normalized.existing_coupon_id).toBe('')
  })

  test('clears fixed-only fields when switching to percent', () => {
    const normalized = normalizeRecallDiscountType(makeDraft(), 'percent')

    expect(normalized.discount_config).toMatchObject({
      type: 'percent',
      percent_off: 20,
      amount_off: 0,
      currency: '',
      currency_options: {},
      minimum_amount: 100,
      minimum_amount_currency: 'USD',
    })
  })

  test('establishes the four automatic fixed discount defaults', () => {
    const draft = makeDraft()
    draft.coupon_source = 'automatic'
    draft.discount_config = {
      ...draft.discount_config,
      type: 'percent',
      percent_off: 15,
      amount_off: 0,
      currency: '',
      currency_options: {},
      minimum_amount: 100,
      minimum_amount_currency: 'eur',
    }

    const normalized = normalizeRecallDiscountType(draft, 'fixed')

    expect(normalized.discount_config).toMatchObject({
      type: 'fixed',
      percent_off: 0,
      amount_off: 500,
      currency: 'USD',
      currency_options: { inr: 45_000, brl: 2_500, jpy: 750 },
      minimum_amount: 0,
      minimum_amount_currency: '',
    })
  })

  test('converts human-readable fixed amounts to Stripe minor units', () => {
    expect(parseRecallMajorAmount('USD', '5.00')).toBe(500)
    expect(parseRecallMajorAmount('INR', '450.00')).toBe(45_000)
    expect(parseRecallMajorAmount('BRL', '25.00')).toBe(2_500)
    expect(parseRecallMajorAmount('JPY', '750')).toBe(750)
    expect(parseRecallMajorAmount('USD', '5.001')).toBeNull()
    expect(parseRecallMajorAmount('JPY', '750.5')).toBeNull()
    expect(parseRecallMajorAmount('BRL', '0')).toBeNull()
  })

  test('formats Stripe minor units as human-readable fixed amounts', () => {
    expect(formatRecallMinorAmount('USD', 500)).toBe('5.00')
    expect(formatRecallMinorAmount('INR', 45_000)).toBe('450.00')
    expect(formatRecallMinorAmount('BRL', 2_500)).toBe('25.00')
    expect(formatRecallMinorAmount('JPY', 750)).toBe('750')
  })

  test('renumbers stages after removing a middle stage', () => {
    const stages = [
      makeStage(1, 0),
      makeStage(2, 86_400),
      makeStage(3, 172_800),
    ]

    expect(removeRecallEmailStage(stages, 1)).toEqual([
      makeStage(1, 0),
      { ...makeStage(3, 172_800), stage_no: 2 },
    ])
  })
})

describe('recall campaign detail guards', () => {
  test('exposes a second detail page beyond the first 100 rows', () => {
    expect(getRecallPageCount(101, 100)).toBe(2)
  })

  test('matches backend retry eligibility and uncertain acknowledgment', () => {
    expect(getRecallRecipientRetry(makeRecipient('failed', []))).toEqual({
      allowed: true,
      acknowledgeUncertain: false,
    })
    expect(
      getRecallRecipientRetry(makeRecipient('contacting', ['failed']))
    ).toEqual({ allowed: true, acknowledgeUncertain: false })
    expect(
      getRecallRecipientRetry(makeRecipient('contacting', ['uncertain']))
    ).toEqual({ allowed: true, acknowledgeUncertain: true })
    expect(
      getRecallRecipientRetry(
        makeRecipient('contacting', ['uncertain', 'failed'])
      )
    ).toEqual({ allowed: true, acknowledgeUncertain: false })
    expect(
      getRecallRecipientRetry(makeRecipient('contacting', ['accepted']))
    ).toEqual({ allowed: false, acknowledgeUncertain: false })
    expect(
      getRecallRecipientRetry(
        makeRecipient('contacting', ['sending'], [998]),
        999
      )
    ).toEqual({ allowed: true, acknowledgeUncertain: true })
    expect(
      getRecallRecipientRetry(
        makeRecipient('contacting', ['sending'], [999]),
        999
      )
    ).toEqual({ allowed: false, acknowledgeUncertain: false })
    expect(
      getRecallRecipientRetry(
        makeRecipient('contacting', ['sending'], [1_000]),
        999
      )
    ).toEqual({ allowed: false, acknowledgeUncertain: false })
    expect(
      getRecallRecipientRetry(
        makeRecipient('contacting', ['sending'], [0]),
        999
      )
    ).toEqual({ allowed: false, acknowledgeUncertain: false })
  })
})
