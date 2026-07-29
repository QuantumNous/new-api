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
import { ROLE } from '@/lib/roles'
import type { NavGroup } from '@/components/layout/types'
import { filterToolsGroupByRole } from './use-sidebar-view'

const navGroups: NavGroup[] = [
  { id: 'general', title: 'General', items: [] },
  { id: 'tools', title: 'Tools', items: [] },
  { id: 'admin', title: 'Admin', items: [] },
]

describe('filterToolsGroupByRole', () => {
  test.each([
    [ROLE.USER, ['general', 'admin']],
    [ROLE.ADMIN, ['general', 'tools', 'admin']],
    [ROLE.SUPER_ADMIN, ['general', 'tools', 'admin']],
    [undefined, ['general', 'admin']],
  ] as const)(
    'filters only the tools group for role %p',
    (role, expectedGroupIds) => {
      expect(
        filterToolsGroupByRole(navGroups, role).map((group) => group.id)
      ).toEqual(expectedGroupIds)
    }
  )
})
