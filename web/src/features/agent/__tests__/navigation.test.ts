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

import { buildAgentNavigation } from '../navigation'

const translate = ((key: string) => key) as TFunction

describe('agent sidebar navigation', () => {
  test('shows exactly one native destination for eligible states', () => {
    assert.deepEqual(
      buildAgentNavigation('agent', translate).map((item) => ({
        title: item.title,
        url: 'url' in item ? item.url : undefined,
        reloadDocument: item.reloadDocument,
      })),
      [{ title: 'Agent Center', url: '/agent/', reloadDocument: true }]
    )
    assert.deepEqual(
      buildAgentNavigation('candidate', translate).map((item) => ({
        title: item.title,
        url: 'url' in item ? item.url : undefined,
        reloadDocument: item.reloadDocument,
      })),
      [
        {
          title: 'Apply for Agent',
          url: '/agent/apply',
          reloadDocument: true,
        },
      ]
    )
  })

  test('hides agent navigation for normal, disabled, loading, and error states', () => {
    for (const state of [
      'none',
      'disabled',
      'loading',
      'transient-error',
    ] as const) {
      assert.deepEqual(buildAgentNavigation(state, translate), [])
    }
  })
})
