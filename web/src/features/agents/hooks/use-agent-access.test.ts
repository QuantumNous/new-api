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

import { AxiosError, type InternalAxiosRequestConfig } from 'axios'

import {
  getAgentStatusAccessState,
  resolveAgentAccess,
} from './use-agent-access'

describe('agent access resolution', () => {
  test('keeps authoritative enabled status during background fetch and refetch error', () => {
    const base = {
      hasStatusData: true,
      isPlaceholderData: false,
      isFetching: false,
      isError: false,
      agentEnabled: true,
    }
    assert.deepEqual(getAgentStatusAccessState({ ...base, isFetching: true }), {
      isAuthoritative: true,
      globallyEnabled: true,
    })
    assert.deepEqual(getAgentStatusAccessState({ ...base, isError: true }), {
      isAuthoritative: true,
      globallyEnabled: true,
    })
  })

  test('does not treat placeholder or missing error status as authoritative', () => {
    assert.deepEqual(
      getAgentStatusAccessState({
        hasStatusData: true,
        isPlaceholderData: true,
        isFetching: true,
        isError: false,
        agentEnabled: true,
      }),
      { isAuthoritative: false, globallyEnabled: false }
    )
    assert.deepEqual(
      getAgentStatusAccessState({
        hasStatusData: false,
        isPlaceholderData: false,
        isFetching: false,
        isError: true,
        agentEnabled: false,
      }),
      { isAuthoritative: false, globallyEnabled: false }
    )
  })

  test('maps only explicit business denials to no access', async () => {
    for (const message of [
      'agent workspace is disabled',
      'agent account not found',
      'agent account is disabled',
    ]) {
      const result = await resolveAgentAccess(async () => ({
        success: false,
        message,
      }))
      assert.equal(result, null)
    }
  })

  test('keeps unknown business failures in the error path', async () => {
    await assert.rejects(
      resolveAgentAccess(async () => ({
        success: false,
        message: 'database temporarily unavailable',
      })),
      /Agent access probe failed/
    )
  })

  test('maps HTTP 403 to no access without retrying the probe', async () => {
    let calls = 0
    const config = {} as InternalAxiosRequestConfig
    const error = new AxiosError(
      'Forbidden',
      'ERR_BAD_REQUEST',
      config,
      undefined,
      {
        config,
        data: { message: 'forbidden' },
        headers: {},
        status: 403,
        statusText: 'Forbidden',
      }
    )

    const result = await resolveAgentAccess(async () => {
      calls += 1
      throw error
    })
    assert.equal(result, null)
    assert.equal(calls, 1)
  })
})
