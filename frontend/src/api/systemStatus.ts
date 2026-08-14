import { api } from '@/api/console'
import { invalidResponse, isRecord } from '@/api/contracts'

const endpoint = '/api/next/dashboard/system'

export type DashboardSystemAvailability = 'online' | 'degraded'

export interface SystemNetworkSample {
  timestamp: number
  tx_bytes_per_second: number
  rx_bytes_per_second: number
}

export interface SystemStatusSnapshot {
  status: DashboardSystemAvailability
  scope: 'current_node'
  sampled_at: number
  cpu_percent: number | null
  memory_used_bytes: number | null
  memory_total_bytes: number | null
  disk_used_bytes: number | null
  disk_total_bytes: number | null
  network_tx_bytes_per_second: number | null
  network_rx_bytes_per_second: number | null
  network_series: SystemNetworkSample[]
  api_success_rate_24h: number | null
  version: string
}

function finiteNumber(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value))
    invalidResponse(endpoint)
  return value
}

function nonNegativeNumber(value: unknown): number {
  const parsed = finiteNumber(value)
  if (parsed < 0) invalidResponse(endpoint)
  return parsed
}

function nullableNumber(value: unknown, nonNegative = false): number | null {
  if (value === null) return null
  return nonNegative ? nonNegativeNumber(value) : finiteNumber(value)
}

function timestamp(value: unknown): number {
  const parsed = nonNegativeNumber(value)
  if (!Number.isSafeInteger(parsed) || parsed === 0) invalidResponse(endpoint)
  return parsed
}

export function parseSystemStatus(value: unknown): SystemStatusSnapshot {
  if (!isRecord(value)) invalidResponse(endpoint)
  if (value.status !== 'online' && value.status !== 'degraded')
    invalidResponse(endpoint)
  if (value.scope !== 'current_node') invalidResponse(endpoint)
  if (!Array.isArray(value.network_series)) invalidResponse(endpoint)
  if (typeof value.version !== 'string' || value.version.trim() === '')
    invalidResponse(endpoint)

  const networkSeries = value.network_series.map((sample) => {
    if (!isRecord(sample)) invalidResponse(endpoint)
    return {
      timestamp: timestamp(sample.timestamp),
      tx_bytes_per_second: nonNegativeNumber(sample.tx_bytes_per_second),
      rx_bytes_per_second: nonNegativeNumber(sample.rx_bytes_per_second),
    }
  })
  if (networkSeries.length > 12) invalidResponse(endpoint)

  const parsed: SystemStatusSnapshot = {
    status: value.status,
    scope: value.scope,
    sampled_at: timestamp(value.sampled_at),
    cpu_percent: nullableNumber(value.cpu_percent),
    memory_used_bytes: nullableNumber(value.memory_used_bytes, true),
    memory_total_bytes: nullableNumber(value.memory_total_bytes, true),
    disk_used_bytes: nullableNumber(value.disk_used_bytes, true),
    disk_total_bytes: nullableNumber(value.disk_total_bytes, true),
    network_tx_bytes_per_second: nullableNumber(
      value.network_tx_bytes_per_second,
      true
    ),
    network_rx_bytes_per_second: nullableNumber(
      value.network_rx_bytes_per_second,
      true
    ),
    network_series: networkSeries,
    api_success_rate_24h: nullableNumber(value.api_success_rate_24h),
    version: value.version,
  }
  if (
    parsed.status === 'online' &&
    (parsed.cpu_percent === null ||
      parsed.memory_used_bytes === null ||
      parsed.memory_total_bytes === null ||
      parsed.memory_total_bytes === 0 ||
      parsed.disk_used_bytes === null ||
      parsed.disk_total_bytes === null ||
      parsed.disk_total_bytes === 0 ||
      parsed.network_tx_bytes_per_second === null ||
      parsed.network_rx_bytes_per_second === null)
  ) {
    invalidResponse(endpoint)
  }
  return parsed
}

export async function getSystemStatus(
  signal?: AbortSignal
): Promise<SystemStatusSnapshot> {
  return parseSystemStatus(
    await api.get<unknown>(endpoint, undefined, { signal })
  )
}
