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
import type { TFunction } from 'i18next'

import { CHANNEL_TYPES } from '@/features/channels/constants'

import { TASK_ACTIONS } from '../constants'
import type { TaskLog, TaskLogProperties } from '../types'

export function parseTaskProperties(raw: unknown): TaskLogProperties {
  if (!raw) return {}
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as TaskLogProperties
  }
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw)
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as TaskLogProperties
      }
    } catch {
      return {}
    }
  }
  return {}
}

export function parseTaskDataValue(raw: unknown): unknown {
  if (raw == null || raw === '') return null
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw)
    } catch {
      return raw
    }
  }
  return raw
}

export function parseTaskDataArray(raw: unknown): unknown[] {
  const data = parseTaskDataValue(raw)
  return Array.isArray(data) ? data : []
}

export function resolveTaskPlatformLabel(
  platform: string,
  t: TFunction
): string {
  const numeric = Number(platform)
  if (
    !Number.isNaN(numeric) &&
    CHANNEL_TYPES[numeric as keyof typeof CHANNEL_TYPES]
  ) {
    return t(CHANNEL_TYPES[numeric as keyof typeof CHANNEL_TYPES])
  }
  return platform ? t(platform) : '-'
}

export function getTaskVideoResultUrl(
  log: TaskLog,
  failReason?: string
): string {
  if (
    typeof log.result_url === 'string' &&
    /^https?:\/\//.test(log.result_url)
  ) {
    return log.result_url
  }
  if (typeof failReason === 'string' && failReason.startsWith('http')) {
    return failReason
  }
  const data = parseTaskDataValue(log.data)
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    const content = (data as Record<string, unknown>).content as
      | Record<string, unknown>
      | undefined
    const videoUrl = content?.video_url
    if (typeof videoUrl === 'string' && videoUrl.startsWith('http')) {
      return videoUrl
    }
  }
  return ''
}

export function isTaskVideoAction(action: string): boolean {
  return (
    action === TASK_ACTIONS.GENERATE ||
    action === TASK_ACTIONS.TEXT_GENERATE ||
    action === TASK_ACTIONS.FIRST_TAIL_GENERATE ||
    action === TASK_ACTIONS.REFERENCE_GENERATE ||
    action === TASK_ACTIONS.REMIX_GENERATE
  )
}

export function getTaskModelName(log: TaskLog): string {
  const properties = parseTaskProperties(log.properties)
  if (properties.origin_model_name) return properties.origin_model_name
  if (properties.upstream_model_name) return properties.upstream_model_name

  const data = parseTaskDataValue(log.data)
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    const model = (data as Record<string, unknown>).model
    if (typeof model === 'string' && model) return model
  }
  return ''
}

export function formatTaskDurationSec(
  submitTime?: number,
  finishTime?: number
): string {
  if (!submitTime || !finishTime || finishTime <= submitTime) return ''
  return `${(finishTime - submitTime).toFixed(1)}s`
}

export function formatTaskJson(value: unknown): string {
  if (value == null || value === '') return ''
  if (typeof value === 'string') {
    try {
      return JSON.stringify(JSON.parse(value), null, 2)
    } catch {
      return value
    }
  }
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

interface TaskUpstreamScalar {
  label: string
  value: string
}

export function extractTaskUpstreamScalars(
  data: unknown
): TaskUpstreamScalar[] {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return []

  const obj = data as Record<string, unknown>
  const rows: TaskUpstreamScalar[] = []
  const push = (label: string, value: unknown) => {
    if (value == null || value === '') return
    if (typeof value === 'object') return
    rows.push({ label, value: String(value) })
  }

  push('Upstream Task ID', obj.id)
  push('Model', obj.model)
  push('Upstream Status', obj.status)
  push('Resolution', obj.resolution)
  push('Ratio', obj.ratio)
  push('Duration', obj.duration)
  push('FPS', obj.framespersecond)
  push('Seed', obj.seed)
  push('Generate Audio', obj.generate_audio)
  push('Draft', obj.draft)
  push('Service Tier', obj.service_tier)

  const usage = obj.usage as Record<string, unknown> | undefined
  if (usage) {
    push('Completion Tokens', usage.completion_tokens)
    push('Total Tokens', usage.total_tokens)
  }

  const cost = obj.cost as Record<string, unknown> | undefined
  if (cost) {
    push('Cost Currency', cost.currency)
    push('Total Cost', cost.total_cost)
    push('Output Cost', cost.output_cost)
  }

  return rows
}
