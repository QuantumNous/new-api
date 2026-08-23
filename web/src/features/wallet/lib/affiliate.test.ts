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

import { formatInviteRebatePercent, isInviteRebateEnabled } from './affiliate'

describe('invite rebate display helpers', () => {
  test('treats zero times or percent as disabled', () => {
    expect(isInviteRebateEnabled(3, 15)).toBe(true)
    expect(isInviteRebateEnabled(0, 15)).toBe(false)
    expect(isInviteRebateEnabled(3, 0)).toBe(false)
    expect(isInviteRebateEnabled(undefined, 15)).toBe(false)
  })

  test('formats integer and fractional percents without trailing zeros', () => {
    expect(formatInviteRebatePercent(15)).toBe('15')
    expect(formatInviteRebatePercent(15.5)).toBe('15.5')
    expect(formatInviteRebatePercent(15.25)).toBe('15.25')
  })
})
