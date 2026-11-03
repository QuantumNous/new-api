import { describe, test } from 'bun:test'
import assert from 'node:assert/strict'

import { getStreamCut, getStreamEndReasonLabel } from '../format'

describe('getStreamCut', () => {
  test('recognizes the two known cut sides', () => {
    assert.equal(getStreamCut({ stream_cut: 'upstream' }), 'upstream')
    assert.equal(getStreamCut({ stream_cut: 'client' }), 'client')
  })

  test('ignores unknown and missing markers', () => {
    assert.equal(getStreamCut(null), null)
    assert.equal(getStreamCut({}), null)
    assert.equal(getStreamCut({ stream_cut: 'future' as 'upstream' }), null)
  })
})

describe('getStreamEndReasonLabel', () => {
  const t = (key: string) => key

  test('maps client_gone to a human-readable label', () => {
    assert.equal(
      getStreamEndReasonLabel(t, 'client_gone'),
      'Client disconnected'
    )
  })

  test('maps known reasons and keeps unknown ones visible', () => {
    assert.equal(
      getStreamEndReasonLabel(t, 'scanner_error'),
      'Upstream stream error'
    )
    assert.equal(getStreamEndReasonLabel(t, 'future_reason'), 'future_reason')
    assert.equal(getStreamEndReasonLabel(t, undefined), '-')
  })
})
