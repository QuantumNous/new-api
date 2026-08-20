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
