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

import { ROLE } from '@/lib/roles'

import { resolveLogsViewAccess } from '../components/usage-logs-provider'

describe('usage log access tier', () => {
  test('keeps users and elevated self views on the self tier', () => {
    expect(resolveLogsViewAccess(ROLE.USER, 'all')).toBe('self')
    expect(resolveLogsViewAccess(ROLE.ADMIN, 'self')).toBe('self')
    expect(resolveLogsViewAccess(ROLE.SUPER_ADMIN, 'self')).toBe('self')
  })

  test('distinguishes admin and root while viewing all logs', () => {
    expect(resolveLogsViewAccess(ROLE.ADMIN, 'all')).toBe('admin')
    expect(resolveLogsViewAccess(ROLE.SUPER_ADMIN, 'all')).toBe('root')
  })
})
