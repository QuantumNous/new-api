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

import { api } from '@/lib/http-client'

import {
  AgentSummaryRequestError,
  classifyAgentSummaryResponse,
  fetchAgentSummary,
  getAgentSummaryRetryDelay,
  parseRetryAfter,
  shouldRetryAgentSummary,
} from '../api'

describe('agent summary response contract', () => {
  test('recognizes new stable codes and legacy compatibility fields', () => {
    assert.equal(
      classifyAgentSummaryResponse(403, {
        code: 'AGENT_CANDIDATE',
        candidate: true,
      }).state,
      'candidate'
    )
    assert.equal(
      classifyAgentSummaryResponse(403, {
        code: 'AGENT_NOT_ENABLED',
        not_agent: true,
      }).state,
      'none'
    )
    assert.equal(
      classifyAgentSummaryResponse(403, {
        error: '该代理账号已被停用，如有疑问请联系客服。',
      }).state,
      'disabled'
    )
  })

  test('does not silently turn an unknown authorization failure into a normal user', () => {
    assert.equal(
      classifyAgentSummaryResponse(403, { ok: false }).state,
      'transient-error'
    )
  })

  test('honors Retry-After and only retries explicitly transient failures', () => {
    assert.equal(parseRetryAfter('3', 1_000), 3_000)
    const retryable = new AgentSummaryRequestError('rate limited', {
      retryable: true,
      retryAfterMs: 3_000,
    })
    const permanent = new AgentSummaryRequestError('forbidden', {
      retryable: false,
    })

    assert.equal(shouldRetryAgentSummary(0, retryable), true)
    assert.equal(shouldRetryAgentSummary(2, retryable), false)
    assert.equal(shouldRetryAgentSummary(0, permanent), false)
    assert.equal(getAgentSummaryRetryDelay(0, retryable), 3_000)
  })

  test('retries a route-absent 404 but treats a known data error as a stable response', async () => {
    const originalGet = api.get
    try {
      api.get = (async () => ({
        status: 404,
        data: { ok: false },
      })) as typeof api.get
      await assert.rejects(fetchAgentSummary(), (error: unknown) => {
        assert.ok(error instanceof AgentSummaryRequestError)
        assert.equal(error.retryable, true)
        assert.equal(error.status, 404)
        return true
      })

      api.get = (async () => ({
        status: 404,
        data: { ok: false, code: 'AGENT_DATA_INVALID' },
      })) as typeof api.get
      assert.deepEqual(await fetchAgentSummary(), {
        state: 'transient-error',
        status: 404,
        code: 'AGENT_DATA_INVALID',
      })
    } finally {
      api.get = originalGet
    }
  })
})
