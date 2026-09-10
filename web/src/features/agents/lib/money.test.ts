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

import { deriveAgentCodeStatus, formatAgentPoints } from './money'

describe('agent point presentation', () => {
  test('formats point strings without losing cents', () => {
    expect(formatAgentPoints('1000.00')).toBe('1,000.00')
    expect(formatAgentPoints('0.01')).toBe('0.01')
    expect(formatAgentPoints('-1234567.89')).toBe('-1,234,567.89')
    expect(formatAgentPoints('92233720368547758.07')).toBe(
      '92,233,720,368,547,758.07'
    )
  })

  test('rejects values outside the fixed-decimal API contract', () => {
    expect(() => formatAgentPoints('1')).toThrow()
    expect(() => formatAgentPoints('1.001')).toThrow()
    expect(() => formatAgentPoints('not-money')).toThrow()
  })
})

describe('agent code status', () => {
  test('expires unused codes when expired_at is equal to the current time', () => {
    expect(deriveAgentCodeStatus('unused', 100, 99)).toBe('unused')
    expect(deriveAgentCodeStatus('unused', 100, 100)).toBe('expired')
    expect(deriveAgentCodeStatus('unused', 100, 101)).toBe('expired')
    expect(deriveAgentCodeStatus('unused', 0, 10_000)).toBe('unused')
  })

  test('does not replace terminal code states with expired', () => {
    expect(deriveAgentCodeStatus('used', 100, 100)).toBe('used')
    expect(deriveAgentCodeStatus('refunded', 100, 100)).toBe('refunded')
    expect(deriveAgentCodeStatus('expired', 100, 100)).toBe('expired')
  })
})
