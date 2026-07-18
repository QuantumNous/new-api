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

import type { VerificationMethod, VerificationMethods } from '../types'
import { selectVerificationMethod } from './select-verification-method'

describe('selectVerificationMethod', () => {
  const cases: Array<{
    name: string
    methods: VerificationMethods
    preferred?: VerificationMethod
    expected: VerificationMethod | null
  }> = [
    {
      name: 'falls back to 2FA when the preferred Passkey is unavailable',
      methods: { has2FA: true, hasPasskey: false, passkeySupported: true },
      preferred: 'passkey',
      expected: '2fa',
    },
    {
      name: 'falls back to 2FA when a bound Passkey is unsupported by the device',
      methods: { has2FA: true, hasPasskey: true, passkeySupported: false },
      preferred: 'passkey',
      expected: '2fa',
    },
    {
      name: 'uses an available preferred 2FA method',
      methods: { has2FA: true, hasPasskey: true, passkeySupported: true },
      preferred: '2fa',
      expected: '2fa',
    },
    {
      name: 'uses an available preferred Passkey method',
      methods: { has2FA: true, hasPasskey: true, passkeySupported: true },
      preferred: 'passkey',
      expected: 'passkey',
    },
    {
      name: 'defaults to Passkey when no preference is provided',
      methods: { has2FA: true, hasPasskey: true, passkeySupported: true },
      expected: 'passkey',
    },
    {
      name: 'defaults to 2FA when it is the only available method',
      methods: { has2FA: true, hasPasskey: false, passkeySupported: true },
      expected: '2fa',
    },
    {
      name: 'falls back to Passkey when preferred 2FA is unavailable',
      methods: { has2FA: false, hasPasskey: true, passkeySupported: true },
      preferred: '2fa',
      expected: 'passkey',
    },
    {
      name: 'returns null when no usable method is available',
      methods: { has2FA: false, hasPasskey: true, passkeySupported: false },
      expected: null,
    },
  ]

  for (const testCase of cases) {
    test(testCase.name, () => {
      assert.equal(
        selectVerificationMethod(testCase.methods, testCase.preferred),
        testCase.expected
      )
    })
  }
})
