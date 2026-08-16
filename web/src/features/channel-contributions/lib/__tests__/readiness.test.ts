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
  canEditContribution,
  canWithdrawContribution,
  getSecondaryContributionRevisionStatus,
  getTestRunId,
  getTestRunResults,
  hasPendingContributionRevision,
  isTestRunFresh,
  testRunPassed,
} from '../../lib'
import type {
  ChannelContribution,
  ChannelContributionTestRun,
} from '../../types'

function successfulRun(overrides?: Partial<ChannelContributionTestRun>) {
  const now = Math.floor(Date.now() / 1000)
  return {
    id: 10,
    status: 'succeeded' as const,
    pricing_ready: true,
    completed_at: now,
    results: [
      {
        model: 'gpt-test',
        endpoint_type: 'chat',
        stream: false,
        success: true,
      },
      {
        model: 'gpt-test',
        endpoint_type: 'chat',
        stream: true,
        success: true,
      },
    ],
    ...overrides,
  }
}

describe('channel contribution readiness', () => {
  test('accepts a fresh chat run only when stream and non-stream probes pass', () => {
    assert.equal(testRunPassed(successfulRun()), true)

    const missingStream = successfulRun({
      results: [
        {
          model: 'gpt-test',
          endpoint_type: 'chat',
          stream: false,
          success: true,
        },
      ],
    })
    assert.equal(testRunPassed(missingStream), false)
  })

  test('treats embedding and rerank endpoints as non-streaming probes', () => {
    const run = successfulRun({
      results: [
        {
          model: 'embed-test',
          endpoint_type: 'embeddings',
          stream: false,
          success: true,
        },
        {
          model: 'rerank-test',
          endpoint_type: 'rerank',
          stream: false,
          success: true,
        },
      ],
    })
    const results = getTestRunResults(run)

    assert.equal(results.length, 2)
    assert.equal(
      results.every((result) => result.stream_required === false),
      true
    )
    assert.equal(testRunPassed(run), true)
  })

  test('expires a completed run after 30 minutes', () => {
    const now = Date.now()
    const fresh = successfulRun({
      completed_at: Math.floor((now - 29 * 60_000) / 1000),
    })
    const expired = successfulRun({
      completed_at: Math.floor((now - 31 * 60_000) / 1000),
    })

    assert.equal(isTestRunFresh(fresh, now), true)
    assert.equal(isTestRunFresh(expired, now), false)
    assert.equal(testRunPassed(expired), false)
  })

  test('uses the current revision pricing state instead of the test snapshot', () => {
    assert.equal(
      testRunPassed(successfulRun({ pricing_ready: false }), true),
      true
    )
    assert.equal(
      testRunPassed(successfulRun({ pricing_ready: true }), false),
      false
    )
  })

  test('blocks editing while a pending revision exists and permits withdrawal until deletion', () => {
    const contribution = {
      id: 1,
      status: 'approved',
      pending_revision_id: 22,
    } as ChannelContribution

    assert.equal(canEditContribution(contribution), false)
    assert.equal(
      canEditContribution({
        id: 2,
        status: 'approved',
        pending_revision: {
          id: 23,
          name: 'pending revision',
          type: 1,
          base_url: 'https://api.example.com',
          group: 'default',
          models: ['gpt-test'],
          model_mapping: {},
        },
      }),
      false
    )
    assert.equal(canWithdrawContribution('draft'), true)
    assert.equal(canWithdrawContribution('rejected'), true)
    assert.equal(canWithdrawContribution('pending'), true)
    assert.equal(canWithdrawContribution('approved'), true)
    assert.equal(canWithdrawContribution('unavailable'), true)
    assert.equal(canWithdrawContribution('deleted'), false)
  })

  test('preserves numeric test run IDs for submit payloads', () => {
    assert.equal(getTestRunId(successfulRun({ id: 42 })), 42)
    assert.equal(
      getTestRunId(successfulRun({ id: undefined, run_id: '43' })),
      '43'
    )
  })

  test('recognizes modification reviews while the approved channel remains active', () => {
    const pendingModification = {
      id: 9,
      status: 'approved',
      revision_status: 'pending',
      pending_revision_id: 31,
    } as ChannelContribution

    assert.equal(hasPendingContributionRevision(pendingModification), true)
    assert.equal(
      getSecondaryContributionRevisionStatus(pendingModification),
      'pending'
    )
    assert.equal(
      getSecondaryContributionRevisionStatus({
        ...pendingModification,
        status: 'pending',
      }),
      null
    )
  })
})
