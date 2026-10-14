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

import { calculateUpstreamHA } from '../ha-status'
import type { UpstreamRoute } from '../types'

function route(overrides: Partial<UpstreamRoute>): UpstreamRoute {
  return {
    id: 1,
    source_id: 1,
    external_group_id: 'group',
    platform: 'openai',
    protocol: 'openai',
    channel_id: 1,
    state: 'active',
    detached: false,
    rank: 1,
    effective_multiplier: 1,
    effective_models: [],
    consecutive_failures: 0,
    consecutive_successes: 0,
    ...overrides,
  }
}

describe('upstream HA calculation', () => {
  test('uses the effective model subset after sixth-source pruning', () => {
    const routes = [
      route({
        id: 1,
        source_id: 1,
        channel_id: 1,
        effective_models: ['fragile-model', 'shared-model'],
      }),
      ...[2, 3, 4, 5].map((sourceId) =>
        route({
          id: sourceId,
          source_id: sourceId,
          channel_id: sourceId,
          effective_models: ['shared-model'],
        })
      ),
      route({
        id: 6,
        source_id: 6,
        channel_id: 6,
        effective_models: [],
      }),
    ]

    expect(calculateUpstreamHA(routes)).toEqual({
      authoritative: true,
      nonHaModels: ['fragile-model:openai'],
    })
  })

  test('counts source diversity separately for each protocol', () => {
    const routes = [
      route({
        id: 1,
        source_id: 1,
        channel_id: 1,
        protocol: 'openai',
        effective_models: ['shared-name'],
      }),
      route({
        id: 2,
        source_id: 2,
        channel_id: 2,
        protocol: 'anthropic',
        effective_models: ['shared-name'],
      }),
    ]

    expect(calculateUpstreamHA(routes)).toEqual({
      authoritative: true,
      nonHaModels: ['shared-name:anthropic', 'shared-name:openai'],
    })
  })

  test('ignores detached and inactive routes', () => {
    const routes = [
      route({ effective_models: ['active-only'] }),
      route({
        id: 2,
        source_id: 2,
        channel_id: 2,
        detached: true,
        effective_models: ['active-only'],
      }),
      route({
        id: 3,
        source_id: 3,
        channel_id: 3,
        state: 'shadow',
        effective_models: ['active-only'],
      }),
    ]

    expect(calculateUpstreamHA(routes)).toEqual({
      authoritative: true,
      nonHaModels: ['active-only:openai'],
    })
  })

  test('marks active routes with missing effective models as non-authoritative', () => {
    const routes = [
      route({
        effective_models: null,
      }),
    ]

    expect(calculateUpstreamHA(routes)).toEqual({
      authoritative: false,
      nonHaModels: [],
    })
  })

  test('suppresses known non-HA results when another active route is unknown', () => {
    const routes = [
      route({
        effective_models: ['known-model'],
      }),
      route({
        id: 2,
        source_id: 2,
        channel_id: 2,
        effective_models: null,
      }),
    ]

    expect(calculateUpstreamHA(routes)).toEqual({
      authoritative: false,
      nonHaModels: [],
    })
  })
})
