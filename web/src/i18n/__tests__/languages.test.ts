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
import i18next from 'i18next'
import { describe, expect, it } from 'vitest'

import {
  convertDetectedLanguage,
  getInterfaceLanguageDirection,
  normalizeInterfaceLanguage,
  toIntlLocale,
} from '@/i18n/languages'
import en from '@/i18n/locales/en.json'
import fa from '@/i18n/locales/fa.json'

describe('toIntlLocale', () => {
  it.each([
    ['zhCN', 'zh-CN'],
    ['zhTW', 'zh-TW'],
    ['en', 'en'],
    ['fr', 'fr'],
    ['ru', 'ru'],
    ['ja', 'ja'],
    ['vi', 'vi'],
    ['fa', 'fa'],
  ])('maps interface language %s to Intl locale %s', (language, locale) => {
    expect(toIntlLocale(language)).toBe(locale)
    expect(() => new Intl.NumberFormat(toIntlLocale(language))).not.toThrow()
  })

  it('returns undefined for an invalid language tag', () => {
    expect(toIntlLocale('not a locale!')).toBeUndefined()
  })

  it('formats Persian numbers with Persian digits by default', () => {
    expect(new Intl.NumberFormat(toIntlLocale('fa')).format(1234)).toBe('۱٬۲۳۴')
  })
})

describe('Persian language detection', () => {
  it.each(['fa', 'fa-IR', 'fa_IR', 'FA-ir'])(
    'maps detected browser language %s to fa',
    (detected) => {
      expect(convertDetectedLanguage(detected)).toBe('fa')
    }
  )

  it('keeps other detected languages unchanged', () => {
    expect(convertDetectedLanguage('fr-FR')).toBe('fr-FR')
  })

  it('normalizes a regional Persian tag to fa', () => {
    expect(normalizeInterfaceLanguage('fa-IR')).toBe('fa')
  })
})

describe('getInterfaceLanguageDirection', () => {
  it('returns rtl for Persian', () => {
    expect(getInterfaceLanguageDirection('fa')).toBe('rtl')
  })

  it.each(['en', 'zhCN', 'zhTW', 'fr', 'ru', 'ja', 'vi', 'unknown', null])(
    'returns ltr for %s',
    (language) => {
      expect(getInterfaceLanguageDirection(language)).toBe('ltr')
    }
  )
})

describe('partial Persian locale', () => {
  it('falls back to English per key for keys missing from fa.json', async () => {
    const instance = i18next.createInstance()
    await instance.init({
      lng: 'fa',
      fallbackLng: 'en',
      nsSeparator: false,
      resources: { en, fa },
    })
    const faKeys = new Set(Object.keys(fa.translation))
    const missingKey = Object.keys(en.translation).find(
      (key) => !faKeys.has(key) && !key.includes('{{')
    )

    expect(missingKey).toBeDefined()
    expect(instance.t(missingKey as string)).toBe(
      en.translation[missingKey as keyof typeof en.translation]
    )
    expect(instance.t('Sign in')).toBe(fa.translation['Sign in'])
  })
})
