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
import { api } from '@/lib/api'

import type {
  ConfirmPaymentComplianceResponse,
  FetchUpstreamRatiosRequest,
  LogCleanupTask,
  SystemOptionsResponse,
  SystemTaskListResponse,
  SystemTaskResponse,
  UpdateOptionRequest,
  UpdateOptionResponse,
  UpstreamChannelsResponse,
  UpstreamRatiosResponse,
} from './types'

type UnknownRecord = Record<string, unknown>

export type NormalizedMutationError =
  | { kind: 'conflict'; status: 409 }
  | { kind: 'message'; status: number; message: string }
  | { kind: 'server'; status?: number }

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null
}

export function getSafeServerMessage(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined

  const message = value.trim()
  if (message.length === 0 || message.length > 300) return undefined
  for (const character of message) {
    const codePoint = character.codePointAt(0)
    if (codePoint !== undefined && (codePoint < 32 || codePoint === 127)) {
      return undefined
    }
  }
  return message
}

export function normalizeMutationError(
  error: unknown
): NormalizedMutationError {
  if (!isRecord(error) || !isRecord(error.response)) {
    return { kind: 'server' }
  }

  const status = error.response.status
  if (typeof status !== 'number') return { kind: 'server' }
  if (status === 409) return { kind: 'conflict', status }
  if (status >= 500) return { kind: 'server', status }

  const data = error.response.data
  const message = isRecord(data)
    ? getSafeServerMessage(data.message)
    : undefined
  if (message) return { kind: 'message', status, message }
  return { kind: 'server', status }
}

export function resolveMutationErrorMessage(
  error: unknown,
  messages: { conflict: string; server: string; fallback: string }
): string {
  const normalized = normalizeMutationError(error)
  if (normalized.kind === 'conflict') return messages.conflict
  if (normalized.kind === 'message') return normalized.message
  return normalized.status === undefined ? messages.fallback : messages.server
}

export async function getSystemOptions() {
  const res = await api.get<SystemOptionsResponse>('/api/option/')
  return res.data
}

export async function updateSystemOption(request: UpdateOptionRequest) {
  const res = await api.put<UpdateOptionResponse>('/api/option/', request, {
    skipBusinessError: true,
    skipErrorHandler: true,
  })
  return res.data
}

export async function updateSystemOptions(requests: UpdateOptionRequest[]) {
  const res = await api.put<UpdateOptionResponse>(
    '/api/option/batch',
    {
      updates: requests,
    },
    {
      skipBusinessError: true,
      skipErrorHandler: true,
    }
  )
  return res.data
}

export async function confirmPaymentCompliance() {
  const res = await api.post<ConfirmPaymentComplianceResponse>(
    '/api/option/payment_compliance',
    { confirmed: true }
  )
  return res.data
}

export async function startLogCleanupTask(targetTimestamp: number) {
  const res = await api.post<SystemTaskResponse<LogCleanupTask>>(
    '/api/system-task/log-cleanup',
    null,
    {
      params: { target_timestamp: targetTimestamp },
    }
  )
  return res.data
}

export async function getCurrentLogCleanupTask() {
  const res = await api.get<SystemTaskResponse<LogCleanupTask | null>>(
    '/api/system-task/current',
    {
      params: { type: 'log_cleanup' },
    }
  )
  return res.data
}

export async function getSystemTask(taskId: string) {
  const res = await api.get<SystemTaskResponse<LogCleanupTask>>(
    `/api/system-task/${taskId}`
  )
  return res.data
}

export async function listSystemTasks(limit = 20) {
  const res = await api.get<SystemTaskListResponse>('/api/system-task/list', {
    params: { limit },
  })
  return res.data
}

export async function resetModelRatios() {
  const res = await api.post<UpdateOptionResponse>(
    '/api/option/rest_model_ratio'
  )
  return res.data
}

export async function getUpstreamChannels() {
  const res = await api.get<UpstreamChannelsResponse>(
    '/api/ratio_sync/channels'
  )
  return res.data
}

export async function fetchUpstreamRatios(request: FetchUpstreamRatiosRequest) {
  const res = await api.post<UpstreamRatiosResponse>(
    '/api/ratio_sync/fetch',
    request
  )
  return res.data
}
