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
} from '../types'

const nonNegativeInt = z.coerce.number().int().min(0)
const positiveInt = z.coerce.number().int().min(1)
const nonNegativeMs = z.coerce.number().int().min(0)

export const channelFlowPoolFormSchema = z.object({
  id: z.number().default(0),
  name: z.string().trim().min(1, 'Pool name is required'),
  description: z.string().trim().default(''),
  enabled: z.boolean(),
  backend: z.enum(['memory', 'redis']),
  max_inflight: nonNegativeInt,
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
  if (!pool) return defaultPoolFormValues
  return {
    id: pool.id,
    name: pool.name,
    description: pool.description || '',
    enabled: pool.enabled,
    backend: pool.backend,
    max_inflight: pool.max_inflight,
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

