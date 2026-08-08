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
import { describe, it } from 'node:test'

import { isActiveStatus, isPollingStatus } from '../system-task-status.ts'

describe('system task status classification', () => {
  it('keeps paused tasks active without reporting active polling', () => {
    assert.equal(isActiveStatus('paused'), true)
    assert.equal(isPollingStatus('paused'), false)
  })

  it('polls runnable states and excludes terminal states', () => {
    for (const status of ['pending', 'running', 'pause_requested'] as const) {
      assert.equal(isActiveStatus(status), true)
      assert.equal(isPollingStatus(status), true)
    }
    for (const status of ['succeeded', 'failed'] as const) {
      assert.equal(isActiveStatus(status), false)
      assert.equal(isPollingStatus(status), false)
    }
  })
})
