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

const operationalActivityCopyKeys = [
  'Attributed spend',
  'New external cash',
  'Direct top-up',
  'Balance-paid subscription',
  'Online-paid subscription',
  'SMTP accepted',
  'Users who opened',
  'Observed clicks',
  'Historical excluded identities were not recorded',
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
  'Confirming will exclude resolved users and cancel pending campaign work that is still cancelable.',
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
  'This message has an uncertain delivery result. Retrying can send a duplicate email and requires explicit acknowledgment.',
  'I acknowledge that retrying an uncertain message may send a duplicate email.',
  'Start date and time',
  'IANA timezone',
  'Absolute offset from the first SMTP accepted email.',
  'Activity SMTP delivery failed. Check the host, port, credentials, TLS mode, and sender authorization, then retry.',
  'Delivery status is uncertain. Check the mailbox provider before retrying.',
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
