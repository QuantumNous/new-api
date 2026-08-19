import type {
  DrawingLogItem,
  LogItem,
  LogType,
  OperationLogItem,
  OperationLogKind,
  RelayTaskLogItem,
  TokenSummary,
} from '@/types/console'

import {
  invalidResponse,
  isRecord,
  parsePage,
  parseStringArray,
  requiredInteger,
  requiredNumber,
  requiredString,
} from './contracts'
import type { PageResult } from './types'

export interface UsageRow {
  model_name: string
  created_at: number
  count: number
  quota: number
  token_used: number
}

export interface PaymentMethodInfo {
  name: string
  type: string
  color?: string
  min_topup?: number
}

export interface TopupInfo {
  enable_online_topup: boolean
  enable_redemption: boolean
  pay_methods: PaymentMethodInfo[]
  min_topup: number
  amount_options: number[]
}

function optionalBoolean(value: unknown, endpoint: string): boolean {
  if (value === undefined) return false
  if (typeof value !== 'boolean') invalidResponse(endpoint)
  return value
}

export function parseUserModels(value: unknown): string[] {
  const endpoint = '/api/user/models'
  if (Array.isArray(value)) return parseStringArray(value, endpoint)
  if (isRecord(value) && Array.isArray(value.models)) {
    return parseStringArray(value.models, endpoint)
  }
  return invalidResponse(endpoint)
}

export interface PricingModelContract {
  model_name: string
  description: string
  icon: string
  tags: string
  vendor_id: number
  quota_type: number
  model_ratio: number
  model_price: number
  owner_by: string
  completion_ratio: number
  cache_ratio: number | null
  create_cache_ratio: number | null
  enable_groups: string[]
  supported_endpoint_types: string[]
  billing_mode: string
}

export interface PerfModelSummaryContract {
  model_name: string
  avg_latency_ms: number
  success_rate: number
  avg_tps: number
}

export function parsePricingModels(value: unknown): PricingModelContract[] {
  const endpoint = '/api/pricing'
  if (!Array.isArray(value)) invalidResponse(endpoint)
  return value.map((item) => {
    if (!isRecord(item)) invalidResponse(endpoint)
    const endpoints = item.supported_endpoint_types ?? []
    const groups = item.enable_groups ?? []
    if (
      !Array.isArray(endpoints) ||
      endpoints.some((entry) => typeof entry !== 'string') ||
      !Array.isArray(groups) ||
      groups.some((entry) => typeof entry !== 'string')
    ) {
      invalidResponse(endpoint)
    }
    const cacheRatio =
      item.cache_ratio === undefined || item.cache_ratio === null
        ? null
        : requiredNumber(item.cache_ratio, endpoint)
    const createCacheRatio =
      item.create_cache_ratio === undefined || item.create_cache_ratio === null
        ? null
        : requiredNumber(item.create_cache_ratio, endpoint)
    return {
      model_name: requiredString(item.model_name, endpoint, false),
      description: requiredString(item.description ?? '', endpoint),
      icon: requiredString(item.icon ?? '', endpoint),
      tags: requiredString(item.tags ?? '', endpoint),
      vendor_id: requiredInteger(item.vendor_id ?? 0, endpoint),
      quota_type: requiredInteger(item.quota_type, endpoint),
      model_ratio: requiredNumber(item.model_ratio ?? 0, endpoint),
      model_price: requiredNumber(item.model_price ?? 0, endpoint),
      owner_by: requiredString(item.owner_by ?? '', endpoint),
      completion_ratio: requiredNumber(item.completion_ratio ?? 0, endpoint),
      cache_ratio: cacheRatio,
      create_cache_ratio: createCacheRatio,
      enable_groups: [...groups],
      supported_endpoint_types: [...endpoints],
      billing_mode: requiredString(item.billing_mode ?? '', endpoint),
    }
  })
}

export function parsePerfMetricsSummary(
  value: unknown
): PerfModelSummaryContract[] {
  const endpoint = '/api/perf-metrics/summary'
  if (!isRecord(value) || !Array.isArray(value.models)) {
    invalidResponse(endpoint)
  }
  return value.models.map((item) => {
    if (!isRecord(item)) invalidResponse(endpoint)
    return {
      model_name: requiredString(item.model_name, endpoint, false),
      avg_latency_ms: requiredInteger(item.avg_latency_ms, endpoint),
      success_rate: requiredNumber(item.success_rate, endpoint),
      avg_tps: requiredNumber(item.avg_tps, endpoint),
    }
  })
}

export interface LogStatContract {
  total_requests: number
  total_quota: number
  today_requests: number
  today_quota: number
}

export function parseLogStat(value: unknown): LogStatContract {
  const endpoint = '/api/log/self/stat'
  if (!isRecord(value)) invalidResponse(endpoint)
  return {
    total_requests: requiredInteger(value.total_requests, endpoint),
    total_quota: requiredInteger(value.total_quota, endpoint),
    today_requests: requiredInteger(value.today_requests, endpoint),
    today_quota: requiredInteger(value.today_quota, endpoint),
  }
}

function parseToken(value: unknown, endpoint: string): TokenSummary {
  if (!isRecord(value)) invalidResponse(endpoint)
  const group = requiredString(value.group ?? '', endpoint)
  const allowIps = value.allow_ips
  if (
    allowIps !== undefined &&
    allowIps !== null &&
    typeof allowIps !== 'string'
  ) {
    invalidResponse(endpoint)
  }
  const limits = requiredString(value.model_limits ?? '', endpoint)
  return {
    id: requiredInteger(value.id, endpoint),
    name: requiredString(value.name, endpoint, false),
    key_preview: requiredString(value.key, endpoint),
    group,
    type: group === 'auto' ? 'auto' : 'manual',
    status: requiredInteger(value.status, endpoint) === 1 ? 1 : 2,
    used_quota: requiredInteger(value.used_quota, endpoint),
    remain_quota: requiredInteger(value.remain_quota, endpoint),
    unlimited: optionalBoolean(value.unlimited_quota, endpoint),
    model_limits: optionalBoolean(value.model_limits_enabled, endpoint)
      ? limits
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean)
      : [],
    ip_limits:
      typeof allowIps === 'string'
        ? allowIps
            .split(/[,\n]/)
            .map((item) => item.trim())
            .filter(Boolean)
        : [],
    rate_limit: 0,
    load_balance: false,
    channels: [],
    expired_time: requiredInteger(value.expired_time, endpoint),
    created_time: requiredInteger(value.created_time, endpoint),
  }
}

export function parseTokenPage(value: unknown): PageResult<TokenSummary> {
  const endpoint = '/api/token/'
  return parsePage(value, endpoint, parseToken)
}

export function parseUsageRows(value: unknown): UsageRow[] {
  const endpoint = '/api/data/self'
  if (!Array.isArray(value)) invalidResponse(endpoint)
  return value.map((item) => {
    if (!isRecord(item)) invalidResponse(endpoint)
    return {
      model_name: requiredString(item.model_name, endpoint, false),
      created_at: requiredInteger(item.created_at, endpoint),
      count: requiredInteger(item.count, endpoint),
      quota: requiredInteger(item.quota, endpoint),
      token_used: requiredInteger(item.token_used, endpoint),
    }
  })
}

export function parseTopupInfo(value: unknown): TopupInfo {
  const endpoint = '/api/next/wallet/config'
  if (!isRecord(value) || !Array.isArray(value.pay_methods)) {
    invalidResponse(endpoint)
  }
  const payMethods = value.pay_methods.map((item) => {
    if (!isRecord(item)) invalidResponse(endpoint)
    const minTopup =
      item.min_topup === undefined ? undefined : Number(item.min_topup)
    if (
      minTopup !== undefined &&
      (!Number.isFinite(minTopup) || minTopup <= 0)
    ) {
      invalidResponse(endpoint)
    }
    return {
      name: requiredString(item.name, endpoint, false),
      type: requiredString(item.type, endpoint, false),
      color: typeof item.color === 'string' ? item.color : undefined,
      min_topup: minTopup,
    }
  })
  const amountOptions = value.amount_options ?? []
  if (!Array.isArray(amountOptions)) invalidResponse(endpoint)
  const parsedAmounts = amountOptions.map((item) =>
    requiredNumber(item, endpoint)
  )
  if (parsedAmounts.some((amount) => amount <= 0)) invalidResponse(endpoint)
  const minTopup = requiredNumber(value.min_topup ?? 1, endpoint)
  if (minTopup <= 0) invalidResponse(endpoint)
  return {
    enable_online_topup: optionalBoolean(value.enable_online_topup, endpoint),
    enable_redemption: optionalBoolean(value.enable_redemption, endpoint),
    pay_methods: payMethods,
    min_topup: minTopup,
    amount_options: parsedAmounts,
  }
}

export function parseRedeemedQuota(value: unknown): number {
  const endpoint = '/api/user/topup'
  if (typeof value === 'number') return requiredInteger(value, endpoint)
  if (isRecord(value) && value.quota !== undefined) {
    return requiredInteger(value.quota, endpoint)
  }
  return invalidResponse(endpoint)
}

const LOG_TYPES: Record<number, LogType> = {
  1: 'topup',
  2: 'consume',
  3: 'manage',
  4: 'system',
  5: 'error',
  6: 'refund',
  7: 'login',
}

function parseLogOther(value: unknown, endpoint: string): LogItem['other'] {
  if (value === undefined || value === null || value === '') return null
  if (isRecord(value)) return value
  if (typeof value === 'string') {
    try {
      const parsed: unknown = JSON.parse(value)
      return isRecord(parsed) ? parsed : value
    } catch {
      return value
    }
  }
  return invalidResponse(endpoint)
}

function parseLog(value: unknown, endpoint: string): LogItem {
  if (!isRecord(value)) invalidResponse(endpoint)
  const numericType = requiredInteger(value.type, endpoint)
  const type = LOG_TYPES[numericType]
  if (!type) invalidResponse(endpoint)
  const other = parseLogOther(value.other, endpoint)
  const firstToken = isRecord(other) ? Number(other.frt) : Number.NaN
  const promptTokens = requiredInteger(value.prompt_tokens, endpoint)
  const completionTokens = requiredInteger(value.completion_tokens, endpoint)
  const latencyMs = requiredInteger(value.use_time, endpoint)
  const latency = latencyMs / 1000
  return {
    id: requiredInteger(value.id, endpoint),
    type,
    token_name: requiredString(value.token_name, endpoint),
    model: requiredString(value.model_name, endpoint),
    channel: requiredString(value.channel_name, endpoint),
    prompt_tokens: promptTokens,
    completion_tokens: completionTokens,
    other,
    quota: requiredInteger(value.quota, endpoint),
    latency,
    first_token_latency: Number.isFinite(firstToken) ? firstToken / 1000 : null,
    request_mode: optionalBoolean(value.is_stream, endpoint)
      ? 'stream'
      : 'sync',
    tps:
      latency > 0 && completionTokens > 0
        ? Math.round((completionTokens / latency) * 100) / 100
        : 0,
    content: requiredString(value.content, endpoint),
    created: requiredInteger(value.created_at, endpoint),
  }
}

export function parseLogPage(value: unknown): PageResult<LogItem> {
  const endpoint = '/api/log/self'
  return parsePage(value, endpoint, parseLog)
}

const OPERATION_LOG_KINDS = new Set<OperationLogKind>([
  'manage',
  'system',
  'login',
])

function optionalOperationString(value: unknown, endpoint: string): string {
  if (value === undefined || value === null) return ''
  return requiredString(value, endpoint)
}

function optionalOperationInteger(
  value: unknown,
  endpoint: string
): number | null {
  if (value === undefined || value === null) return null
  return requiredInteger(value, endpoint)
}

function optionalOperationBoolean(
  value: unknown,
  endpoint: string
): boolean | null {
  if (value === undefined || value === null) return null
  if (typeof value !== 'boolean') invalidResponse(endpoint)
  return value
}

function parseOperationLog(value: unknown, endpoint: string): OperationLogItem {
  if (!isRecord(value) || !isRecord(value.actor)) invalidResponse(endpoint)
  const kind = requiredString(value.kind, endpoint) as OperationLogKind
  if (!OPERATION_LOG_KINDS.has(kind)) invalidResponse(endpoint)

  const params = value.params ?? {}
  if (!isRecord(params)) invalidResponse(endpoint)

  let request: OperationLogItem['request'] = null
  if (value.request !== undefined && value.request !== null) {
    if (!isRecord(value.request)) invalidResponse(endpoint)
    request = {
      method: optionalOperationString(value.request.method, endpoint),
      route: optionalOperationString(value.request.route, endpoint),
      path: optionalOperationString(value.request.path, endpoint),
      status: optionalOperationInteger(value.request.status, endpoint),
      success: optionalOperationBoolean(value.request.success, endpoint),
    }
  }

  return {
    id: requiredInteger(value.id, endpoint),
    created_at: requiredInteger(value.created_at, endpoint),
    kind,
    action: optionalOperationString(value.action, endpoint),
    params: { ...params },
    content: requiredString(value.content, endpoint),
    actor: {
      id: requiredInteger(value.actor.id, endpoint),
      username: requiredString(value.actor.username, endpoint),
      role: optionalOperationInteger(value.actor.role, endpoint),
      auth_method: optionalOperationString(value.actor.auth_method, endpoint),
    },
    ip: optionalOperationString(value.ip, endpoint),
    user_agent: optionalOperationString(value.user_agent, endpoint),
    request,
  }
}

export function parseOperationLogPage(
  value: unknown
): PageResult<OperationLogItem> {
  const endpoint = '/api/next/admin/operation-logs'
  return parsePage(value, endpoint, parseOperationLog)
}

function parseDrawingLog(value: unknown, endpoint: string): DrawingLogItem {
  if (!isRecord(value)) invalidResponse(endpoint)
  return {
    id: requiredInteger(value.id, endpoint),
    mj_id: requiredString(value.mj_id ?? '', endpoint),
    action: requiredString(value.action ?? '', endpoint),
    prompt: requiredString(value.prompt ?? '', endpoint),
    prompt_en: requiredString(value.prompt_en ?? '', endpoint),
    status: requiredString(value.status ?? '', endpoint),
    progress: requiredString(value.progress ?? '', endpoint),
    fail_reason: requiredString(value.fail_reason ?? '', endpoint),
    image_url: requiredString(value.image_url ?? '', endpoint),
    video_url: requiredString(value.video_url ?? '', endpoint),
    quota: requiredInteger(value.quota ?? 0, endpoint),
    submit_time: requiredInteger(value.submit_time ?? 0, endpoint),
    finish_time: requiredInteger(value.finish_time ?? 0, endpoint),
  }
}

export function parseDrawingLogPage(
  value: unknown
): PageResult<DrawingLogItem> {
  const endpoint = '/api/mj/self'
  return parsePage(value, endpoint, parseDrawingLog)
}

function parseRelayTaskLog(value: unknown, endpoint: string): RelayTaskLogItem {
  if (!isRecord(value)) invalidResponse(endpoint)
  return {
    id: requiredInteger(value.id, endpoint),
    task_id: requiredString(value.task_id ?? '', endpoint),
    platform: requiredString(value.platform ?? '', endpoint),
    action: requiredString(value.action ?? '', endpoint),
    status: requiredString(value.status ?? '', endpoint),
    progress: requiredString(value.progress ?? '', endpoint),
    fail_reason: requiredString(value.fail_reason ?? '', endpoint),
    result_url: requiredString(value.result_url ?? '', endpoint),
    quota: requiredInteger(value.quota ?? 0, endpoint),
    submit_time: requiredInteger(value.submit_time ?? 0, endpoint),
    finish_time: requiredInteger(value.finish_time ?? 0, endpoint),
  }
}

export function parseTaskLogPage(value: unknown): PageResult<RelayTaskLogItem> {
  const endpoint = '/api/task/self'
  return parsePage(value, endpoint, parseRelayTaskLog)
}
