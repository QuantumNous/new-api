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

const batchStatusUpdate: AuditLog = {
  event_id: 'event-1',
  user_id: 1,
  username: 'root-user',
  actor_role: 100,
  created_at: 1_750_000_000,
  category: 'channel',
  action: 'channel.status_update_batch',
  token_ref: '',
  auth_method: 'session',
  ip: '127.0.0.1',
  user_agent: '',
  method: 'POST',
  route: '/api/channel/batch',
  status: 200,
  success: true,
  request_id: 'request-1',
  content: '',
  other: {
    op: {
      action: 'channel.status_update_batch',
      params: { count: 3, total: 1200 },
    },
  },
}

let t: TFunction

beforeAll(async () => {
  const i18n = createInstance()
  await i18n.init({ lng: 'en', resources: { en: { translation: {} } } })
  t = i18n.t
})

function changedTotal(locale: string) {
  const detail = buildAuditDetails(batchStatusUpdate, t, {
    locale: toIntlLocale(locale),
  })
  return detail.fields.find((field) => field.label === 'Changed / Total')?.value
}

test('in English, the batch status update keeps the changed and total counts as before', () => {
  expect(changedTotal('en')).toBe('3 / 1200')
})

test('in Persian, the batch status update writes the changed and total counts with Persian digits', () => {
  expect(changedTotal('fa')).toBe('۳ / ۱۲۰۰')
})
