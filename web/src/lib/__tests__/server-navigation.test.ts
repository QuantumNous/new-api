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

import { navigateThroughServer } from '../server-navigation'

function createNavigationRecorder() {
  const calls: string[] = []
  return {
    calls,
    location: {
      assign(path: string | URL) {
        calls.push(`assign:${path}`)
      },
      replace(path: string | URL) {
        calls.push(`replace:${path}`)
      },
    },
  }
}

describe('server-owned route navigation', () => {
  test('replaces browser history for post-login redirects', () => {
    const recorder = createNavigationRecorder()

    navigateThroughServer('/studio/', 'replace', recorder.location)

    assert.deepEqual(recorder.calls, ['replace:/studio/'])
  })

  test('adds browser history when returning to the custom home page', () => {
    const recorder = createNavigationRecorder()

    navigateThroughServer('/', 'assign', recorder.location)

    assert.deepEqual(recorder.calls, ['assign:/'])
  })
})
