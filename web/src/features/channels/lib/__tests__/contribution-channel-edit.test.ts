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

import { hasDisallowedContributionChannelChanges } from '../contribution-channel-edit'

describe('contribution channel edit restrictions', () => {
  test('allows only tag, priority, and weight changes', () => {
    assert.equal(
      hasDisallowedContributionChannelChanges({
        tag: true,
        priority: true,
        weight: true,
      }),
      false
    )
  })

  test('rejects connection, model, group, name, and remark changes', () => {
    for (const dirtyFields of [
      { name: true },
      { base_url: true },
      { key: true },
      { models: true },
      { model_mapping: true },
      { group: true },
      { remark: true },
    ]) {
      assert.equal(hasDisallowedContributionChannelChanges(dirtyFields), true)
    }
  })

  test('ignores fields that are present but not dirty', () => {
    assert.equal(
      hasDisallowedContributionChannelChanges({
        name: false,
        models: false,
        tag: true,
      }),
      false
    )
  })
})
