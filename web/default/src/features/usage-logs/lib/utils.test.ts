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
import { describe, expect, it } from 'vitest'
import { buildApiParams } from './utils'

describe('usage log identity params', () => {
  it('prefers an explicit user ID from user-list navigation', () => {
    const params = buildApiParams({
      page: 1,
      pageSize: 100,
      searchParams: { username: '700', userId: 701 },
      isAdmin: true,
    })

    expect(params.user_id).toBe(701)
    expect(params).not.toHaveProperty('username')
  })

  it('keeps a manually entered numeric username as a username', () => {
    const params = buildApiParams({
      page: 1,
      pageSize: 100,
      searchParams: { username: '700' },
      isAdmin: true,
    })

    expect(params.username).toBe('700')
    expect(params).not.toHaveProperty('user_id')
  })
})
