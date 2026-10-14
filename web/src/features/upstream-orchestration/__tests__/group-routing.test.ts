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

import { getUnroutedUpstreamGroups } from '../group-routing'
import type { UpstreamGroup, UpstreamRoute } from '../types'

function group(
  id: number,
  sourceId: number,
  externalId: string
): UpstreamGroup {
  return {
    id,
    source_id: sourceId,
    external_id: externalId,
    name: `Group ${id}`,
    platform: 'openai',
    effective_multiplier: 1,
    health_status: 'operational',
    models: '["model-a"]',
    observed_at: 1_800_000_000,
  }
}

function route(overrides: Partial<UpstreamRoute>): UpstreamRoute {
  return {
    id: 1,
    source_id: 1,
    external_group_id: 'group-a',
    platform: 'openai',
    protocol: 'openai',
    channel_id: 1,
    state: 'active',
    detached: false,
    rank: 1,
    effective_multiplier: 1,
    effective_models: ['model-a'],
    consecutive_failures: 0,
    consecutive_successes: 0,
    ...overrides,
  }
}

describe('unrouted upstream group selection', () => {
  test('requires an active attached route with the same source and external group', () => {
    const groups = [
      group(1, 1, 'group-a'),
      group(2, 1, 'group-b'),
      group(3, 2, 'group-a'),
      group(4, 3, 'group-c'),
    ]
    const routes = [
      route({ source_id: 1, external_group_id: 'group-a' }),
      route({
        id: 2,
        source_id: 1,
        external_group_id: 'group-b',
        state: 'shadow',
      }),
      route({
        id: 3,
        source_id: 2,
        external_group_id: 'group-a',
        detached: true,
      }),
    ]

    expect(getUnroutedUpstreamGroups(groups, routes)).toEqual([
      groups[1],
      groups[2],
      groups[3],
    ])
  })
})
