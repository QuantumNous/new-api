import { createApiClient } from './createClient'
import { publicHttpTransport } from './httpTransport'
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
  frontend_capabilities?: FrontendCapabilities
  next_frontend_enabled?: boolean
  start_time?: number
  github_oauth?: boolean
  github_client_id?: string
  discord_oauth?: boolean
  discord_client_id?: string
  linuxdo_oauth?: boolean
  linuxdo_client_id?: string
  oidc_enabled?: boolean
  oidc_client_id?: string
  oidc_authorization_endpoint?: string
  wechat_login?: boolean
  telegram_oauth?: boolean
  custom_oauth_providers?: CustomOAuthProviderInfo[]
}

export interface CustomOAuthProviderInfo {
  id: number
  name: string
  slug: string
  icon?: string
  client_id: string
  authorization_endpoint: string
  scopes?: string
}

export type FeatureStatus = 'live' | 'disabled'
export type FrontendCapabilities = Record<string, FeatureStatus>

export interface PricingModel {
  model_name: string
}

export interface UptimeMonitor {
  uptime: number
  status: number
}

export interface UptimeGroup {
  monitors: UptimeMonitor[]
}

export interface HomeRequestMetrics {
  available: boolean
  requests_24h: number | null
  hourly_requests: number[]
  generated_at: number
}

const publicClient = createApiClient(publicHttpTransport)

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
    'next_frontend_enabled',
    'github_oauth',
    'discord_oauth',
    'linuxdo_oauth',
    'oidc_enabled',
    'wechat_login',
    'telegram_oauth',
  ] as const

  for (const key of stringKeys) {
    if (value[key] !== undefined && typeof value[key] !== 'string') {
      invalidResponse('/api/status')
    }
    if (typeof value[key] === 'string') result[key] = value[key]
  }
  if (value.start_time !== undefined) {
    if (
      typeof value.start_time !== 'number' ||
      !Number.isFinite(value.start_time)
    ) {
      invalidResponse('/api/status')
    }
    result.start_time = value.start_time
  }
  const oauthStringKeys = [
    'github_client_id',
    'discord_client_id',
    'linuxdo_client_id',
    'oidc_client_id',
    'oidc_authorization_endpoint',
  ] as const
  for (const key of oauthStringKeys) {
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
  if (value.frontend_capabilities !== undefined) {
    if (!isRecord(value.frontend_capabilities)) invalidResponse('/api/status')
    const capabilities: FrontendCapabilities = {}
    for (const [key, status] of Object.entries(value.frontend_capabilities)) {
      if (status !== 'live' && status !== 'disabled') {
        invalidResponse('/api/status')
      }
      capabilities[key] = status
    }
    result.frontend_capabilities = capabilities
  }
  if (value.custom_oauth_providers !== undefined) {
    if (
      !Array.isArray(value.custom_oauth_providers) ||
      value.custom_oauth_providers.some(
        (item) =>
          !isRecord(item) ||
          !Number.isInteger(item.id) ||
          typeof item.name !== 'string' ||
          typeof item.slug !== 'string' ||
          typeof item.client_id !== 'string' ||
          typeof item.authorization_endpoint !== 'string'
      )
    ) {
      invalidResponse('/api/status')
    }
    result.custom_oauth_providers = value.custom_oauth_providers.map(
      (item) => ({
        id: Number((item as Record<string, unknown>).id),
        name: String((item as Record<string, unknown>).name),
        slug: String((item as Record<string, unknown>).slug),
        icon:
          typeof (item as Record<string, unknown>).icon === 'string'
            ? String((item as Record<string, unknown>).icon)
            : undefined,
        client_id: String((item as Record<string, unknown>).client_id),
        authorization_endpoint: String(
          (item as Record<string, unknown>).authorization_endpoint
        ),
        scopes:
          typeof (item as Record<string, unknown>).scopes === 'string'
            ? String((item as Record<string, unknown>).scopes)
            : undefined,
      })
    )
  }
  return result
}

export function parsePricingModels(value: unknown): PricingModel[] {
  if (!Array.isArray(value)) invalidResponse('/api/pricing')
  if (
    value.some(
      (item) =>
        !isRecord(item) ||
        typeof item.model_name !== 'string' ||
        item.model_name.length === 0
    )
  ) {
    invalidResponse('/api/pricing')
  }
  return value.map((item) => ({
    model_name: String((item as Record<string, unknown>).model_name),
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

export function parseHomeRequestMetrics(value: unknown): HomeRequestMetrics {
  if (
    !isRecord(value) ||
    typeof value.available !== 'boolean' ||
    !Number.isInteger(value.generated_at) ||
    !Array.isArray(value.hourly_requests) ||
    value.hourly_requests.length !== 24 ||
    value.hourly_requests.some(
      (count) => !Number.isInteger(count) || Number(count) < 0
    ) ||
    (value.requests_24h !== null &&
      (!Number.isInteger(value.requests_24h) || Number(value.requests_24h) < 0))
  ) {
    invalidResponse('/api/home/metrics')
  }
  if (value.available !== (value.requests_24h !== null)) {
    invalidResponse('/api/home/metrics')
  }

  const hourlyRequests = value.hourly_requests.map(Number)
  const requests24h =
    value.requests_24h === null ? null : Number(value.requests_24h)
  if (
    requests24h !== null &&
    hourlyRequests.reduce((sum, count) => sum + count, 0) !== requests24h
  ) {
    invalidResponse('/api/home/metrics')
  }

  return {
    available: value.available,
    requests_24h: requests24h,
    hourly_requests: hourlyRequests,
    generated_at: Number(value.generated_at),
  }
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
  async homeMetrics(signal?: AbortSignal) {
    return parseHomeRequestMetrics(
      await publicClient.get<unknown>('/api/home/metrics', undefined, {
        signal,
      })
    )
  },
}
