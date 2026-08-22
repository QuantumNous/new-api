import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import { buildTimingPresentation } from '../request-timing'

describe('request timing presentation', () => {
  test('uses end-to-end stream timing and preserves zero millisecond phases', () => {
    const presentation = buildTimingPresentation(9, 3200, {
      total_ms: 1500,
      gateway_ms: 100,
      upstream_first_data_ms: 400,
      first_data_to_client_ms: 0,
      client_stream_ms: 900,
      finalize_ms: 100,
    })

    assert.equal(presentation.totalSeconds, 1.5)
    assert.equal(presentation.firstTokenSeconds, 0.5)
    assert.deepEqual(
      presentation.phases.map((phase) => [phase.key, phase.milliseconds]),
      [
        ['gateway_ms', 100],
        ['upstream_first_data_ms', 400],
        ['first_data_to_client_ms', 0],
        ['client_stream_ms', 900],
        ['finalize_ms', 100],
      ]
    )
  })

  test('builds the non-stream response phase list', () => {
    const presentation = buildTimingPresentation(4, undefined, {
      total_ms: 800,
      gateway_ms: 50,
      upstream_response_ms: 600,
      response_write_ms: 25,
      finalize_ms: 125,
    })

    assert.equal(presentation.totalSeconds, 0.8)
    assert.equal(presentation.firstTokenSeconds, null)
    assert.deepEqual(
      presentation.phases.map((phase) => phase.key),
      ['gateway_ms', 'upstream_response_ms', 'response_write_ms', 'finalize_ms']
    )
  })

  test('shows the available upstream failure phase', () => {
    const presentation = buildTimingPresentation(2, undefined, {
      total_ms: 320,
      gateway_ms: 20,
      upstream_error_ms: 300,
    })

    assert.deepEqual(
      presentation.phases.map((phase) => phase.key),
      ['gateway_ms', 'upstream_error_ms']
    )
  })

  test('falls back to legacy duration and first response time', () => {
    const presentation = buildTimingPresentation(3, 250, undefined)

    assert.equal(presentation.totalSeconds, 3)
    assert.equal(presentation.firstTokenSeconds, 0.25)
    assert.deepEqual(presentation.phases, [])
  })

  test('ignores invalid request timing values', () => {
    const presentation = buildTimingPresentation(3, 250, {
      total_ms: -1,
      gateway_ms: Number.NaN,
      upstream_first_data_ms: 100,
    })

    assert.equal(presentation.totalSeconds, 3)
    assert.equal(presentation.firstTokenSeconds, 0.25)
    assert.deepEqual(
      presentation.phases.map((phase) => phase.key),
      ['upstream_first_data_ms']
    )
  })
})
