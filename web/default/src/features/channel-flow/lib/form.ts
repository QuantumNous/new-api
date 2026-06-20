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
import z from 'zod'
import type {
  ChannelFlowBindingPayload,
  ChannelFlowPool,
  ChannelFlowPoolPayload,
  ChannelFlowScheduleWindow,
} from '../types'

const nonNegativeInt = z.coerce.number().int().min(0)
const positiveInt = z.coerce.number().int().min(1)
const nonNegativeMs = z.coerce.number().int().min(0)
const timeInputPattern = /^([01]\d|2[0-3]):[0-5]\d$/
const defaultScheduleTimezone = 'Asia/Shanghai'
const defaultScheduleWeekdays = [1, 2, 3, 4, 5]

function parseTimeInputToMinute(value: string): number {
  if (!timeInputPattern.test(value)) return -1
  const [hours, minutes] = value.split(':').map(Number)
  return hours * 60 + minutes
}

function minuteToTimeInput(minute: number): string {
  const clamped = Math.max(
    0,
    Math.min(1439, Number.isFinite(minute) ? minute : 0)
  )
  const hours = Math.floor(clamped / 60)
  const minutes = clamped % 60
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

function parseScheduleWindows(raw?: string): ChannelFlowScheduleWindow[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (item): item is ChannelFlowScheduleWindow =>
        item &&
        Array.isArray(item.weekdays) &&
        Number.isInteger(item.start_minute) &&
        Number.isInteger(item.end_minute)
    )
  } catch {
    return []
  }
}

function buildScheduleWindows(values: ChannelFlowPoolFormValues): string {
  if (values.schedule_mode !== 'weekly') return ''
  const weekdays = [...new Set(values.schedule_weekdays)]
    .filter((weekday) => weekday >= 0 && weekday <= 6)
    .sort((a, b) => a - b)
  if (weekdays.length === 0) return ''
  return JSON.stringify([
    {
      weekdays,
      start_minute: parseTimeInputToMinute(values.schedule_start_time),
      end_minute: parseTimeInputToMinute(values.schedule_end_time),
    },
  ])
}

export const channelFlowPoolFormSchema = z
  .object({
    id: z.number().default(0),
    name: z.string().trim().min(1, 'Pool name is required'),
    description: z.string().trim().default(''),
    enabled: z.boolean(),
    backend: z.enum(['memory', 'redis']),
    max_inflight: nonNegativeInt,
    max_inflight_per_user: nonNegativeInt,
    max_queue_size: nonNegativeInt,
    max_queue_per_user: nonNegativeInt,
    queue_timeout_ms: positiveInt,
    queue_policy: z.enum(['fifo']),
    on_limit: z.enum(['queue', 'reject', 'fallback']),
    redis_failure_policy: z.enum(['fail_open', 'fail_closed', 'local_memory']),
    max_context_tokens: nonNegativeInt,
    max_context_chars: nonNegativeInt,
    max_processing_ms: nonNegativeMs,
    lease_ms: positiveInt,
    renew_interval_ms: positiveInt,
    schedule_mode: z.enum(['always', 'datetime_range', 'weekly']),
    schedule_timezone: z.string().trim().min(1, 'Timezone is required'),
    effective_start_time: nonNegativeInt,
    effective_end_time: nonNegativeInt,
    schedule_windows: z.string().default(''),
    schedule_weekdays: z.array(z.number().int().min(0).max(6)),
    schedule_start_time: z
      .string()
      .regex(timeInputPattern, 'Start time is invalid'),
    schedule_end_time: z
      .string()
      .regex(timeInputPattern, 'End time is invalid'),
  })
  .superRefine((values, ctx) => {
    if (values.schedule_mode === 'datetime_range') {
      if (values.effective_start_time <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['effective_start_time'],
          message: 'Start time is required',
        })
      }
      if (values.effective_end_time <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['effective_end_time'],
          message: 'End time is required',
        })
      }
      if (
        values.effective_start_time > 0 &&
        values.effective_end_time > 0 &&
        values.effective_end_time <= values.effective_start_time
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['effective_end_time'],
          message: 'End time must be after start time',
        })
      }
    }
    if (values.schedule_mode === 'weekly') {
      if (values.schedule_weekdays.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['schedule_weekdays'],
          message: 'Select at least one weekday',
        })
      }
      if (
        parseTimeInputToMinute(values.schedule_start_time) ===
        parseTimeInputToMinute(values.schedule_end_time)
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['schedule_end_time'],
          message: 'End time must differ from start time',
        })
      }
    }
    if (
      values.max_inflight_per_user > 0 &&
      values.max_inflight > 0 &&
      values.max_inflight_per_user > values.max_inflight
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['max_inflight_per_user'],
        message: 'Per-user inflight cap cannot exceed max inflight',
      })
    }
  })

export type ChannelFlowPoolFormValues = z.infer<
  typeof channelFlowPoolFormSchema
>

export const channelFlowBindingFormSchema = z.object({
  channel_id: positiveInt,
  upstream_model: z.string().trim().default(''),
  match_mode: z.enum(['channel']),
  enabled: z.boolean(),
})

export type ChannelFlowBindingFormValues = z.infer<
  typeof channelFlowBindingFormSchema
>

export const defaultPoolFormValues: ChannelFlowPoolFormValues = {
  id: 0,
  name: '',
  description: '',
  enabled: true,
  backend: 'memory',
  max_inflight: 60,
  max_inflight_per_user: 0,
  max_queue_size: 240,
  max_queue_per_user: 0,
  queue_timeout_ms: 120000,
  queue_policy: 'fifo',
  on_limit: 'queue',
  redis_failure_policy: 'fail_open',
  max_context_tokens: 0,
  max_context_chars: 0,
  max_processing_ms: 0,
  lease_ms: 60000,
  renew_interval_ms: 20000,
  schedule_mode: 'always',
  schedule_timezone: defaultScheduleTimezone,
  effective_start_time: 0,
  effective_end_time: 0,
  schedule_windows: '',
  schedule_weekdays: defaultScheduleWeekdays,
  schedule_start_time: '09:00',
  schedule_end_time: '18:00',
}

export const defaultBindingFormValues: ChannelFlowBindingFormValues = {
  channel_id: 0,
  upstream_model: '',
  match_mode: 'channel',
  enabled: true,
}

export function poolToFormValues(
  pool?: ChannelFlowPool | null
): ChannelFlowPoolFormValues {
  if (!pool) {
    return {
      ...defaultPoolFormValues,
      schedule_weekdays: [...defaultScheduleWeekdays],
    }
  }
  const firstScheduleWindow = parseScheduleWindows(pool.schedule_windows)[0]
  return {
    id: pool.id,
    name: pool.name,
    description: pool.description || '',
    enabled: pool.enabled,
    backend: pool.backend,
    max_inflight: pool.max_inflight,
    max_inflight_per_user: pool.max_inflight_per_user,
    max_queue_size: pool.max_queue_size,
    max_queue_per_user: pool.max_queue_per_user,
    queue_timeout_ms: pool.queue_timeout_ms,
    queue_policy: pool.queue_policy,
    on_limit: pool.on_limit,
    redis_failure_policy: pool.redis_failure_policy,
    max_context_tokens: pool.max_context_tokens,
    max_context_chars: pool.max_context_chars,
    max_processing_ms: pool.max_processing_ms,
    lease_ms: pool.lease_ms,
    renew_interval_ms: pool.renew_interval_ms,
    schedule_mode: pool.schedule_mode || 'always',
    schedule_timezone: pool.schedule_timezone || defaultScheduleTimezone,
    effective_start_time: pool.effective_start_time || 0,
    effective_end_time: pool.effective_end_time || 0,
    schedule_windows: pool.schedule_windows || '',
    schedule_weekdays:
      firstScheduleWindow?.weekdays?.length > 0
        ? firstScheduleWindow.weekdays
        : [...defaultScheduleWeekdays],
    schedule_start_time: minuteToTimeInput(
      firstScheduleWindow?.start_minute ?? 540
    ),
    schedule_end_time: minuteToTimeInput(
      firstScheduleWindow?.end_minute ?? 1080
    ),
  }
}

export function poolFormToPayload(
  values: ChannelFlowPoolFormValues
): ChannelFlowPoolPayload {
  return {
    id: values.id,
    name: values.name.trim(),
    description: values.description.trim(),
    enabled: values.enabled,
    backend: values.backend,
    max_inflight: values.max_inflight,
    max_inflight_per_user: values.max_inflight_per_user,
    max_queue_size: values.max_queue_size,
    max_queue_per_user: values.max_queue_per_user,
    queue_timeout_ms: values.queue_timeout_ms,
    queue_policy: values.queue_policy,
    on_limit: values.on_limit,
    redis_failure_policy: values.redis_failure_policy,
    max_context_tokens: values.max_context_tokens,
    max_context_chars: values.max_context_chars,
    max_processing_ms: values.max_processing_ms,
    lease_ms: values.lease_ms,
    renew_interval_ms: values.renew_interval_ms,
    schedule_mode: values.schedule_mode,
    schedule_timezone:
      values.schedule_timezone.trim() || defaultScheduleTimezone,
    effective_start_time:
      values.schedule_mode === 'datetime_range'
        ? values.effective_start_time
        : 0,
    effective_end_time:
      values.schedule_mode === 'datetime_range' ? values.effective_end_time : 0,
    schedule_windows: buildScheduleWindows(values),
  }
}

export function bindingFormToPayload(
  values: ChannelFlowBindingFormValues
): ChannelFlowBindingPayload {
  return {
    channel_id: values.channel_id,
    upstream_model: values.upstream_model.trim(),
    match_mode: values.match_mode,
    enabled: values.enabled,
  }
}
