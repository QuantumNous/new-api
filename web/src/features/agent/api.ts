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
import axios from 'axios'

import { api } from '@/lib/http-client'

import type { AgentSummaryPayload, AgentSummaryResult } from './types'

const SUMMARY_URL = '/agent/api/agent/summary'
const MAX_RETRIES = 2

type AgentSummaryRequestErrorOptions = {
  retryable: boolean
  status?: number
  retryAfterMs?: number
  cause?: unknown
}

export class AgentSummaryRequestError extends Error {
  readonly retryable: boolean
  readonly status?: number
  readonly retryAfterMs?: number

  constructor(message: string, options: AgentSummaryRequestErrorOptions) {
    super(message, { cause: options.cause })
    this.name = 'AgentSummaryRequestError'
    this.retryable = options.retryable
    this.status = options.status
    this.retryAfterMs = options.retryAfterMs
  }
}

function asPayload(value: unknown): AgentSummaryPayload {
  if (value && typeof value === 'object') {
    return value as AgentSummaryPayload
  }
  return {}
}

export function classifyAgentSummaryResponse(
  status: number,
  value: unknown
): AgentSummaryResult {
  const payload = asPayload(value)
  const code = typeof payload.code === 'string' ? payload.code : undefined
  const profileStatus = payload.profile?.status?.toLowerCase()

  if (status >= 200 && status < 300 && payload.ok === true) {
    if (profileStatus === 'disabled') return { state: 'disabled' }
    return { state: 'agent', summary: payload }
  }

  if (status === 403) {
    if (code === 'AGENT_CANDIDATE' || payload.candidate === true) {
      return {
        state: 'candidate',
        applyUrl:
          typeof payload.apply_url === 'string' ? payload.apply_url : undefined,
      }
    }
    if (code === 'AGENT_NOT_ENABLED' || payload.not_agent === true) {
      return { state: 'none' }
    }
    if (
      code === 'AGENT_DISABLED' ||
      profileStatus === 'disabled' ||
      (typeof payload.error === 'string' &&
        /disabled|停用|停權|無効/i.test(payload.error))
    ) {
      return { state: 'disabled' }
    }
  }

  return { state: 'transient-error', status, code }
}

export function parseRetryAfter(
  value: string | number | null | undefined,
  now = Date.now()
): number | undefined {
  if (value === null || value === undefined) return undefined
  const seconds = Number(value)
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1_000

  const retryAt = Date.parse(String(value))
  if (!Number.isFinite(retryAt)) return undefined
  return Math.max(0, retryAt - now)
}

function retryAfterFromHeaders(headers: unknown): number | undefined {
  if (!headers || typeof headers !== 'object') return undefined
  const record = headers as Record<string, unknown> & {
    get?: (name: string) => unknown
  }
  const raw = record['retry-after'] ?? record.get?.('retry-after')
  if (typeof raw !== 'string' && typeof raw !== 'number') return undefined
  return parseRetryAfter(raw)
}

export async function fetchAgentSummary(
  signal?: AbortSignal
): Promise<AgentSummaryResult> {
  try {
    const response = await api.get<AgentSummaryPayload>(SUMMARY_URL, {
      signal,
      skipBusinessError: true,
      skipErrorHandler: true,
      validateStatus: (status) =>
        (status >= 200 && status < 300) || status === 403 || status === 404,
    })
    const result = classifyAgentSummaryResponse(response.status, response.data)
    if (
      response.status === 404 &&
      asPayload(response.data).code !== 'AGENT_DATA_INVALID'
    ) {
      throw new AgentSummaryRequestError('Agent summary route unavailable', {
        retryable: true,
        status: response.status,
      })
    }
    return result
  } catch (error) {
    if (axios.isCancel(error)) throw error
    if (error instanceof AgentSummaryRequestError) throw error
    if (!axios.isAxiosError(error)) {
      throw new AgentSummaryRequestError('Agent summary request failed', {
        retryable: false,
        cause: error,
      })
    }

    const status = error.response?.status
    if (status === 429) {
      throw new AgentSummaryRequestError('Agent summary request rate limited', {
        retryable: true,
        status,
        retryAfterMs: retryAfterFromHeaders(error.response?.headers),
        cause: error,
      })
    }
    if (status === undefined || status >= 500) {
      throw new AgentSummaryRequestError('Agent summary service unavailable', {
        retryable: true,
        status,
        cause: error,
      })
    }
    throw new AgentSummaryRequestError('Agent summary request rejected', {
      retryable: false,
      status,
      cause: error,
    })
  }
}

export function shouldRetryAgentSummary(
  failureCount: number,
  error: Error
): boolean {
  return (
    error instanceof AgentSummaryRequestError &&
    error.retryable &&
    failureCount < MAX_RETRIES
  )
}

export function getAgentSummaryRetryDelay(
  attemptIndex: number,
  error: Error
): number {
  if (
    error instanceof AgentSummaryRequestError &&
    error.retryAfterMs !== undefined
  ) {
    return error.retryAfterMs
  }
  return Math.min(1_000 * 2 ** attemptIndex, 10_000)
}
