import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import {
  buildCodexLimitReportTimeRange,
  isSameCodexLimitReportTimeRange,
} from './codex-limit-report-range'

describe('Codex limit report rolling range', () => {
  test('recomputes the selected rolling preset from the current time', () => {
    const initial = buildCodexLimitReportTimeRange(
      7,
      new Date('2026-06-01T12:00:00Z')
    )
    const refreshed = buildCodexLimitReportTimeRange(
      7,
      new Date('2026-06-02T12:00:00Z')
    )

    assert.equal(initial.end_timestamp, 1780315200)
    assert.equal(refreshed.end_timestamp, 1780401600)
    assert.equal(refreshed.end_timestamp - refreshed.start_timestamp, 7 * 86400)
    assert.equal(isSameCodexLimitReportTimeRange(initial, refreshed), false)
  })
})
