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
import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import { deriveAgentCodeStatus, formatAgentPoints } from './money'

describe('agent point presentation', () => {
  test('formats point strings without losing cents', () => {
    assert.equal(formatAgentPoints('1000.00'), '1,000.00')
    assert.equal(formatAgentPoints('0.01'), '0.01')
    assert.equal(formatAgentPoints('-1234567.89'), '-1,234,567.89')
    assert.equal(
      formatAgentPoints('92233720368547758.07'),
      '92,233,720,368,547,758.07'
    )
  })

  test('rejects values outside the fixed-decimal API contract', () => {
    assert.throws(() => formatAgentPoints('1'))
    assert.throws(() => formatAgentPoints('1.001'))
    assert.throws(() => formatAgentPoints('not-money'))
  })
})

describe('agent code status', () => {
  test('expires unused codes when expired_at is equal to the current time', () => {
    assert.equal(deriveAgentCodeStatus('unused', 100, 99), 'unused')
    assert.equal(deriveAgentCodeStatus('unused', 100, 100), 'expired')
    assert.equal(deriveAgentCodeStatus('unused', 100, 101), 'expired')
    assert.equal(deriveAgentCodeStatus('unused', 0, 10_000), 'unused')
  })

  test('does not replace terminal code states with expired', () => {
    assert.equal(deriveAgentCodeStatus('used', 100, 100), 'used')
    assert.equal(deriveAgentCodeStatus('refunded', 100, 100), 'refunded')
    assert.equal(deriveAgentCodeStatus('expired', 100, 100), 'expired')
  })
})
