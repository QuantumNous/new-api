import type {
  LogItem,
  LogType,
  TokenSummary,
  TopupRecord,
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
  enable_stripe_topup: boolean
  enable_creem_topup: boolean
  enable_waffo_topup: boolean
  enable_waffo_pancake_topup: boolean
  enable_redemption: boolean
  pay_methods: PaymentMethodInfo[]
  min_topup: number
  stripe_min_topup: number
  waffo_min_topup: number
  waffo_pancake_min_topup: number
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
  const endpoint = '/api/user/topup/info'
  if (!isRecord(value) || !Array.isArray(value.pay_methods)) {
    invalidResponse(endpoint)
  }
  const payMethods = value.pay_methods.map((item) => {
    if (!isRecord(item)) invalidResponse(endpoint)
    const minTopup =
      item.min_topup === undefined ? undefined : Number(item.min_topup)
    if (minTopup !== undefined && !Number.isFinite(minTopup)) {
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
  return {
    enable_online_topup: optionalBoolean(value.enable_online_topup, endpoint),
    enable_stripe_topup: optionalBoolean(value.enable_stripe_topup, endpoint),
    enable_creem_topup: optionalBoolean(value.enable_creem_topup, endpoint),
    enable_waffo_topup: optionalBoolean(value.enable_waffo_topup, endpoint),
    enable_waffo_pancake_topup: optionalBoolean(
      value.enable_waffo_pancake_topup,
      endpoint
    ),
    enable_redemption: optionalBoolean(value.enable_redemption, endpoint),
    pay_methods: payMethods,
    min_topup: requiredNumber(value.min_topup ?? 1, endpoint),
    stripe_min_topup: requiredNumber(value.stripe_min_topup ?? 1, endpoint),
    waffo_min_topup: requiredNumber(value.waffo_min_topup ?? 1, endpoint),
    waffo_pancake_min_topup: requiredNumber(
      value.waffo_pancake_min_topup ?? 1,
      endpoint
    ),
    amount_options: parsedAmounts,
  }
}

function normalizeTopupStatus(value: string): TopupRecord['status'] {
  if (value === 'success') return 'success'
  if (value === 'pending') return 'pending'
  return 'failed'
}

function parseTopup(value: unknown, endpoint: string): TopupRecord {
  if (!isRecord(value)) invalidResponse(endpoint)
  const provider = requiredString(
    value.payment_provider ?? value.payment_method,
    endpoint,
    false
  )
  const method =
    provider === 'stripe' || provider === 'creem'
      ? provider
      : provider === 'redeem'
        ? 'redeem'
        : 'epay'
  return {
    id: requiredInteger(value.id, endpoint),
    trade_no: requiredString(value.trade_no, endpoint),
    amount: requiredNumber(value.money, endpoint),
    money: requiredInteger(value.amount, endpoint),
    method,
    provider,
    payment_method: requiredString(value.payment_method ?? provider, endpoint),
    status: normalizeTopupStatus(requiredString(value.status, endpoint)),
    created: requiredInteger(value.create_time, endpoint),
  }
}

export function parseTopupPage(value: unknown): PageResult<TopupRecord> {
  const endpoint = '/api/user/topup/self'
  return parsePage(value, endpoint, parseTopup)
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
