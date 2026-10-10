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
import { createInstance, type TFunction } from 'i18next'
import { beforeAll, describe, expect, it } from 'vitest'

import { toIntlLocale } from '@/i18n/languages'
import en from '@/i18n/locales/en.json'
import fa from '@/i18n/locales/fa.json'
import zh from '@/i18n/locales/zh.json'

import { userActionName } from '../user-actions'

async function createT(lng: string): Promise<TFunction> {
  const i18n = createInstance()
  await i18n.init({
    lng,
    fallbackLng: 'en',
    resources: { en, fa, zh },
    interpolation: { escapeValue: false },
  })
  return i18n.t
}

let enT: TFunction
let faT: TFunction
let zhT: TFunction

beforeAll(async () => {
  enT = await createT('en')
  faT = await createT('fa')
  zhT = await createT('zh')
})

describe('userActionName', () => {
  it('in Persian, names the action with its translated button label', () => {
    expect(userActionName('promote', faT, toIntlLocale('fa'))).toBe(
      'ارتقا به مدیر'
    )
    expect(userActionName('disable', faT, toIntlLocale('fa'))).toBe(
      'غیرفعال کردن'
    )
  })

  it('in English and Chinese, keeps the recorded action as upstream shows it', () => {
    expect(userActionName('promote', enT, toIntlLocale('en'))).toBe('promote')
    expect(userActionName('promote', zhT, toIntlLocale('zhCN'))).toBe('promote')
  })

  it('in Persian, keeps an unknown action as recorded', () => {
    expect(userActionName('add_quota', faT, toIntlLocale('fa'))).toBe(
      'add_quota'
    )
  })

  it('in Persian, the failure message reads with the translated action', () => {
    expect(
      faT('Failed to {{action}} user', {
        action: userActionName('enable', faT, toIntlLocale('fa')),
      })
    ).toBe('عملیات ⁨فعال کردن⁩ روی کاربر ناموفق بود')
  })
})
