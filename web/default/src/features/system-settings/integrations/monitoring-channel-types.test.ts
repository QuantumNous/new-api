import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { CHANNEL_TYPE_OPTIONS } from '@/features/channels/constants'
import {
  areAllKnownChannelTypesSelected,
  normalizeChannelTypeIds,
  selectAllKnownChannelTypeIds,
} from './monitoring-channel-types'

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
})
