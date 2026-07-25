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
import { describe, it } from 'node:test'

import { getCsvFilename } from '../lib/csv'
import { buildExportParams } from '../lib/utils'

describe('usage-log CSV export', () => {
  it('exports the full applied admin query without pagination', () => {
    const params = buildExportParams({
      searchParams: {
        page: 4,
        pageSize: 100,
        type: ['2'],
        model: 'gpt-4',
        modelNameMode: 'exact',
        token: 'production',
        group: 'vip',
        username: 'root',
        channel: '12',
        requestId: 'req-1',
        upstreamRequestId: 'upstream-1',
        startTime: 1_700_000_000_000,
        endTime: 1_700_000_060_000,
      },
      scope: 'all',
    })

    assert.deepEqual(params, {
      type: 2,
      model_name: 'gpt-4',
      model_name_mode: 'exact',
      token_name: 'production',
      group: 'vip',
      channel: 12,
      username: 'root',
      request_id: 'req-1',
      upstream_request_id: 'upstream-1',
      start_timestamp: 1_700_000_000,
      end_timestamp: 1_700_000_060,
      scope: 'all',
    })
  })

  it('matches the self view by dropping admin-only filters', () => {
    const params = buildExportParams({
      searchParams: { username: 'someone-else', channel: '12' },
      scope: 'self',
    })

    assert.equal(params.scope, 'self')
    assert.equal(params.username, undefined)
    assert.equal(params.channel, undefined)
  })

  it('uses the server filename while preventing path-like download names', () => {
    assert.equal(
      getCsvFilename("attachment; filename*=UTF-8''usage%20logs.csv"),
      'usage logs.csv'
    )
    assert.equal(
      getCsvFilename('attachment; filename="../private/export"'),
      'export.csv'
    )
    assert.equal(getCsvFilename(), 'usage-logs.csv')
  })
})
