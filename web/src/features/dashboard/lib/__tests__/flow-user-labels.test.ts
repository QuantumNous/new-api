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
import { describe, expect, test } from 'vitest'

import type { FlowQuotaDataItem } from '../../types'
import {
  buildDashboardFlowData,
  buildFlowFilterOptions,
} from '../flow'

function flowRow(
  overrides: Partial<FlowQuotaDataItem>
): FlowQuotaDataItem {
  return {
    use_group: 'vip',
    model_name: 'gpt-4.1',
    channel_id: 101,
    channel_name: 'east',
    quota: 100,
    token_used: 40,
    count: 1,
    ...overrides,
  }
}

function userLabels(rows: FlowQuotaDataItem[]): Array<[string, string]> {
  const result = buildDashboardFlowData(rows, 'quota', { role: 'admin' })
  return result.flow.nodes
    .filter((node) => node.kind === 'user')
    .map((node) => [node.id, node.label])
}

describe('dashboard flow user labels', () => {
  test('uses display name when present and falls back to username', () => {
    const rows = [
      flowRow({
        user_id: 1,
        username: 'alice',
        display_name: 'Alice Chen',
        quota: 150,
      }),
      flowRow({
        user_id: 2,
        username: 'bob',
        display_name: '  ',
        quota: 70,
      }),
    ]

    expect(userLabels(rows)).toEqual([
      ['user:1', 'Alice Chen'],
      ['user:2', 'bob'],
    ])
    expect(
      buildFlowFilterOptions(rows, 'quota').users.map((user) => [
        user.value,
        user.label,
      ])
    ).toEqual([
      ['user:1', 'Alice Chen'],
      ['user:2', 'bob'],
    ])
  })

  test('keeps users distinct when display names collide', () => {
    expect(
      userLabels([
        flowRow({
          user_id: 1,
          username: 'alice',
          display_name: 'Alex',
          quota: 80,
        }),
        flowRow({
          user_id: 2,
          username: 'alex2',
          display_name: 'Alex',
          quota: 40,
        }),
      ])
    ).toEqual([
      ['user:1', 'Alex (alice)'],
      ['user:2', 'Alex (alex2)'],
    ])
  })
})
