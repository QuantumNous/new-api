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
const PERF_METRICS_UNAVAILABLE_KEY = 'perf-metrics:endpoint-unavailable'

export function isPerfMetricsFeatureAvailable(status?: unknown): boolean {
  return isEnabledPerfMetricsSetting(readPerfMetricsSetting(status))
}

export function isCachedPerfMetricsFeatureAvailable(): boolean {
  try {
    if (typeof window === 'undefined') return false
    const raw = window.localStorage.getItem('status')
    return raw ? isPerfMetricsFeatureAvailable(JSON.parse(raw)) : false
  } catch {
    return false
  }
}

export function isPerfMetricsEndpointUnavailable(): boolean {
  try {
    return (
      typeof window !== 'undefined' &&
      window.sessionStorage.getItem(PERF_METRICS_UNAVAILABLE_KEY) === '1'
    )
  } catch {
    return false
  }
}

export function markPerfMetricsEndpointUnavailable(): void {
  try {
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem(PERF_METRICS_UNAVAILABLE_KEY, '1')
    }
  } catch {
    /* empty */
  }
}

export function isMissingPerfMetricsEndpoint(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false

  const response = (error as { response?: unknown }).response
  if (!response || typeof response !== 'object') return false

  const status = (response as { status?: unknown }).status
  const data = (response as { data?: unknown }).data
  const message = extractErrorMessage(data)

  return (
    status === 404 &&
    (typeof message !== 'string' || message.includes('/api/perf-metrics'))
  )
}

function extractErrorMessage(data: unknown): unknown {
  if (!data || typeof data !== 'object') return undefined

  return (
    (data as { error?: { message?: unknown }; message?: unknown }).error
      ?.message ?? (data as { message?: unknown }).message
  )
}

function readPerfMetricsSetting(status: unknown): unknown {
  if (!status || typeof status !== 'object') return undefined

  const record = status as {
    data?: unknown
    perf_metrics_setting?: unknown
  }
  if (record.perf_metrics_setting !== undefined) {
    return parseSetting(record.perf_metrics_setting)
  }

  if (record.data && typeof record.data === 'object') {
    return parseSetting(
      (record.data as { perf_metrics_setting?: unknown }).perf_metrics_setting
    )
  }

  return undefined
}

function parseSetting(setting: unknown): unknown {
  if (typeof setting !== 'string') return setting

  try {
    return JSON.parse(setting)
  } catch {
    return undefined
  }
}

function isEnabledPerfMetricsSetting(setting: unknown): boolean {
  if (!setting || typeof setting !== 'object') return false
  return (setting as { enabled?: unknown }).enabled === true
}
