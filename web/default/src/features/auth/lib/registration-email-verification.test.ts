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
import { isRegistrationEmailVerified } from './registration-email-verification'

describe('registration email verification response normalization', () => {
  test('accepts only an explicit successful verified response', () => {
    expect(
      isRegistrationEmailVerified({
        success: true,
        message: '',
        data: { verified: true },
      })
    ).toBe(true)
  })

  test('rejects business failures and malformed payloads', () => {
    expect(
      isRegistrationEmailVerified({
        success: false,
        message: 'expired',
        data: { verified: true },
      })
    ).toBe(false)
    expect(
      isRegistrationEmailVerified({
        success: true,
        message: '',
        data: { verified: 'true' },
      })
    ).toBe(false)
    expect(isRegistrationEmailVerified(null)).toBe(false)
  })
})
