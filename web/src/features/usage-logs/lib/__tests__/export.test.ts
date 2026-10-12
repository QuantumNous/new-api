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
import { createInstance } from 'i18next'
import { describe, expect, test } from 'vitest'

import type { UsageLog } from '../../data/schema'
import { getLogCsvHeader, getLogCsvRow, toCsvLine } from '../export'

const consumeLog: UsageLog = {
  id: 1,
  user_id: 7,
  created_at: new Date(2026, 9, 12, 8, 30, 5).getTime() / 1000,
  type: 2,
  content: '',
  username: 'alice',
  token_name: 'prod',
  model_name: 'gpt-4o-mini',
  quota: 250000,
  prompt_tokens: 2008,
  completion_tokens: 16,
  use_time: 3,
  is_stream: true,
  channel: 162,
  channel_name: 'azure',
  token_id: 5,
  group: 'default',
  ip: '203.0.113.9',
  other: JSON.stringify({
    cache_tokens: 1906,
    cache_creation_tokens_5m: 10,
    cache_creation_tokens_1h: 5,
  }),
  request_id: 'req-1',
  upstream_request_id: '',
}

async function chineseTranslator() {
  const i18n = createInstance()
  await i18n.init({
    lng: 'zh',
    resources: {
      zh: {
        translation: {
          Time: '时间',
          User: '用户',
          Channel: '渠道',
          Consume: '消费',
          'Top-up': '充值',
          Yes: '是',
          'Recharged {{amount}}': '充值 {{amount}}',
        },
      },
    },
  })
  return i18n.t
}

describe('usage log CSV export', () => {
  test('header in the user view has no user or channel column', async () => {
    const t = await chineseTranslator()

    const header = getLogCsvHeader(false, t)

    expect(header[0]).toBe('时间')
    expect(header).not.toContain('用户')
    expect(header).not.toContain('渠道')
  })

  test('administrator row shows the user and channel next to the matching header', async () => {
    const t = await chineseTranslator()

    const header = getLogCsvHeader(true, t)
    const row = getLogCsvRow(consumeLog, true, t)

    expect(row).toHaveLength(header.length)
    expect(row[header.indexOf('用户')]).toBe('alice')
    expect(row[header.indexOf('渠道')]).toBe('#162 azure')
  })

  test('consume log row matches the log table values', async () => {
    const t = await chineseTranslator()

    expect(getLogCsvRow(consumeLog, false, t)).toEqual([
      '2026-10-12 08:30:05',
      '消费',
      'prod',
      'default',
      'gpt-4o-mini',
      '是',
      '2008',
      '16',
      '1906',
      '15',
      '$0.5',
      '3s',
      '203.0.113.9',
      'req-1',
      '',
    ])
  })

  test('top-up log row leaves usage cells empty and shows the translated content', async () => {
    const t = await chineseTranslator()
    const topup: UsageLog = {
      ...consumeLog,
      type: 1,
      content: 'Recharged $5',
      other: JSON.stringify({
        content_parts: [
          { key: 'Recharged {{amount}}', params: { amount: '$5' } },
        ],
      }),
    }

    const row = getLogCsvRow(topup, false, t)

    expect(row.slice(1, 2)).toEqual(['充值'])
    expect(row.slice(5, 12)).toEqual(['', '', '', '', '', '', ''])
    expect(row.at(-1)).toBe('充值 $5')
  })

  test('cells are quoted and text that starts a formula stays text', () => {
    expect(
      toCsvLine(['=HYPERLINK("x")', '-12.5', '+cmd', 'a"b', 'two\nlines'])
    ).toBe(`"'=HYPERLINK(""x"")","-12.5","'+cmd","a""b","two\nlines"\r\n`)
  })
})
