import { describe, expect, test } from 'bun:test'
import type { RecallEmailStage } from '../types'
import {
  formatRecallDeliveryErrorMessage,
  getRecallActivationReadiness,
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
      legacy.templates = (shape === 'null' ? null : undefined) as unknown as
        | RecallEmailStage['templates']

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
  test('translates the stored safe Activity SMTP failure and preserves unknown messages', () => {
    const t = (key: string) =>
      key ===
      'Activity SMTP delivery failed. Check the host, port, credentials, TLS mode, and sender authorization, then retry.'
        ? 'Translated Activity SMTP failure'
        : `translated:${key}`

    expect(
      formatRecallDeliveryErrorMessage(
        'Activity SMTP delivery failed. Check the host, port, credentials, TLS mode, and sender authorization, then retry.',
        t
      )
    ).toBe('Translated Activity SMTP failure')

    expect(formatRecallDeliveryErrorMessage('Raw backend detail', t)).toBe(
      'Raw backend detail'
    )
    expect(formatRecallDeliveryErrorMessage('', t)).toBe('')
  })
})
