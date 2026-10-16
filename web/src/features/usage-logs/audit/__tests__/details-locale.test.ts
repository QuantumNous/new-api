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
import { beforeAll, describe, expect, test } from 'vitest'

import { toIntlLocale } from '@/i18n/languages'
import en from '@/i18n/locales/en.json'
import fa from '@/i18n/locales/fa.json'
import zh from '@/i18n/locales/zh.json'

import type { AuditLog } from '../api'
import { buildAuditDetails } from '../lib/audit-details'

const FSI = '⁨'
const PDI = '⁩'

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

const userCreate: AuditLog = {
  event_id: 'event-1',
  user_id: 1,
  username: 'root-user',
  actor_role: 100,
  created_at: 1_750_000_000,
  category: 'management',
  action: 'user.create',
  token_ref: '',
  auth_method: 'session',
  ip: '127.0.0.1',
  user_agent: '',
  method: 'POST',
  route: '/api/user/',
  status: 200,
  success: true,
  request_id: 'request-1',
  content: '',
  other: {
    op: { action: 'user.create', params: { username: 'alice', role: 10 } },
  },
}

const passwordLogin: AuditLog = {
  ...userCreate,
  category: 'login',
  action: 'login',
  route: '/api/user/login',
  actor_role: 1,
  other: { op: { action: 'login', params: { method: 'password' } } },
}

let enT: TFunction
let faT: TFunction
let zhT: TFunction

beforeAll(async () => {
  enT = await createT('en')
  faT = await createT('fa')
  zhT = await createT('zh')
})

describe('buildAuditDetails in Persian', () => {
  test('the actor role and the role field show Persian role labels', () => {
    const detail = buildAuditDetails(userCreate, faT, {
      locale: toIntlLocale('fa'),
    })

    expect(detail.actorRole).toBe('مدیر ارشد')
    expect(detail.summary).toBe(
      `کاربر ${FSI}alice${PDI} ساخته شد (نقش ${FSI}مدیر${PDI})`
    )
    expect(detail.fields).toContainEqual({ label: 'نقش', value: 'مدیر' })
  })

  test('a login shows the Persian sign-in method label', () => {
    const detail = buildAuditDetails(passwordLogin, faT, {
      locale: toIntlLocale('fa'),
    })

    expect(detail.actorRole).toBe('کاربر')
    expect(detail.summary).toBe('ورود موفق با رمز عبور')
  })
})

// The expected values are what upstream shows: the raw role names root,
// admin and user, and the sign-in method label it already translated.
describe('buildAuditDetails in other languages matches upstream', () => {
  test('in English, roles keep the raw role names', () => {
    const detail = buildAuditDetails(userCreate, enT, {
      locale: toIntlLocale('en'),
    })

    expect(detail.actorRole).toBe('root')
    expect(detail.summary).toBe('Created user alice (role admin)')
    expect(detail.fields).toContainEqual({ label: 'Role', value: 'admin' })
  })

  test('in Chinese, roles keep the raw role names', () => {
    const detail = buildAuditDetails(userCreate, zhT, {
      locale: toIntlLocale('zhCN'),
    })

    expect(detail.actorRole).toBe('root')
    expect(detail.summary).toBe('创建用户 alice（角色 admin）')
    expect(detail.fields).toContainEqual({ label: '角色', value: 'admin' })
  })

  test('in English and Chinese, a login shows the sign-in method label', () => {
    expect(
      buildAuditDetails(passwordLogin, enT, { locale: toIntlLocale('en') })
        .summary
    ).toBe('Logged in successfully via Password')
    expect(
      buildAuditDetails(passwordLogin, zhT, { locale: toIntlLocale('zhCN') })
        .summary
    ).toBe('登录成功（通过 密码）')
  })
})
