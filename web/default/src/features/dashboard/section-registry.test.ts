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
import {
  getDashboardSectionNavItems,
  isDashboardSectionAllowed,
} from './section-registry'

const t = ((key: string) => key) as TFunction

describe('dashboard section permissions', () => {
  test('hides Codex limits from non-admin navigation', () => {
    const items = getDashboardSectionNavItems(t, { isAdmin: false })
    assert.equal(
      items.some((item) => item.url === '/dashboard/codex-limits'),
      false
    )
  })

  test('allows direct Codex limits access only for admins', () => {
    assert.equal(isDashboardSectionAllowed('codex-limits', false), false)
    assert.equal(isDashboardSectionAllowed('codex-limits', true), true)
    assert.equal(isDashboardSectionAllowed('models', false), true)
  })
})
