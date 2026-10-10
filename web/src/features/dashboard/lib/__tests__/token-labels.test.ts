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
import { buildDashboardFlowData } from '../flow'

const row: FlowQuotaDataItem = {
  use_group: 'default',
  model_name: 'gpt-4.1',
  quota: 10,
  count: 1,
  token_used: 20,
}

describe('dashboard flow token labels', () => {
  test.each([0, undefined])(
    'shows No API Token in the graph and filter when token_id is %s',
    (tokenID) => {
      const result = buildDashboardFlowData([{ ...row, token_id: tokenID }])

      expect(
        result.flow.nodes.find((node) => node.kind === 'token')?.label
      ).toBe('No API Token')
      expect(
        result.filterOptions.nodes.find((node) => node.kind === 'token')?.label
      ).toBe('No API Token')
    }
  )

  test('updates the graph and filter labels when the caller changes language', () => {
    for (const label of ['No API Token', '无 API 令牌']) {
      const result = buildDashboardFlowData([row], 'quota', {
        noApiTokenLabel: label,
      })

      expect(
        result.flow.nodes.find((node) => node.kind === 'token')?.label
      ).toBe(label)
      expect(
        result.filterOptions.nodes.find((node) => node.kind === 'token')?.label
      ).toBe(label)
    }
  })

  test.each([0, 11])(
    'preserves a supplied token name when token_id is %s',
    (tokenID) => {
      const result = buildDashboardFlowData([
        { ...row, token_id: tokenID, token_name: 'named source' },
      ])

      expect(
        result.flow.nodes.find((node) => node.kind === 'token')?.label
      ).toBe('named source')
    }
  )

  test('keeps the localized deleted label for a positive token ID without a name', () => {
    const result = buildDashboardFlowData([{ ...row, token_id: 11 }], 'quota', {
      noApiTokenLabel: '无 API 令牌',
      deletedTokenLabel: (tokenID) => `已删除(${tokenID})`,
    })

    expect(result.flow.nodes.find((node) => node.kind === 'token')?.label).toBe(
      '已删除(11)'
    )
    expect(
      result.filterOptions.nodes.find((node) => node.kind === 'token')?.label
    ).toBe('已删除(11)')
  })

  test('keeps the token ID fallback for a deleted token without a localized label', () => {
    const result = buildDashboardFlowData([{ ...row, token_id: 11 }])

    expect(result.flow.nodes.find((node) => node.kind === 'token')?.label).toBe(
      'token-11'
    )
  })

  test('keeps Unknown Token for an invalid negative token ID', () => {
    const result = buildDashboardFlowData([{ ...row, token_id: -1 }])

    expect(result.flow.nodes.find((node) => node.kind === 'token')?.label).toBe(
      'Unknown Token'
    )
  })
})
