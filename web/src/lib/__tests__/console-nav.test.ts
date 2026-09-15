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

import { isConsoleNavActive } from '../console-nav'

describe('isConsoleNavActive', () => {
  it('matches product pages without treating sibling dashboard sections as active', () => {
    expect(
      isConsoleNavActive('/dashboard/overview', '/dashboard/overview')
    ).toBe(true)
    expect(
      isConsoleNavActive('/dashboard/reports', '/dashboard/overview')
    ).toBe(false)
    expect(isConsoleNavActive('/dashboard/reports', '/dashboard/reports')).toBe(
      true
    )
    expect(isConsoleNavActive('/pricing/gpt-4o', '/pricing')).toBe(true)
    expect(isConsoleNavActive('/wallet', '/wallet')).toBe(true)
    expect(isConsoleNavActive('/wallet', '/wallet#redeem')).toBe(true)
    expect(isConsoleNavActive('/keys', '/wallet')).toBe(false)
  })
})
