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

import type { AuthUser } from '@/stores/auth-store'

import { canAccessChannels } from '../admin-permissions'

function userWith(role: number, channelRead?: boolean): AuthUser {
  return {
    id: 1,
    username: 'alice',
    role,
    permissions:
      channelRead === undefined
        ? undefined
        : { admin_permissions: { channel: { read: channelRead } } },
  }
}

describe('canAccessChannels', () => {
  it('allows the super administrator', () => {
    expect(canAccessChannels(userWith(100))).toBe(true)
  })

  it('allows an administrator even when channel read is revoked', () => {
    expect(canAccessChannels(userWith(10, false))).toBe(true)
  })

  it('allows a channel supplier who holds channel read', () => {
    expect(canAccessChannels(userWith(5, true))).toBe(true)
  })

  it('denies a channel supplier without channel read', () => {
    expect(canAccessChannels(userWith(5))).toBe(false)
  })

  it('denies a common user', () => {
    expect(canAccessChannels(userWith(1))).toBe(false)
  })

  it('denies a visitor who is not signed in', () => {
    expect(canAccessChannels(null)).toBe(false)
  })
})
