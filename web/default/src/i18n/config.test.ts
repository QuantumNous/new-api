/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { describe, expect, test } from 'bun:test'
import { recallDeliveryErrorCopyByCode } from '../features/recall-campaigns/copy'
import {
  LANGUAGE_DETECTION_OPTIONS,
  LANGUAGE_PREFERENCE_COOKIE,
} from './config'
import en from './locales/en.json'
import es from './locales/es.json'
import fr from './locales/fr.json'
import ja from './locales/ja.json'
import pt from './locales/pt.json'
import ru from './locales/ru.json'
import vi from './locales/vi.json'
import zh from './locales/zh.json'
import { STATIC_I18N_KEYS } from './static-keys'

const localeTranslations: Record<string, Record<string, string>> = {
  en: en.translation,
  es: es.translation,
  fr: fr.translation,
  ja: ja.translation,
  pt: pt.translation,
  ru: ru.translation,
  vi: vi.translation,
  zh: zh.translation,
}

const conversionAmountTranslations: Record<string, string> = {
  en: 'Conversion amount',
  zh: '转化金额',
  ja: 'コンバージョン金額',
  ru: 'Сумма конверсии',
  es: 'Importe de la conversión',
  fr: 'Montant de la conversion',
  pt: 'Valor da conversão',
  vi: 'Số tiền chuyển đổi',
}

const retiredFlatkeyShortWindowCopyKeys = [
  'Short-term cap: {{fiveHour}} / 5 h · {{weekly}} / 7 days',
  'Rolling 5-hour usage',
  '7-day usage',
  '5-hour window limit',
  '7-day window limit',
  '0 disables this window limit. The value is converted to quota units when saved.',
  '5-hour limit',
  '7-day limit',
  'The active started term is not refunded. Monthly and Image + video usage reset; 5-hour and 7-day rolling usage is retained and re-evaluated.',
  '5-hour limit: {{value}}',
  '7-day limit: {{value}}',
] as const

const operationalActivityCopyKeys = [
  'Manage exclusions',
  'Candidates',
  'Enrolled',
  'Excluded',
  'Accepted messages',
  'Failed messages',
  'Direct conversions',
  'Assisted conversions',
  'No-coupon conversions',
  'Attributed spend',
  'New external cash',
  'Direct top-up',
  'Balance-paid subscription',
  'Online-paid subscription',
  'Unclassified attributed spend',
  'SMTP accepted',
  'Users who opened',
  'Observed clicks',
  'Conversion rows',
  'User rows',
  'Message rows',
  'Metric rows',
  'Snapshot total',
  'Payment category',
  'User ID',
  'Email',
  'Occurred at',
  'Recipient status',
  'Stage',
  'Failure code',
  'Conversion kind',
  'Trade number',
  'Currency',
  'Conversion amount',
  'Translation task {{status}}',
  'queued',
  'running',
  'succeeded',
  'failed',
  'superseded',
  'Historical excluded identities were not recorded',
  'Exclude campaign users',
  'Preview the CSV before applying exclusions.',
  'CSV file',
  'Preview exclusions',
  'Choose a CSV file before previewing exclusions.',
  'Unable to preview exclusions.',
  'Unable to load exclusion batch.',
  'Unable to apply exclusions.',
  'Exclusions applied.',
  '{{count}} total rows',
  '{{count}} resolved users',
  '{{count}} duplicate rows',
  '{{count}} unresolved rows',
  '{{count}} conflict rows',
  '{{count}} cancelable pending emails',
  '{{count}} queued messages can be canceled',
  '{{count}} queued messages were canceled',
  'Confirming will exclude resolved users and cancel pending campaign work that is still cancelable.',
  'Duplicate CSV row ignored.',
  'User is already enrolled in this campaign.',
  'Row {{row}}',
  'User ID must be a positive integer.',
  'Email must be valid.',
  'Row has no user ID or email.',
  'Identity did not resolve to an existing user.',
  'User ID and email resolve to different users.',
  'Batch contains blocking errors from preview.',
  'Row conflicts with a converted recipient.',
  'Apply exclusions',
  'Download current results',
  'Manual',
  'Once',
  'Daily',
  'Weekly',
  'Queued',
  'Running',
  'Succeeded',
  'Failed',
  'Superseded',
  'New campaign data is available.',
  'Refresh campaign data',
  'Regenerating will replace {{count}} manually edited translations.',
  'Translation request was replaced by a newer request.',
  'This message has an uncertain delivery result. Retrying can send a duplicate email and requires explicit acknowledgment.',
  'I acknowledge that retrying an uncertain message may send a duplicate email.',
  'Start date and time',
  'IANA timezone',
  'Absolute offset from the first SMTP accepted email.',
  ...Object.values(recallDeliveryErrorCopyByCode),
] as const

const dynamicOperationalActivityCopyKeys = [
  'Candidates',
  'Enrolled',
  'Excluded',
  'Accepted messages',
  'Failed messages',
  'Direct conversions',
  'Assisted conversions',
  'No-coupon conversions',
  'Attributed spend',
  'New external cash',
  'Direct top-up',
  'Balance-paid subscription',
  'Online-paid subscription',
  'Unclassified attributed spend',
  'SMTP accepted',
  'Users who opened',
  'Observed clicks',
  'Conversion rows',
  'User rows',
  'Message rows',
  'Metric rows',
  'Payment category',
  'User ID',
  'Email',
  'Occurred at',
  'Recipient status',
  'Stage',
  'Failure code',
  'Conversion kind',
  'Trade number',
  'Currency',
  'Conversion amount',
  'queued',
  'running',
  'succeeded',
  'failed',
  'superseded',
  'Duplicate CSV row ignored.',
  'User is already enrolled in this campaign.',
  'User ID must be a positive integer.',
  'Email must be valid.',
  'Row has no user ID or email.',
  'Identity did not resolve to an existing user.',
  'User ID and email resolve to different users.',
  'Batch contains blocking errors from preview.',
  'Row conflicts with a converted recipient.',
  ...Object.values(recallDeliveryErrorCopyByCode),
  'Translation request was replaced by a newer request.',
] as const

const literalOperationalActivityCopyKeys = [
  'Exclude campaign users',
  'Preview exclusions',
  '{{count}} queued messages can be canceled',
  'Row {{row}}',
  'Translation task {{status}}',
  'Regenerating will replace {{count}} manually edited translations.',
  'Download current results',
] as const

function interpolationTokens(value: string): string[] {
  return [...value.matchAll(/{{\s*[\w.]+\s*}}/g)].map((match) => match[0])
}

describe('i18n language detection', () => {
  test('reads the shared website language cookie before console localStorage', () => {
    expect(LANGUAGE_PREFERENCE_COOKIE).toBe('fk_locale')
    expect(LANGUAGE_DETECTION_OPTIONS.lookupCookie).toBe(
      LANGUAGE_PREFERENCE_COOKIE
    )
    expect(LANGUAGE_DETECTION_OPTIONS.order).toEqual([
      'querystring',
      'cookie',
      'localStorage',
      'navigator',
    ])
    expect(LANGUAGE_DETECTION_OPTIONS.caches).toEqual(['localStorage'])
  })
})

describe('i18n operational Activity and Recall copy', () => {
  test('locks exact Vietnamese global Email translation', () => {
    expect(localeTranslations.vi.Email).toBe('Địa chỉ email')
  })

  test('locks exact Activity and Recall conversion amount translations', () => {
    for (const [locale, expected] of Object.entries(
      conversionAmountTranslations
    )) {
      expect(localeTranslations[locale]['Conversion amount']).toBe(expected)
    }
  })

  test('locks exact Russian queued message cancellation copy', () => {
    expect(
      localeTranslations.ru['{{count}} queued messages can be canceled']
    ).toBe('Можно отменить {{count}} сообщений в очереди')
    expect(
      localeTranslations.ru['{{count}} queued messages were canceled']
    ).toBe('Отменено {{count}} сообщений в очереди')
  })

  test('registers dynamic Activity and Recall copy in static keys', () => {
    for (const key of dynamicOperationalActivityCopyKeys) {
      expect(STATIC_I18N_KEYS).toContain(key)
    }
    expect(STATIC_I18N_KEYS).toContain('Conversion amount')
    expect(STATIC_I18N_KEYS).not.toContain('State')
    expect(STATIC_I18N_KEYS).not.toContain('Amount')
    expect(dynamicOperationalActivityCopyKeys).not.toContain('State')
    expect(dynamicOperationalActivityCopyKeys).not.toContain('Amount')
  })

  test('does not register literal Activity and Recall copy in static keys', () => {
    for (const key of literalOperationalActivityCopyKeys) {
      expect(STATIC_I18N_KEYS).not.toContain(key)
    }
  })

  test('does not keep retired Flatkey short-window copy', () => {
    for (const key of retiredFlatkeyShortWindowCopyKeys) {
      expect(STATIC_I18N_KEYS).not.toContain(key)

      for (const [locale, translations] of Object.entries(
        localeTranslations
      )) {
        expect(
          Object.prototype.hasOwnProperty.call(translations, key),
          `${locale} still contains ${key}`
        ).toBe(false)
      }
    }
  })

  for (const [locale, translations] of Object.entries(localeTranslations)) {
    test(`${locale} covers Activity and Recall operational copy`, () => {
      for (const key of operationalActivityCopyKeys) {
        expect(
          Object.prototype.hasOwnProperty.call(translations, key),
          `${locale} is missing ${key}`
        ).toBe(true)
        expect(
          translations[key],
          `${locale} has empty copy for ${key}`
        ).toBeTruthy()
        expect(
          interpolationTokens(translations[key]),
          `${locale} must preserve interpolation tokens for ${key}`
        ).toEqual(interpolationTokens(localeTranslations.en[key]))

        if (locale !== 'en') {
          expect(
            translations[key],
            `${locale} should not fall back to English for ${key}`
          ).not.toBe(localeTranslations.en[key])
        }
      }
    })
  }
})
