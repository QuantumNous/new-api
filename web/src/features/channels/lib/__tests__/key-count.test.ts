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

import { countUpdateKeys } from '../channel-form'

const VERTEX_TYPE = 41

describe('countUpdateKeys', () => {
  test('returns 0 for whitespace-only input', () => {
    expect(countUpdateKeys('   \n  \n')).toBe(0)
  })

  test('counts one key per non-empty line for newline-separated channels', () => {
    expect(countUpdateKeys('sk-a\n\n sk-b \nsk-c')).toBe(3)
  })

  test('counts a multi-line Vertex JSON service account as a single key', () => {
    const serviceAccount = JSON.stringify(
      { type: 'service_account', project_id: 'demo' },
      null,
      2
    )

    expect(
      countUpdateKeys(serviceAccount, {
        type: VERTEX_TYPE,
        vertexKeyType: 'json',
      })
    ).toBe(1)
  })

  test('counts each element of a Vertex JSON array as one key', () => {
    const serviceAccounts = JSON.stringify(
      [
        { type: 'service_account', project_id: 'a' },
        { type: 'service_account', project_id: 'b' },
      ],
      null,
      2
    )

    expect(
      countUpdateKeys(serviceAccounts, {
        type: VERTEX_TYPE,
        vertexKeyType: 'json',
      })
    ).toBe(2)
  })

  test('falls back to newline counting for Vertex API Key channels', () => {
    expect(
      countUpdateKeys('vertex-a\nvertex-b', {
        type: VERTEX_TYPE,
        vertexKeyType: 'api_key',
      })
    ).toBe(2)
  })

  test('falls back to newline counting when Vertex JSON input is malformed', () => {
    expect(
      countUpdateKeys('{"type": "service_account"\n{"type": "other"}', {
        type: VERTEX_TYPE,
        vertexKeyType: 'json',
      })
    ).toBe(2)
  })
})
