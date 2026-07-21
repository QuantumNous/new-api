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

import type { UpdateOptionRequest } from '../types'
import { applyOptionUpdates } from './apply-option-updates'

describe('system option update batches', () => {
  test('submits all related updates as one atomic batch', async () => {
    const submitted: UpdateOptionRequest[][] = []
    const updates: UpdateOptionRequest[] = [
      { key: 'ModelPrice', value: '{}' },
      { key: 'ImageResolutionPrice', value: '{"image-model":{"1K":0.1}}' },
      { key: 'ModelRatio', value: '{}' },
    ]

    const success = await applyOptionUpdates(updates, async (batch) => {
      submitted.push(batch)
      return { success: false, message: '' }
    })

    assert.equal(success, false)
    assert.deepEqual(submitted, [updates])
  })

  test('reports success only after every update succeeds', async () => {
    const success = await applyOptionUpdates(
      [
        { key: 'ModelPrice', value: '{}' },
        { key: 'ImageResolutionPrice', value: '{}' },
      ],
      async () => ({ success: true, message: '' })
    )

    assert.equal(success, true)
  })

  test('does not send an empty batch', async () => {
    let called = false
    const success = await applyOptionUpdates([], async () => {
      called = true
      return { success: true, message: '' }
    })

    assert.equal(success, true)
    assert.equal(called, false)
  })
})
