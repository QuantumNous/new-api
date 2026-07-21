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

import { normalizeMutationError } from './api'

describe('system option mutation errors', () => {
  test('classifies HTTP 409 as a conflict without exposing server text', () => {
    const result = normalizeMutationError({
      response: {
        status: 409,
        data: { message: 'raw backend conflict message' },
      },
    })

    assert.deepEqual(result, { kind: 'conflict', status: 409 })
  })

  test('uses a concise client error message when it is safe to display', () => {
    const result = normalizeMutationError({
      response: {
        status: 400,
        data: { message: 'Invalid option value' },
      },
    })

    assert.deepEqual(result, {
      kind: 'message',
      status: 400,
      message: 'Invalid option value',
    })
  })

  test('classifies server failures as generic errors', () => {
    const result = normalizeMutationError({
      response: {
        status: 503,
        data: { message: 'database host and internal details' },
      },
    })

    assert.deepEqual(result, { kind: 'server', status: 503 })
  })
})
