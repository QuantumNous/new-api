import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { CHANNEL_TYPE_OPTIONS } from '../../channels/constants.ts'
import {
  areAllKnownChannelTypesSelected,
  getUnknownChannelTypeIds,
  normalizeChannelTypeIds,
  selectAllKnownChannelTypeIds,
  shouldShowChannelTypeSelectAllShortcut,
} from './monitoring-channel-types.ts'

describe('monitoring channel type normalization', () => {
  test('keeps unknown integer channel type ids after known ids', () => {
    const knownId = CHANNEL_TYPE_OPTIONS[0].value

    assert.deepEqual(normalizeChannelTypeIds([999, knownId, '1000']), [
      knownId,
      999,
      1000,
    ])
  })

  test('select all keeps existing unknown ids', () => {
    const selected = selectAllKnownChannelTypeIds([999])

    assert.equal(areAllKnownChannelTypesSelected(selected), true)
    assert.equal(selected.includes(999), true)
  })

  test('reports unknown channel type ids for operator visibility', () => {
    const knownId = CHANNEL_TYPE_OPTIONS[0].value

    assert.deepEqual(getUnknownChannelTypeIds([knownId, 999, 1000]), [
      999,
      1000,
    ])
  })

  test('only shows select all shortcut when explicitly enabled', () => {
    assert.equal(shouldShowChannelTypeSelectAllShortcut(true), true)
    assert.equal(shouldShowChannelTypeSelectAllShortcut(false), false)
    assert.equal(shouldShowChannelTypeSelectAllShortcut(undefined), false)
  })
})
