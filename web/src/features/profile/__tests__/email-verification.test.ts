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

import { buildEmailVerificationPath } from '../api'

describe('profile email verification request', () => {
  test('includes the Turnstile token when requesting an email bind code', () => {
    const path = buildEmailVerificationPath(
      'user+alias@example.com',
      'turnstile-token'
    )
    const url = new URL(path, 'https://example.test')

    assert.equal(url.pathname, '/api/verification')
    assert.equal(url.searchParams.get('email'), 'user+alias@example.com')
    assert.equal(url.searchParams.get('turnstile'), 'turnstile-token')
  })
})
