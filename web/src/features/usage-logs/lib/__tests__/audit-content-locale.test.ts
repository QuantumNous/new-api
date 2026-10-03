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
import { createInstance, type i18n as I18n } from 'i18next'
import { afterEach, beforeAll, describe, expect, test, vi } from 'vitest'

import { toIntlLocale } from '@/i18n/languages'
import en from '@/i18n/locales/en.json'
import fa from '@/i18n/locales/fa.json'
import zh from '@/i18n/locales/zh.json'

import type { LogOtherData } from '../../types'
import { renderAuditContent } from '../format'

const FSI = '⁨'
const PDI = '⁩'

async function createI18n(lng: string): Promise<I18n> {
  const i18n = createInstance()
  await i18n.init({
    lng,
    fallbackLng: 'en',
    resources: { en, fa, zh },
    interpolation: { escapeValue: false },
  })
  return i18n
}

const userCreate: LogOtherData = {
  op: { action: 'user.create', params: { username: 'alice', role: 100 } },
}
const passwordLogin: LogOtherData = {
  op: { action: 'login', params: { method: 'password' } },
}
const githubLogin: LogOtherData = {
  op: { action: 'login', params: { method: 'oauth:github' } },
}
// quota 500000 is $1 with the default currency settings.
const quotaAdd: LogOtherData = {
  op: {
    action: 'user.quota_add',
    params: {
      target_username: 'alice',
      target_user_id: 2,
      quota: 500000,
      from: 0,
      to: 500000,
    },
  },
}

let enI18n: I18n
let faI18n: I18n
let zhI18n: I18n

beforeAll(async () => {
  enI18n = await createI18n('en')
  faI18n = await createI18n('fa')
  zhI18n = await createI18n('zh')
})

afterEach(() => {
  vi.restoreAllMocks()
})

// Outside Persian, amounts use the runtime default locale (as upstream), so
// tests that pin those amounts set the default here instead of relying on the
// machine's locale.
function mockBrowserNumberLocale(defaultLocale: string): void {
  const NumberFormat = Intl.NumberFormat
  vi.spyOn(Intl, 'NumberFormat').mockImplementation(function (
    locales?: Intl.LocalesArgument,
    options?: Intl.NumberFormatOptions
  ) {
    return new NumberFormat(locales ?? defaultLocale, options)
  } as typeof Intl.NumberFormat)
}

describe('renderAuditContent in Persian', () => {
  test('a created user shows the Persian role label', () => {
    expect(renderAuditContent(userCreate, faI18n.t, toIntlLocale('fa'))).toBe(
      `کاربر ${FSI}alice${PDI} ساخته شد (نقش ${FSI}مدیر ارشد${PDI})`
    )
  })

  test('a login shows the Persian sign-in method label', () => {
    expect(
      renderAuditContent(passwordLogin, faI18n.t, toIntlLocale('fa'))
    ).toBe('ورود موفق با رمز عبور')
  })

  test('an unknown role number stays as recorded', () => {
    const other: LogOtherData = {
      op: { action: 'user.create', params: { username: 'alice', role: 7 } },
    }
    expect(renderAuditContent(other, faI18n.t, toIntlLocale('fa'))).toBe(
      `کاربر ${FSI}alice${PDI} ساخته شد (نقش ${FSI}7${PDI})`
    )
  })

  test('the generic descriptor keeps the recorded HTTP method', () => {
    const other: LogOtherData = {
      op: { action: 'generic', params: { method: 'POST', route: '/api/x' } },
    }
    expect(renderAuditContent(other, faI18n.t, toIntlLocale('fa'))).toBe(
      'POST /api/x'
    )
  })
})

// The expected strings are what upstream renders for the same records: the
// raw role number and sign-in method, and amounts in the runtime default
// locale.
describe('renderAuditContent in other languages matches upstream', () => {
  test('in English, roles and sign-in methods stay as recorded', () => {
    const locale = toIntlLocale('en')

    expect(renderAuditContent(userCreate, enI18n.t, locale)).toBe(
      'Created user alice (role 100)'
    )
    expect(renderAuditContent(passwordLogin, enI18n.t, locale)).toBe(
      'Logged in successfully via password'
    )
    expect(renderAuditContent(githubLogin, enI18n.t, locale)).toBe(
      'Logged in successfully via oauth:github'
    )
  })

  test('in Chinese, roles and sign-in methods stay as recorded', () => {
    const locale = toIntlLocale('zhCN')

    expect(renderAuditContent(userCreate, zhI18n.t, locale)).toBe(
      '创建用户 alice（角色 100）'
    )
    expect(renderAuditContent(passwordLogin, zhI18n.t, locale)).toBe(
      '登录成功（通过 password）'
    )
  })

  test('with an English browser default, English and Chinese quota amounts render as upstream', () => {
    mockBrowserNumberLocale('en-US')

    expect(renderAuditContent(quotaAdd, enI18n.t, toIntlLocale('en'))).toBe(
      'Increase quota for user “alice” (ID: 2) · Requested quota: $1 · $0 → $1'
    )
    expect(renderAuditContent(quotaAdd, zhI18n.t, toIntlLocale('zhCN'))).toBe(
      '增加用户「alice」的额度（ID: 2） · 请求数额：$1 · $0 → $1'
    )
  })

  test('with a German browser default, English amounts keep the browser format', () => {
    mockBrowserNumberLocale('de-DE')

    expect(renderAuditContent(quotaAdd, enI18n.t, toIntlLocale('en'))).toBe(
      'Increase quota for user “alice” (ID: 2) · Requested quota: 1\u00a0$ · 0\u00a0$ → 1\u00a0$'
    )
  })
})
