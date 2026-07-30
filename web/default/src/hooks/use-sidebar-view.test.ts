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
  {
    id: 'tools',
    title: 'Tools',
    items: [
      { title: 'Get Started', url: '/quickstart' },
      { title: 'Tool Marketplace', url: '/api-marketplace' },
    ],
  },
  { id: 'admin', title: 'Admin', items: [] },
]

describe('filterToolsGroupByRole', () => {
  test('keeps only Tool Marketplace in the regular user tools group', () => {
    const filteredGroups = filterToolsGroupByRole(navGroups, ROLE.USER)
    const toolsGroup = filteredGroups.find((group) => group.id === 'tools')

    expect(filteredGroups.map((group) => group.id)).toEqual([
      'general',
      'tools',
      'admin',
    ])
    expect(toolsGroup?.items).toMatchObject([
      { title: 'Tool Marketplace', url: '/api-marketplace' },
    ])
  })

  test.each([ROLE.ADMIN, ROLE.SUPER_ADMIN])(
    'keeps every tools item for privileged role %p',
    (role) => {
      const toolsGroup = filterToolsGroupByRole(navGroups, role).find(
        (group) => group.id === 'tools'
      )

      expect(toolsGroup?.items).toMatchObject([
        { title: 'Get Started', url: '/quickstart' },
        { title: 'Tool Marketplace', url: '/api-marketplace' },
      ])
    }
  )

  test('keeps the tools group hidden while the role is unavailable', () => {
    expect(
      filterToolsGroupByRole(navGroups, undefined).map((group) => group.id)
    ).toEqual(['general', 'admin'])
  })
})
