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
import { describe, expect, test } from 'bun:test'
import { USER_ROLE, USER_STATUS } from '../constants'
import type { User } from '../types'
import {
  canDisableUser,
  disableUsersBatch,
  getBatchDisableUserTargets,
} from './bulk-user-actions'

function user(overrides: Partial<User>): User {
  return {
    id: 1,
    username: 'user',
    display_name: 'User',
    quota: 0,
    used_quota: 0,
    request_count: 0,
    group: 'default',
    status: USER_STATUS.ENABLED,
    role: USER_ROLE.USER,
    ...overrides,
  }
}

describe('bulk user actions', () => {
  test('uses one eligibility rule for disable actions', () => {
    expect(canDisableUser(user({ id: 1 }))).toBe(true)
    expect(canDisableUser(user({ id: 2, status: USER_STATUS.DISABLED }))).toBe(
      false
    )
    expect(canDisableUser(user({ id: 3, role: USER_ROLE.ROOT }))).toBe(false)
    expect(
      canDisableUser(user({ id: 4, DeletedAt: '2026-06-28T00:00:00Z' }))
    ).toBe(false)
  })

  test('keeps only enabled non-root users that are not deleted', () => {
    const targets = getBatchDisableUserTargets([
      user({ id: 1 }),
      user({ id: 2, status: USER_STATUS.DISABLED }),
      user({ id: 3, role: USER_ROLE.ROOT }),
      user({ id: 4, DeletedAt: '2026-06-28T00:00:00Z' }),
      user({ id: 5, role: USER_ROLE.ADMIN }),
    ])

    expect(targets.map((target) => target.id)).toEqual([1, 5])
  })

  test('summarizes successful, business-failed, and rejected disable requests', async () => {
    const result = await disableUsersBatch(
      [user({ id: 1 }), user({ id: 2 }), user({ id: 3 })],
      async (target) => {
        if (target.id === 1) return { success: true }
        if (target.id === 2) return { success: false }
        throw new Error('network failed')
      }
    )

    expect(result).toEqual({
      successCount: 1,
      failedCount: 2,
    })
  })
})
