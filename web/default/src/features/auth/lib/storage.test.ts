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
import { test } from 'node:test'

import { clearLegacyInvitationCodeStorage } from './storage.ts'

test('clears both historical invitation-code storage keys', () => {
  const values = new Map<string, string>([
    ['registration:invitation-code', 'CURRENT'],
    ['invitation_code', 'LEGACY'],
    ['aff', 'AFF'],
  ])
  const originalDescriptor = Object.getOwnPropertyDescriptor(
    globalThis,
    'window'
  )
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      localStorage: {
        removeItem: (key: string) => values.delete(key),
      },
    },
  })

  try {
    clearLegacyInvitationCodeStorage()
    assert.equal(values.has('registration:invitation-code'), false)
    assert.equal(values.has('invitation_code'), false)
    assert.equal(values.get('aff'), 'AFF')
  } finally {
    if (originalDescriptor) {
      Object.defineProperty(globalThis, 'window', originalDescriptor)
    } else {
      Reflect.deleteProperty(globalThis, 'window')
    }
  }
})
