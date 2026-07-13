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

import { selectVerificationMethod } from './select-verification-method'

describe('selectVerificationMethod', () => {
  test('falls back to 2FA when the preferred Passkey is unavailable', () => {
    assert.equal(
      selectVerificationMethod(
        { has2FA: true, hasPasskey: false, passkeySupported: true },
        'passkey'
      ),
      '2fa'
    )
  })

  test('falls back to 2FA when a bound Passkey is unsupported by the device', () => {
    assert.equal(
      selectVerificationMethod(
        { has2FA: true, hasPasskey: true, passkeySupported: false },
        'passkey'
      ),
      '2fa'
    )
  })

  test('uses an available preferred method', () => {
    assert.equal(
      selectVerificationMethod(
        { has2FA: true, hasPasskey: true, passkeySupported: true },
        '2fa'
      ),
      '2fa'
    )
    assert.equal(
      selectVerificationMethod(
        { has2FA: true, hasPasskey: true, passkeySupported: true },
        'passkey'
      ),
      'passkey'
    )
  })

  test('returns null when no usable method is available', () => {
    assert.equal(
      selectVerificationMethod({
        has2FA: false,
        hasPasskey: true,
        passkeySupported: false,
      }),
      null
    )
  })
})
