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

const PG_COMPLETIONS = '/pg/chat/completions'
const USER_MODELS    = '/api/user/models'
const USER_GROUPS    = '/api/user/self/groups'
const USER_LOGS      = '/api/log/self'

/** Log type = consume (from backend constants) */
const LOG_TYPE_CONSUME = 2

export interface ModelCallResult {
  modelId: string
  /** Round-trip latency in ms (from frontend timer, fallback when log unavailable) */
  responseTimeMs: number
  /** Backend model processing time in ms (from log use_time * 1000, preferred) */
  useTimeMs: number | null
  promptTokens: number
  completionTokens: number
  totalTokens: number
  /** Raw quota in internal units — divide by quotaPerUnit from system config for display */
  quotaRaw: number | null
  content: string
}

export interface GroupOption {
  value: string
  label: string
  ratio: number
  desc: string
}

/**
 * Call a single model via /pg/chat/completions (session auth, no API key needed).
 * The backend creates a temporary playground token tied to the current user + group,
 * routes through the relay pipeline, and deducts from the user's quota.
 *
 * After the response arrives, we fetch the matching usage log entry via
 * X-Oneapi-Request-Id so that useTimeMs and quotaRaw reflect the backend's
 * authoritative figures (identical to what the Usage Log dashboard shows).
 */
export async function callModelWithSession(
  modelId: string,
  prompt: string,
  group: string,
): Promise<ModelCallResult> {
  const start = Date.now()

  const res = await api.post(PG_COMPLETIONS, {
    model: modelId,
    group,
    messages: [{ role: 'user', content: prompt }],
    stream: false,
  })

  const elapsed = Date.now() - start

  const data = res.data as {
    choices?: Array<{ message?: { content?: string } }>
    usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number }
  }
  const content = data.choices?.[0]?.message?.content ?? ''
  const usage = data.usage ?? { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }

  // The middleware writes X-Oneapi-Request-Id to both the request context and
  // the response headers — use it to pull the exact log entry.
  const requestId = (res.headers as Record<string, string>)['x-oneapi-request-id'] ?? ''

  let useTimeMs: number | null = null
  let quotaRaw: number | null  = null

  if (requestId) {
    try {
      const logRes = await api.get(USER_LOGS, {
        params: { request_id: requestId, type: LOG_TYPE_CONSUME, p: 1, size: 1 },
      })
      const item = logRes.data?.data?.items?.[0] as
        | { use_time?: number; quota?: number }
        | undefined
      if (item) {
        if (typeof item.use_time === 'number') useTimeMs = item.use_time * 1000
        if (typeof item.quota   === 'number') quotaRaw  = item.quota
      }
    } catch {
      // Non-critical: fall back to frontend estimates
    }
  }

  return {
    modelId,
    responseTimeMs:   elapsed,
    useTimeMs,
    promptTokens:     usage.prompt_tokens,
    completionTokens: usage.completion_tokens,
    totalTokens:      usage.total_tokens,
    quotaRaw,
    content,
  }
}

/**
 * Fetch the list of model IDs available for the current user (session-based).
 */
export async function fetchAvailableModels(): Promise<string[]> {
  const res = await api.get(USER_MODELS)
  const { data } = res
  if (!data.success || !Array.isArray(data.data)) return []
  return data.data as string[]
}

/**
 * Fetch the list of groups available for the current user.
 */
export async function fetchAvailableGroups(): Promise<GroupOption[]> {
  const res = await api.get(USER_GROUPS)
  const { data } = res
  if (!data.success || !data.data) return []
  return Object.entries(data.data as Record<string, { desc: string; ratio: number }>).map(
    ([group, info]) => ({ value: group, label: group, ratio: info.ratio, desc: info.desc }),
  )
}
