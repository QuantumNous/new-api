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

import type { SystemStatus } from '../types'
import { isPublicRegistrationAvailable } from './registration.ts'

function asStatus(value: unknown): SystemStatus {
  return value as SystemStatus
}

describe('public registration availability', () => {
  test('requires a loaded status response', () => {
    assert.equal(isPublicRegistrationAvailable(null), false)
  })

  test('allows registration when enabled outside self-use mode', () => {
    assert.equal(
      isPublicRegistrationAvailable(
        asStatus({
          register_enabled: true,
          self_use_mode_enabled: false,
        })
      ),
      true
    )
  })

  test('hides registration when registration is disabled', () => {
    assert.equal(
      isPublicRegistrationAvailable(
        asStatus({
          register_enabled: false,
          self_use_mode_enabled: false,
        })
      ),
      false
    )
  })

  test('lets self-use mode override an enabled registration setting', () => {
    assert.equal(
      isPublicRegistrationAvailable(
        asStatus({
          register_enabled: true,
          self_use_mode_enabled: true,
        })
      ),
      false
    )
  })

  test('supports the legacy nested status response shape', () => {
    assert.equal(
      isPublicRegistrationAvailable(
        asStatus({
          data: {
            register_enabled: true,
            self_use_mode_enabled: false,
          },
        })
      ),
      true
    )
  })
})
