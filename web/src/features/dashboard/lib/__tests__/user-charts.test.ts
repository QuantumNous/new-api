/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
    10|but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { describe, expect, test } from 'vitest'

import { processUserChartData } from '../charts'
import type { QuotaDataItem } from '../../types'

function rankUsers(data: QuotaDataItem[]): string[] {
  const values = processUserChartData(data, 'day', (key) => key, 10)
    .spec_user_rank.data[0].values as Array<{ User: string }>
  return values.map((item) => item.User)
}

describe('user consumption ranking labels', () => { // 添加显示名称
  test('uses display name when present and falls back to username', () => {
    const labels = rankUsers([
      {
        username: 'alice',
        display_name: 'Alice Chen',
        created_at: 1_700_000_000,
        quota: 100,
      },
      {
        username: 'bob',
        display_name: '  ',
        created_at: 1_700_000_000,
        quota: 50,
      },
    ])

    expect(labels).toEqual(['Alice Chen', 'bob'])
  })

  test('keeps users distinct when display names collide', () => {
    const labels = rankUsers([
      {
        username: 'alice',
        display_name: 'Alex',
        created_at: 1_700_000_000,
        quota: 80,
      },
      {
        username: 'alex2',
        display_name: 'Alex',
        created_at: 1_700_000_000,
        quota: 40,
      },
    ])

    expect(labels).toEqual(['Alex (alice)', 'Alex (alex2)'])
  })
})
