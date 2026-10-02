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

const userManage: AuditLog = {
  event_id: 'event-2',
  user_id: 1,
  username: 'root-user',
  actor_role: 100,
  created_at: 1_750_000_000,
  category: 'management',
  action: 'user.manage',
  token_ref: '',
  auth_method: 'session',
  ip: '127.0.0.1',
  user_agent: '',
  method: 'POST',
  route: '/api/user/manage',
  status: 200,
  success: true,
  request_id: 'request-2',
  content: '',
  other: {
    op: {
      action: 'user.manage',
      params: { action: 'promote', username: 'alice', id: 7 },
    },
  },
}

let enT: TFunction
let faT: TFunction
let zhT: TFunction

beforeAll(async () => {
  enT = await createT('en')
  faT = await createT('fa')
  zhT = await createT('zh')
})

describe('audit identity and action in Persian', () => {
  test('the actor and target show the Persian ID label with the name isolated', () => {
    const detail = buildAuditDetails(userManage, faT, {
      locale: toIntlLocale('fa'),
    })

    expect(detail.actor).toBe(`${FSI}root-user${PDI} (شناسه: 1)`)
    expect(detail.target).toBe(`${FSI}alice${PDI} (شناسه: 7)`)
  })

  test('an actor without a name shows the Persian ID label', () => {
    const anonymous = { ...userManage, username: '' }
    const detail = buildAuditDetails(anonymous, faT, {
      locale: toIntlLocale('fa'),
    })

    expect(detail.actor).toBe('شناسه: 1')
  })

  test('the summary names the action with its Persian label', () => {
    const detail = buildAuditDetails(userManage, faT, {
      locale: toIntlLocale('fa'),
    })

    expect(detail.summary).toContain(`${FSI}ارتقا به مدیر${PDI}`)
    expect(detail.summary).not.toContain('promote')
  })
})

describe('audit action field in Persian', () => {
  test('the action field shows the Persian action label', () => {
    const detail = buildAuditDetails(userManage, faT, {
      locale: toIntlLocale('fa'),
    })

    expect(detail.fields).toContainEqual(
      expect.objectContaining({ value: 'ارتقا به مدیر' })
    )
  })
})

// Other languages show what upstream shows.
describe('audit identity and action in other languages matches upstream', () => {
  test('in English, keeps the ID label and the recorded action', () => {
    const detail = buildAuditDetails(userManage, enT, {
      locale: toIntlLocale('en'),
    })

    expect(detail.actor).toBe('root-user (ID: 1)')
    expect(detail.target).toBe('alice (ID: 7)')
    expect(detail.summary).toBe('Performed promote on user alice (ID: 7)')
    expect(detail.fields).toContainEqual(
      expect.objectContaining({ value: 'promote' })
    )
  })

  test('in Chinese, keeps the ID label and the recorded action', () => {
    const detail = buildAuditDetails(userManage, zhT, {
      locale: toIntlLocale('zhCN'),
    })

    expect(detail.actor).toBe('root-user (ID: 1)')
    expect(detail.target).toBe('alice (ID: 7)')
    expect(detail.summary).toContain('promote')
  })
})
