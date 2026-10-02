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
import { beforeAll, expect, test } from 'vitest'

import { toIntlLocale } from '@/i18n/languages'

import type { AuditLog } from '../api'
import { buildAuditDetails } from '../lib/audit-details'

// 2026-10-25 13:55:00 local time is 3 Aban 1405.
const EXPIRES_AT = Math.floor(new Date(2026, 9, 25, 13, 55).getTime() / 1000)

const generatedToken: AuditLog = {
  event_id: 'event-1',
  user_id: 1,
  username: 'root-user',
  actor_role: 100,
  created_at: 1_750_000_000,
  category: 'security',
  action: 'access_token.generate',
  token_ref: '',
  auth_method: 'session',
  ip: '127.0.0.1',
  user_agent: '',
  method: 'POST',
  route: '/api/user/access_tokens',
  status: 200,
  success: true,
  request_id: 'request-1',
  content: '',
  other: {
    op: {
      action: 'access_token.generate',
      params: { name: 'deploy', expires_at: EXPIRES_AT },
    },
  },
}

let t: TFunction

beforeAll(async () => {
  const i18n = createInstance()
  await i18n.init({ lng: 'en', resources: { en: { translation: {} } } })
  t = i18n.t
})

function expiration(locale: string) {
  const detail = buildAuditDetails(generatedToken, t, {
    locale: toIntlLocale(locale),
  })
  return detail.fields.find((field) => field.label === 'Expiration')?.value
}

test('in English, the access token expiry keeps the Gregorian date', () => {
  expect(expiration('en')).toBe('2026-10-25 13:55:00')
})

test('in Persian, the access token expiry is a Solar Hijri date', () => {
  expect(expiration('fa')).toBe('۱۴۰۵/۰۸/۰۳ ۱۳:۵۵:۰۰')
})
