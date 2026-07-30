import { describe, expect, test } from 'bun:test'
import type { RecallCampaignMetrics, RecallEmailStage } from '../types'
import {
  formatRecallDeliveryErrorMessage,
  getRecallActivationReadiness,
  getRecallCampaignMetricCards,
} from './campaign-detail'

const locales = ['en', 'zh', 'es', 'fr', 'pt', 'ru', 'ja', 'vi'] as const

function makeStage(): RecallEmailStage {
  return {
    stage_no: 1,
    delay_seconds: 0,
    template_version: 1,
    source_revision: 3,
    translated_source_revision: 3,
    manual_locales: [],
    templates: Object.fromEntries(
      locales.map((locale) => [
        locale,
        { subject: `${locale} subject`, body_html: `<p>${locale}</p>` },
      ])
    ),
  }
}

function makeMetrics(): RecallCampaignMetrics {
  return {
    candidate_count: 10,
    enrolled_count: 8,
    excluded_count: 2,
    customer_success_count: 7,
    customer_failure_count: 1,
    code_success_count: 6,
    code_failure_count: 1,
    messages_scheduled_count: 9,
    messages_accepted_count: 4,
    messages_failed_count: 2,
    messages_cancelled_count: 1,
    opened_recipient_count: 5,
    observed_click_count: 3,
    direct_count: 1,
    assisted_count: 2,
    no_coupon_count: 1,
    currency_metrics: [],
  }
}

describe('Recall campaign activation readiness', () => {
  test('allows activation only for exact current eight-locale templates', () => {
    expect(getRecallActivationReadiness([makeStage()])).toEqual({
      ready: true,
      blockers: [],
    })

    const stale = makeStage()
    stale.source_revision = 4
    const staleReadiness = getRecallActivationReadiness([stale])
    expect(staleReadiness.ready).toBeFalse()
    expect(staleReadiness.blockers[0]).toEqual({
      stage_no: 1,
      locale: 'zh',
      reason: 'stale',
    })

    const missing = makeStage()
    delete missing.templates.fr
    const missingReadiness = getRecallActivationReadiness([missing])
    expect(missingReadiness.ready).toBeFalse()
    expect(missingReadiness.blockers).toContainEqual({
      stage_no: 1,
      locale: 'fr',
      reason: 'missing',
    })

    const invalid = makeStage()
    invalid.templates.de = {
      subject: 'Unexpected locale',
      body_html: '<p>Unexpected</p>',
    }
    const invalidReadiness = getRecallActivationReadiness([invalid])
    expect(invalidReadiness.ready).toBeFalse()
    expect(invalidReadiness.blockers).toContainEqual({
      stage_no: 1,
      locale: 'de',
      reason: 'invalid',
    })
  })

  test.each(['null', 'undefined'] as const)(
    'reports legacy %s templates as missing without crashing',
    (shape) => {
      const legacy = makeStage()
      legacy.templates = (shape === 'null'
        ? null
        : undefined) as unknown as RecallEmailStage['templates']

      const readiness = getRecallActivationReadiness([legacy])

      expect(readiness.ready).toBeFalse()
      expect(readiness.blockers).toContainEqual({
        stage_no: 1,
        locale: 'en',
        reason: 'missing',
      })
      expect(readiness.blockers).toContainEqual({
        stage_no: 1,
        locale: 'fr',
        reason: 'missing',
      })
    }
  )
})

describe('Recall campaign delivery errors', () => {
  test('translates stable Activity SMTP error codes without exposing known raw messages', () => {
    const t = (key: string) =>
      key ===
      'Activity SMTP delivery failed. Check the host, port, credentials, TLS mode, and sender authorization, then retry.'
        ? 'Translated Activity SMTP failure'
        : key ===
            'Activity SMTP is not configured. Configure it before sending.'
          ? 'Translated Activity SMTP not configured'
          : key ===
              'Delivery status is uncertain. Check the mailbox provider before retrying.'
            ? 'Translated uncertain SMTP delivery'
            : `translated:${key}`

    expect(
      formatRecallDeliveryErrorMessage(
        'activity_smtp_send_failed',
        'raw smtp transport detail',
        t
      )
    ).toBe('Translated Activity SMTP failure')

    expect(
      formatRecallDeliveryErrorMessage(
        'activity_smtp_not_configured',
        'raw config detail',
        t
      )
    ).toBe('Translated Activity SMTP not configured')

    expect(
      formatRecallDeliveryErrorMessage(
        'smtp_uncertain',
        'raw timeout detail',
        t
      )
    ).toBe('Translated uncertain SMTP delivery')
  })

  test('uses backend message only as an unknown error fallback', () => {
    const t = (key: string) =>
      key ===
      'Activity SMTP delivery failed. Check the host, port, credentials, TLS mode, and sender authorization, then retry.'
        ? 'Translated Activity SMTP failure'
        : `translated:${key}`

    expect(
      formatRecallDeliveryErrorMessage(
        'unknown_backend_code',
        'Raw backend detail',
        t
      )
    ).toBe('Raw backend detail')

    expect(formatRecallDeliveryErrorMessage('', 'Raw backend detail', t)).toBe(
      'Raw backend detail'
    )
    expect(formatRecallDeliveryErrorMessage('', '', t)).toBe('')
  })
})

describe('Recall campaign metric cards', () => {
  test('shows opened users as a same-level engagement metric for content-only campaigns', () => {
    const cards = getRecallCampaignMetricCards(makeMetrics(), false)

    expect(cards).toContainEqual(['Users who opened', 5])
    expect(cards).toContainEqual(['Observed clicks', 3])
    expect(cards).not.toContainEqual(['Direct conversions', 1])

    const openedIndex = cards.findIndex(
      ([label]) => label === 'Users who opened'
    )
    const clickIndex = cards.findIndex(([label]) => label === 'Observed clicks')
    expect(openedIndex).toBeGreaterThan(-1)
    expect(clickIndex).toBe(openedIndex + 1)
  })

  test('keeps opened users beside observed clicks while retaining promotion conversion metrics', () => {
    const cards = getRecallCampaignMetricCards(makeMetrics(), true)

    expect(cards).toContainEqual(['Users who opened', 5])
    expect(cards).toContainEqual(['Observed clicks', 3])
    expect(cards).toContainEqual(['Direct conversions', 1])
    expect(cards).toContainEqual(['Assisted conversions', 2])
    expect(cards).toContainEqual(['No-coupon conversions', 1])

    const openedIndex = cards.findIndex(
      ([label]) => label === 'Users who opened'
    )
    const clickIndex = cards.findIndex(([label]) => label === 'Observed clicks')
    expect(openedIndex).toBeGreaterThan(-1)
    expect(clickIndex).toBe(openedIndex + 1)
  })
})
