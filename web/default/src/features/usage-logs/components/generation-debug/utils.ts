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
import { formatBillingCurrencyFromUSD } from '@/lib/currency'

import type {
  CacheStatus,
  GenerationDebugCacheBoundary,
  GenerationDebugMessage,
  GenerationDebugPromptUnit,
  GenerationDebugRawValue,
  PromptDebugData,
} from './types'

export function formatGenerationLatency(milliseconds: number): string {
  if (!Number.isFinite(milliseconds) || milliseconds <= 0) return '--'
  if (milliseconds < 1000) return `${Math.round(milliseconds)} ms`
  return `${(milliseconds / 1000).toFixed(2)} s`
}

export function formatGenerationThroughput(tokensPerSecond: number): string {
  if (!Number.isFinite(tokensPerSecond) || tokensPerSecond <= 0) return '--'
  return `${tokensPerSecond.toFixed(1)} tok/s`
}

export function formatGenerationCost(
  providerCost: unknown,
  chargedCost: number
): string {
  const cost = resolveCostValue(providerCost, chargedCost)
  if (!Number.isFinite(cost) || cost < 0) return '--'
  return formatBillingCurrencyFromUSD(cost, {
    digitsLarge: 4,
    digitsSmall: 6,
    abbreviate: false,
  })
}

function resolveCostValue(providerCost: unknown, chargedCost: number): number {
  if (typeof providerCost === 'number') return providerCost
  if (typeof providerCost === 'string') {
    const parsed = Number(providerCost)
    if (Number.isFinite(parsed)) return parsed
  }
  return chargedCost
}

export function formatGenerationTokens(tokens: number): string {
  if (!Number.isFinite(tokens)) return '0'
  return Math.max(0, Math.round(tokens)).toLocaleString()
}

export function stringifyDebugValue(value: unknown): string {
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

export function roleCountsFromMessages(
  messages: GenerationDebugMessage[]
): Record<string, number> {
  return messages.reduce<Record<string, number>>((counts, message) => {
    const role = message.role || 'unknown'
    counts[role] = (counts[role] ?? 0) + 1
    return counts
  }, {})
}

export function roleVariant(
  role: string
): 'blue' | 'green' | 'purple' | 'amber' | 'neutral' {
  switch (role.toLowerCase()) {
    case 'assistant':
      return 'blue'
    case 'user':
      return 'green'
    case 'system':
    case 'developer':
      return 'purple'
    case 'tool':
    case 'function':
      return 'amber'
    default:
      return 'neutral'
  }
}

export function cacheStatusVariant(
  status: CacheStatus | string | undefined
): 'green' | 'amber' | 'neutral' | 'blue' | 'grey' | 'orange' {
  switch (status) {
    case 'hit':
      return 'green'
    case 'partial':
      return 'amber'
    case 'miss':
      return 'neutral'
    case 'write':
      return 'blue'
    default:
      return 'grey'
  }
}

export function cacheStatusLabel(
  status: CacheStatus | string | undefined,
  t: (key: string, options?: { defaultValue: string }) => string
): string {
  if (status === 'hit') return t('cache_status.hit', { defaultValue: 'hit' })
  if (status === 'partial') {
    return t('cache_status.partial', { defaultValue: 'partial' })
  }
  if (status === 'miss') return t('cache_status.miss', { defaultValue: 'miss' })
  if (status === 'write') {
    return t('cache_status.write', { defaultValue: 'write' })
  }
  return t('cache_status.unknown', { defaultValue: 'unknown' })
}

export function confidenceLabel(
  confidence: string | undefined,
  t: (key: string, options?: { defaultValue: string }) => string
): string {
  if (confidence === 'exact') {
    return t('confidence.exact', { defaultValue: 'exact' })
  }
  if (confidence === 'inferred') {
    return t('confidence.inferred', { defaultValue: 'inferred' })
  }
  if (confidence === 'estimated') {
    return t('confidence.estimated', { defaultValue: 'estimated' })
  }
  return confidence || t('Unknown')
}

export function roleLabel(
  role: string | undefined,
  t: (key: string, options?: { defaultValue: string }) => string
): string {
  if (role === 'system') return t('role.system', { defaultValue: 'system' })
  if (role === 'developer') {
    return t('role.developer', { defaultValue: 'developer' })
  }
  if (role === 'user') return t('role.user', { defaultValue: 'user' })
  if (role === 'assistant') {
    return t('role.assistant', { defaultValue: 'assistant' })
  }
  if (role === 'tool') return t('role.tool', { defaultValue: 'tool' })
  if (role === 'function') {
    return t('role.function', { defaultValue: 'function' })
  }
  return role || t('Unknown')
}

export function unitKindLabel(
  kind: string | undefined,
  t: (key: string, options?: { defaultValue: string }) => string
): string {
  if (kind === 'text') return t('unit_kind.text', { defaultValue: 'text' })
  if (kind === 'tool_schema') {
    return t('unit_kind.tool_schema', { defaultValue: 'tool schema' })
  }
  if (kind === 'tool_choice') {
    return t('unit_kind.tool_choice', { defaultValue: 'tool choice' })
  }
  if (kind === 'response_format') {
    return t('unit_kind.response_format', { defaultValue: 'response format' })
  }
  if (kind === 'metadata') {
    return t('unit_kind.metadata', { defaultValue: 'metadata' })
  }
  return kind || t('Unknown')
}

export function sourceLabel(
  source: string | undefined,
  t: (key: string, options?: { defaultValue: string }) => string
): string {
  if (source === 'legacy_message') {
    return t('source.legacy_message', { defaultValue: 'legacy message' })
  }
  if (source === 'legacy_message_flag') {
    return t('source.legacy_message_flag', {
      defaultValue: 'legacy message flag',
    })
  }
  if (source === 'cache_boundary_inference') {
    return t('source.cache_boundary_inference', {
      defaultValue: 'cache boundary inference',
    })
  }
  if (source === 'local_estimate') {
    return t('source.local_estimate', { defaultValue: 'local estimate' })
  }
  if (source === 'provider_usage') {
    return t('source.provider_usage', { defaultValue: 'provider usage' })
  }
  if (source === 'billing_inference') {
    return t('source.billing_inference', {
      defaultValue: 'billing inference',
    })
  }
  return source || t('Unknown')
}

export function finishReasonLabel(
  reason: string | undefined,
  t: (key: string, options?: { defaultValue: string }) => string
): string {
  if (reason === 'tool_calls') {
    return t('finish_reason.tool_calls', { defaultValue: 'tool calls' })
  }
  if (reason === 'stop') {
    return t('finish_reason.stop', { defaultValue: 'stop' })
  }
  if (reason === 'length') {
    return t('finish_reason.length', { defaultValue: 'length' })
  }
  if (reason === 'content_filter') {
    return t('finish_reason.content_filter', {
      defaultValue: 'content filter',
    })
  }
  return reason || '--'
}

export function normalizedPromptUnits(
  prompt: PromptDebugData | undefined
): GenerationDebugPromptUnit[] {
  if (prompt?.units && prompt.units.length > 0) return prompt.units
  let cumulative = 0
  return (prompt?.messages ?? []).map((message) => {
    const start = cumulative
    const estimatedTokens = message.estimated_tokens ?? 0
    cumulative += estimatedTokens
    return {
      index: message.index,
      message_index: message.index,
      path: `messages[${message.index}].content`,
      role: message.role,
      kind: 'text',
      content_preview: message.content,
      estimated_tokens: estimatedTokens,
      cumulative_start: start,
      cumulative_end: cumulative,
      cache_overlap_tokens: message.cached ? estimatedTokens : 0,
      cache_status: message.cached ? 'hit' : 'unknown',
      token_source: 'local_estimate',
      cache_source: message.cached ? 'legacy_message_flag' : 'legacy_message',
      confidence: message.cached ? 'inferred' : 'estimated',
    }
  })
}

export function derivePromptCacheView(
  units: GenerationDebugPromptUnit[],
  promptTokens: number,
  cachedTokens: number,
  existingBoundary?: GenerationDebugCacheBoundary
): {
  units: GenerationDebugPromptUnit[]
  boundary?: GenerationDebugCacheBoundary
} {
  if (units.length === 0 || promptTokens <= 0) {
    return { units, boundary: existingBoundary }
  }
  const hitRate = Math.min(1, Math.max(0, cachedTokens / promptTokens))
  const estimatedTotal = units.reduce(
    (total, unit) => Math.max(total, unit.cumulative_end || 0),
    0
  )
  const estimatedCachedTokens = Math.round(hitRate * estimatedTotal)
  let breakUnit: GenerationDebugPromptUnit | undefined
  const resolvedUnits = units.map((unit) => {
    const overlap = Math.min(
      Math.max(estimatedCachedTokens - unit.cumulative_start, 0),
      unit.estimated_tokens
    )
    let cacheStatus: CacheStatus = 'partial'
    if (unit.estimated_tokens === 0) {
      cacheStatus =
        (estimatedCachedTokens > 0 &&
          unit.cumulative_start <= estimatedCachedTokens) ||
        (estimatedCachedTokens > 0 && estimatedCachedTokens >= estimatedTotal)
          ? 'hit'
          : 'miss'
    } else if (overlap <= 0) {
      cacheStatus = 'miss'
    } else if (overlap >= unit.estimated_tokens) {
      cacheStatus = 'hit'
    }
    if (
      !breakUnit &&
      unit.estimated_tokens > 0 &&
      unit.cumulative_end > estimatedCachedTokens
    ) {
      breakUnit = unit
    }
    return {
      ...unit,
      cache_overlap_tokens: overlap,
      cache_status: cacheStatus,
      cache_source: 'cache_boundary_inference',
      confidence: 'inferred' as const,
    }
  })
  if (!breakUnit) breakUnit = units.at(-1)
  return {
    units: resolvedUnits,
    boundary: {
      ...existingBoundary,
      cached_tokens: cachedTokens,
      prompt_tokens: promptTokens,
      cache_hit_rate: existingBoundary?.cache_hit_rate ?? hitRate,
      estimated_cached_tokens:
        existingBoundary?.estimated_cached_tokens ?? estimatedCachedTokens,
      break_unit_index:
        existingBoundary?.break_unit_index ?? breakUnit?.index ?? -1,
      break_unit_path: existingBoundary?.break_unit_path ?? breakUnit?.path,
      break_unit_role: existingBoundary?.break_unit_role ?? breakUnit?.role,
      break_offset_tokens:
        existingBoundary?.break_offset_tokens ??
        (breakUnit
          ? Math.min(
              breakUnit.estimated_tokens,
              Math.max(estimatedCachedTokens - breakUnit.cumulative_start, 0)
            )
          : 0),
      source: existingBoundary?.source ?? 'cache_boundary_inference',
      confidence: existingBoundary?.confidence ?? 'inferred',
    },
  }
}

export function rawValueContent(
  value: GenerationDebugRawValue | undefined
): unknown {
  return value?.value
}
