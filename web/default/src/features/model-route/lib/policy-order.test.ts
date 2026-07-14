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

import type { ModelRoutePolicy } from '../types'
import {
  filterPolicyGroupByChannel,
  groupModelRoutePolicies,
  movePolicyWithinGroup,
  replaceModelPolicyGroup,
  suggestTopPriority,
} from './policy-order'

const policies: ModelRoutePolicy[] = [
  {
    channel_id: 2,
    channel_name: 'Beta',
    requested_model: 'gpt',
    manual_priority: 90,
    enabled: true,
    source: 'configured',
  },
  {
    channel_id: 1,
    channel_name: 'Alpha',
    requested_model: 'gpt',
    manual_priority: 100,
    enabled: true,
    source: 'configured',
  },
  {
    channel_id: 3,
    channel_name: 'Claude',
    requested_model: 'claude',
    manual_priority: 50,
    enabled: true,
    source: 'mapped',
  },
]

describe('model route policy ordering', () => {
  test('groups by requested model and keeps complete sorted groups for model matches', () => {
    const groups = groupModelRoutePolicies(policies, 'gpt', true)
    assert.equal(groups.length, 1)
    assert.deepEqual(
      groups[0].policies.map((policy) => policy.channel_id),
      [1, 2]
    )
  })

  test('moves only policies in the selected group', () => {
    const gpt = groupModelRoutePolicies(policies, 'gpt', true)[0].policies
    const moved = movePolicyWithinGroup(gpt, 2, 1)
    assert.deepEqual(
      moved.map((policy) => policy.channel_id),
      [2, 1]
    )
    assert.equal(
      policies.find((policy) => policy.requested_model === 'claude')
        ?.channel_id,
      3
    )
  })

  test('channel filtering hides members without changing the complete group snapshot', () => {
    const gpt = groupModelRoutePolicies(policies, 'gpt', true)[0].policies
    assert.deepEqual(
      filterPolicyGroupByChannel(gpt, 'Alpha').map(
        (policy) => policy.channel_id
      ),
      [1]
    )
    assert.deepEqual(
      gpt.map((policy) => policy.channel_id),
      [1, 2]
    )
  })

  test('replaces only the authoritative response group and supports rollback snapshots', () => {
    const snapshot = [...policies]
    const replacement = [
      { ...policies[1], manual_priority: 95 },
      { ...policies[0], manual_priority: 94 },
    ]
    const updated = replaceModelPolicyGroup(policies, 'gpt', replacement)
    assert.deepEqual(
      updated.filter((policy) => policy.requested_model === 'gpt'),
      replacement
    )
    assert.deepEqual(snapshot, policies)
  })

  test('suggests an editable top value without exceeding the priority range', () => {
    assert.equal(suggestTopPriority(policies), 200)
    assert.equal(
      suggestTopPriority([{ ...policies[0], manual_priority: 9950 }]),
      9999
    )
    assert.equal(
      suggestTopPriority([{ ...policies[0], manual_priority: 9999 }]),
      null
    )
  })
})
