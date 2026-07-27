import * as React from 'react'
import { describe, expect, test } from 'bun:test'
import { createInstance } from 'i18next'
import { renderToStaticMarkup } from 'react-dom/server'
import { I18nextProvider, initReactI18next } from 'react-i18next'
import type { RecallEmailQuotaStatus } from '../types'
import {
  applyRecallEmailHourlyLimit,
  CampaignEmailHourlyLimitControlView,
  getRecallEmailQuotaPollInterval,
  parseRecallEmailHourlyLimit,
  syncRecallEmailHourlyLimitFromServer,
} from './campaign-email-hourly-limit-control'

const testI18n = createInstance()
await testI18n.use(initReactI18next).init({
  lng: 'en',
  fallbackLng: 'en',
  resources: { en: { translation: {} } },
  interpolation: { escapeValue: false },
})

function makeQuota(overrides: Partial<RecallEmailQuotaStatus> = {}) {
  return {
    limit: 100,
    used: 38,
    remaining: 62,
    window_started_at: 1_722_470_400,
    resets_at: 1_722_474_000,
    exhausted: false,
    ...overrides,
  }
}

describe('CampaignEmailHourlyLimitControl', () => {
  test('defaults to 100 and validates the supported global limit range', () => {
    expect(parseRecallEmailHourlyLimit('')).toBeNull()
    expect(parseRecallEmailHourlyLimit('0')).toBeNull()
    expect(parseRecallEmailHourlyLimit('100001')).toBeNull()
    expect(parseRecallEmailHourlyLimit('1')).toBe(1)
    expect(parseRecallEmailHourlyLimit('100')).toBe(100)
    expect(parseRecallEmailHourlyLimit('100000')).toBe(100000)
  })

  test('changes the limit without rewriting current-window usage', () => {
    const quota = makeQuota({ used: 80, remaining: 20 })

    expect(applyRecallEmailHourlyLimit(quota, 120)).toMatchObject({
      limit: 120,
      used: 80,
      remaining: 40,
      exhausted: false,
    })
    expect(applyRecallEmailHourlyLimit(quota, 50)).toMatchObject({
      limit: 50,
      used: 80,
      remaining: 0,
      exhausted: true,
    })
  })

  test('polls at most once a minute before reset and stops while hidden', () => {
    const quota = makeQuota({ resets_at: 1_722_474_000 })
    const now = 1_722_473_000_000

    expect(getRecallEmailQuotaPollInterval(quota, now, true)).toBe(60_000)
    expect(getRecallEmailQuotaPollInterval(quota, now, false)).toBeFalse()
  })

  test('does not overwrite an unsaved administrator limit during polling', () => {
    expect(syncRecallEmailHourlyLimitFromServer('250', 100, 120)).toEqual({
      inputValue: '250',
      confirmedLimit: 120,
    })
    expect(syncRecallEmailHourlyLimitFromServer('100', 100, 120)).toEqual({
      inputValue: '120',
      confirmedLimit: 120,
    })
  })

  test('shows usage, local reset time, module scope, and exhausted queue state', () => {
    const quota = makeQuota({
      used: 100,
      remaining: 0,
      exhausted: true,
    })
    const html = renderToStaticMarkup(
      <I18nextProvider i18n={testI18n}>
        <CampaignEmailHourlyLimitControlView
          error=''
          inputValue='100'
          pending={false}
          quota={quota}
          onInputChange={() => undefined}
          onSave={() => undefined}
        />
      </I18nextProvider>
    )

    expect(html).toContain('100 / 100 sent this hour')
    expect(html).toContain(new Date(quota.resets_at * 1000).toLocaleString())
    expect(html).toContain(
      'All Activity Configuration campaigns share this hourly limit. Other system emails are unaffected.'
    )
    expect(html).toContain(
      'Hourly limit reached. Queued activity emails will resume at'
    )
  })
})
