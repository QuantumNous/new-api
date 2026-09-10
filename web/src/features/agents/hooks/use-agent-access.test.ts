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
import { AxiosError, type InternalAxiosRequestConfig } from 'axios'
import { describe, expect, test } from 'vitest'

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
    expect(getAgentStatusAccessState({ ...base, isFetching: true })).toEqual({
      isAuthoritative: true,
      globallyEnabled: true,
    })
    expect(getAgentStatusAccessState({ ...base, isError: true })).toEqual({
      isAuthoritative: true,
      globallyEnabled: true,
    })
  })

  test('does not treat placeholder or missing error status as authoritative', () => {
    expect(
      getAgentStatusAccessState({
        hasStatusData: true,
        isPlaceholderData: true,
        isFetching: true,
        isError: false,
        agentEnabled: true,
      })
    ).toEqual({ isAuthoritative: false, globallyEnabled: false })
    expect(
      getAgentStatusAccessState({
        hasStatusData: false,
        isPlaceholderData: false,
        isFetching: false,
        isError: true,
        agentEnabled: false,
      })
    ).toEqual({ isAuthoritative: false, globallyEnabled: false })
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
      expect(result).toBe(null)
    }
  })

  test('keeps unknown business failures in the error path', async () => {
    await expect(
      resolveAgentAccess(async () => ({
        success: false,
        message: 'database temporarily unavailable',
      }))
    ).rejects.toThrow(/Agent access probe failed/)
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
    expect(result).toBe(null)
    expect(calls).toBe(1)
  })
})
