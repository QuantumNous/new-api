/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.
*/
import { describe, expect, test } from 'vitest'

import type { QuotaDataItem } from '../types'
import { buildModelMetrics } from './stats'

describe('buildModelMetrics', () => {
  test('aggregates usage by model and calculates average rates', () => {
    const data: QuotaDataItem[] = [
      {
        model_name: 'gpt-4o',
        count: 4,
        token_used: 800,
        quota: 120,
        created_at: 1,
      },
      {
        model_name: 'gpt-4o',
        count: 1,
        token_used: 200,
        quota: 30,
        created_at: 2,
      },
      {
        model_name: 'claude-3-5',
        count: 2,
        token_used: 600,
        quota: 50,
        created_at: 1,
      },
    ]

    const metrics = buildModelMetrics(data, 10)

    expect(metrics).toEqual([
      {
        modelName: 'gpt-4o',
        requestCount: 5,
        totalTokens: 1000,
        averageRpm: 0.5,
        averageTpm: 100,
      },
      {
        modelName: 'claude-3-5',
        requestCount: 2,
        totalTokens: 600,
        averageRpm: 0.2,
        averageTpm: 60,
      },
    ])
  })

  test('uses one minute as the minimum duration and preserves empty model names', () => {
    const metrics = buildModelMetrics(
      [{ model_name: '', count: 2, token_used: 10, quota: 1, created_at: 1 }],
      0
    )

    expect(metrics[0]).toMatchObject({
      modelName: '',
      averageRpm: 2,
      averageTpm: 10,
    })
  })
})
