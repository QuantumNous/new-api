import { createApiClient } from './createClient'
import { httpTransport } from './httpTransport'
import { ApiError } from './types'

export interface PublicStatus {
  version?: string
  system_name?: string
  logo?: string
  docs_link?: string
  register_enabled?: boolean
  user_agreement_enabled?: boolean
  privacy_policy_enabled?: boolean
  uptime_kuma_enabled?: boolean
  HeaderNavModules?: unknown
}

export interface PricingModel {
  id: number
}

export interface UptimeMonitor {
  uptime: number
  status: number
}

export interface UptimeGroup {
  monitors: UptimeMonitor[]
}

const publicClient = createApiClient(httpTransport)

function invalidResponse(endpoint: string): never {
  throw new ApiError(`Invalid public API response: ${endpoint}`, {
    status: 502,
  })
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

export function parsePublicStatus(value: unknown): PublicStatus {
  if (!isRecord(value)) invalidResponse('/api/status')

  const result: PublicStatus = {}
  const stringKeys = ['version', 'system_name', 'logo', 'docs_link'] as const
  const booleanKeys = [
    'register_enabled',
    'user_agreement_enabled',
    'privacy_policy_enabled',
    'uptime_kuma_enabled',
  ] as const

  for (const key of stringKeys) {
    if (value[key] !== undefined && typeof value[key] !== 'string') {
      invalidResponse('/api/status')
    }
    if (typeof value[key] === 'string') result[key] = value[key]
  }
  for (const key of booleanKeys) {
    if (value[key] !== undefined && typeof value[key] !== 'boolean') {
      invalidResponse('/api/status')
    }
    if (typeof value[key] === 'boolean') result[key] = value[key]
  }
  if (value.HeaderNavModules !== undefined) {
    result.HeaderNavModules = value.HeaderNavModules
  }
  return result
}

export function parsePricingModels(value: unknown): PricingModel[] {
  if (!Array.isArray(value)) invalidResponse('/api/pricing')
  if (
    value.some((item) => !isRecord(item) || !Number.isFinite(Number(item.id)))
  ) {
    invalidResponse('/api/pricing')
  }
  return value.map((item) => ({
    id: Number((item as Record<string, unknown>).id),
  }))
}

export function parseUptimeGroups(value: unknown): UptimeGroup[] {
  if (!Array.isArray(value)) invalidResponse('/api/uptime/status')
  return value.map((group) => {
    if (!isRecord(group) || !Array.isArray(group.monitors)) {
      invalidResponse('/api/uptime/status')
    }
    const monitors = group.monitors.map((monitor) => {
      if (
        !isRecord(monitor) ||
        !Number.isFinite(Number(monitor.uptime)) ||
        !Number.isFinite(Number(monitor.status))
      ) {
        invalidResponse('/api/uptime/status')
      }
      return {
        uptime: Number(monitor.uptime),
        status: Number(monitor.status),
      }
    })
    return { monitors }
  })
}

export const publicApi = {
  async status(signal?: AbortSignal) {
    return parsePublicStatus(
      await publicClient.get<unknown>('/api/status', undefined, { signal })
    )
  },
  async notice(signal?: AbortSignal) {
    const value = await publicClient.get<unknown>('/api/notice', undefined, {
      signal,
    })
    if (typeof value !== 'string') invalidResponse('/api/notice')
    return value
  },
  async pricing(signal?: AbortSignal) {
    return parsePricingModels(
      await publicClient.get<unknown>('/api/pricing', undefined, { signal })
    )
  },
  async uptime(signal?: AbortSignal) {
    return parseUptimeGroups(
      await publicClient.get<unknown>('/api/uptime/status', undefined, {
        signal,
      })
    )
  },
}
