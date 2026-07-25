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
import { getNavBadgeClassName, getNavItemTitleClassName } from './nav-badge'

describe('getNavBadgeClassName', () => {
  test('renders promotion badges as plain right-aligned violet text', () => {
    const className = getNavBadgeClassName('promotion')
    const classTokens = className.split(' ')

    expect(className).toContain('bg-transparent')
    expect(className).toContain('border-transparent')
    expect(className).toContain('text-[#6d28d9]')
    expect(className).toContain('dark:text-[#a78bfa]')
    expect(className).toContain('truncate')
    expect(className).toContain('group-data-[collapsible=icon]:hidden')
    expect(classTokens).toContain('ml-auto')
    expect(classTokens).toContain('shrink-0')
  })

  test('keeps the navigation title flexible ahead of the text badge', () => {
    const classTokens = getNavItemTitleClassName('promotion').split(' ')

    expect(classTokens).toContain('flex-1')
    expect(classTokens).toContain('truncate')
  })
})
