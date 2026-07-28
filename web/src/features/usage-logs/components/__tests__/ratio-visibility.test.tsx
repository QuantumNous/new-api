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
import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import type { TFunction } from 'i18next'

import type { UsageLog } from '../../data/schema'
import type { LogOtherData } from '../../types'

const matchMedia = (query: string): MediaQueryList =>
  ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  }) as MediaQueryList

Object.defineProperty(globalThis, 'matchMedia', {
  configurable: true,
  value: matchMedia,
})
Object.defineProperty(globalThis, 'customElements', {
  configurable: true,
  value: {
    define: () => undefined,
    get: () => undefined,
  },
})
if (globalThis.document) {
  Object.defineProperty(globalThis.document, 'compatMode', {
    configurable: true,
    value: 'CSS1Compat',
  })
}

const { buildTypeDetailSegments } =
  await import('../columns/common-logs-columns')
const { buildBillingBreakdownRows } =
  await import('../../lib/billing-breakdown-rows')

const t = ((key: string) => key) as TFunction

const baseLog: UsageLog = {
  id: 1,
  user_id: 1,
  created_at: 0,
  type: 2,
  content: '',
  username: 'user',
  token_name: 'key',
  model_name: 'model',
  quota: 1000,
  prompt_tokens: 0,
  completion_tokens: 0,
  use_time: 0,
  is_stream: false,
  channel: 1,
  channel_name: '',
  token_id: 1,
  group: 'default',
  ip: '',
  other: '',
  request_id: '',
  upstream_request_id: '',
}

function billingOther(overrides: Partial<LogOtherData> = {}): LogOtherData {
  return {
    group_ratio: 2,
    ...overrides,
  }
}

describe('usage log ratio visibility', () => {
  test('普通用户使用日志列表不展示分组倍率片段', () => {
    const segments = buildTypeDetailSegments(baseLog, billingOther(), t, false)

    assert.equal(
      segments.some((segment) => segment.text.includes('Group Ratio')),
      false
    )
  })

  test('管理员使用日志列表展示分组倍率片段', () => {
    const segments = buildTypeDetailSegments(baseLog, billingOther(), t, true)

    assert.equal(
      segments.some((segment) => segment.text.includes('Group Ratio 2x')),
      true
    )
  })

  test('普通用户使用日志详情不展示分组倍率行', () => {
    const rows = buildBillingBreakdownRows({
      log: baseLog,
      other: billingOther({ model_ratio: 1 }),
      isAdmin: false,
      showRatio: false,
      t,
    })

    assert.equal(
      rows.some((row) => row.label === 'Group Ratio'),
      false
    )
  })

  test('管理员使用日志详情展示分组倍率行', () => {
    const rows = buildBillingBreakdownRows({
      log: baseLog,
      other: billingOther({ model_ratio: 1 }),
      isAdmin: true,
      showRatio: true,
      t,
    })

    assert.equal(
      rows.some(
        (row) => row.label === 'Group Ratio' && row.value === '2.0000x'
      ),
      true
    )
  })
})
