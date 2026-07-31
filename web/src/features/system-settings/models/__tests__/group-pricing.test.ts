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

import {
  buildGroupPricingRows,
  getGroupIdentifiers,
  renameGroupIdentifierReferences,
  serializeGroupPricingRows,
} from '../group-pricing'

describe('group pricing identity', () => {
  test('uses the identifier as the display name for legacy configuration', () => {
    const rows = buildGroupPricingRows(
      '{"legacy":1}',
      '{}',
      '{"legacy":"Legacy users"}',
      '{}'
    )

    assert.equal(rows[0].identifier, 'legacy')
    assert.equal(rows[0].name, 'legacy')
  })

  test('collects identifiers from every persisted group map', () => {
    const identifiers = getGroupIdentifiers(
      '{"default":1}',
      '{"vip":"VIP users"}',
      '{"svip":1.2,"default":1}'
    )

    assert.deepEqual(identifiers, ['default', 'vip', 'svip'])
  })

  test('changes only the display-name map when a group is renamed', () => {
    const [row] = buildGroupPricingRows(
      '{"codex1":1}',
      '{"codex1":"Codex Plus"}',
      '{"codex1":"For Codex users"}',
      '{"codex1":1.2}'
    )

    const serialized = serializeGroupPricingRows([
      { ...row, name: 'Codex Pro' },
    ])

    assert.deepEqual(JSON.parse(serialized.GroupRatio), { codex1: 1 })
    assert.deepEqual(JSON.parse(serialized.TopupGroupRatio), { codex1: 1.2 })
    assert.deepEqual(JSON.parse(serialized.UserUsableGroups), {
      codex1: 'For Codex users',
    })
    assert.deepEqual(JSON.parse(serialized.GroupDisplayNames), {
      codex1: 'Codex Pro',
    })
  })

  test('allows a new row to reuse a deleted identifier', () => {
    const serialized = serializeGroupPricingRows([
      {
        _id: 'new-row',
        identifier: 'codex1',
        committedIdentifier: 'codex1',
        name: 'Replacement group',
        ratio: '1',
        topupRatio: '',
        selectable: true,
        description: '',
      },
    ])

    assert.deepEqual(JSON.parse(serialized.GroupRatio), { codex1: 1 })
    assert.deepEqual(JSON.parse(serialized.GroupDisplayNames), {
      codex1: 'Replacement group',
    })
  })

  test('renames references when a new group identifier is changed', () => {
    const renamed = renameGroupIdentifierReferences(
      {
        GroupGroupRatio: '{"grp_old":{"grp_old":0.8},"vip":{"grp_old":0.9}}',
        AutoGroups: '["grp_old","default"]',
        GroupSpecialUsableGroup:
          '{"grp_old":{"+:grp_old":"self"},"vip":{"-:grp_old":"hidden"}}',
      },
      'grp_old',
      'codex1'
    )

    assert.deepEqual(JSON.parse(renamed.GroupGroupRatio), {
      codex1: { codex1: 0.8 },
      vip: { codex1: 0.9 },
    })
    assert.deepEqual(JSON.parse(renamed.AutoGroups), ['codex1', 'default'])
    assert.deepEqual(JSON.parse(renamed.GroupSpecialUsableGroup), {
      codex1: { '+:codex1': 'self' },
      vip: { '-:codex1': 'hidden' },
    })
  })
})
