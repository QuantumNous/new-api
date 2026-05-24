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
import test from 'node:test'
import { buildModelStatusView } from '../../../model-status/lib/status-view.ts'
import type { ModelStatusPayload } from '../../../model-status/types.ts'

test('home model status summary can be derived from uptime payload', () => {
  const payload: ModelStatusPayload = {
    success: true,
    message: '',
    data: [
      {
        categoryName: 'OpenAI',
        monitors: [
          {
            name: 'GPT 4o',
            model: 'gpt-4o',
            uptime: 1,
            availability: 99.9,
            status: 1,
            latency: 118,
            updated_at: 100,
            history: [],
          },
          {
            name: 'GPT 5',
            model: 'gpt-5',
            uptime: 0.9,
            availability: 98.1,
            status: 2,
            latency: 310,
            updated_at: 120,
            history: [],
          },
        ],
      },
    ],
  }

  const view = buildModelStatusView(payload)

  assert.equal(view.summary.totalModels, 2)
  assert.equal(view.summary.upModels, 1)
  assert.equal(view.summary.degradedModels, 1)
  assert.equal(view.summary.overallStatus, 'degraded')
  assert.equal(view.groups[0]?.models[0]?.model, 'gpt-5')
})

test('home model status summary handles empty payload', () => {
  const view = buildModelStatusView({
    success: true,
    message: '',
    data: [],
  })

  assert.equal(view.summary.totalModels, 0)
  assert.equal(view.summary.overallStatus, 'unknown')
  assert.deepEqual(view.groups, [])
})
