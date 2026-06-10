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

const ATTRIBUTION_KEYS = new Set([
  'aff',
  'gad_campaignid',
  'gad_source',
  'gbraid',
  'gclid',
  'lng',
  'wbraid',
])

const ATTRIBUTION_STORAGE_KEY = 'ads:attribution'

function shouldPreserveQueryKey(key: string): boolean {
  return (
    ATTRIBUTION_KEYS.has(key) ||
    key.startsWith('utm_') ||
    key.startsWith('hsa_')
  )
}

function collectAttributionFromSearch(search: string): Record<string, string> {
  const values: Record<string, string> = {}
  const current = new URLSearchParams(search)
  for (const [key, value] of current.entries()) {
    if (shouldPreserveQueryKey(key) && value) {
      values[key] = value
    }
  }
  return values
}

function hasPaidAttributionSignal(values: Record<string, string>): boolean {
  return Object.keys(values).some(
    (key) =>
      key === 'gad_campaignid' ||
      key === 'gad_source' ||
      key === 'gbraid' ||
      key === 'gclid' ||
      key === 'wbraid' ||
      key.startsWith('utm_') ||
      key.startsWith('hsa_')
  )
}

export function getStoredAdsAttribution(): Record<string, string> {
  if (typeof window === 'undefined') {
    return {}
  }
  try {
    const raw = window.localStorage.getItem(ATTRIBUTION_STORAGE_KEY)
    if (!raw) {
      return {}
    }
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {}
    }
    return Object.fromEntries(
      Object.entries(parsed).filter(
        ([, value]) => typeof value === 'string' && value.length > 0
      )
    ) as Record<string, string>
  } catch {
    return {}
  }
}

export function captureAdsAttribution(): Record<string, string> {
  if (typeof window === 'undefined') {
    return {}
  }

  const current = collectAttributionFromSearch(window.location.search)
  if (Object.keys(current).length === 0) {
    return getStoredAdsAttribution()
  }

  const merged = {
    ...getStoredAdsAttribution(),
    ...current,
    landing_path: window.location.pathname,
    captured_at: new Date().toISOString(),
  }

  try {
    window.localStorage.setItem(ATTRIBUTION_STORAGE_KEY, JSON.stringify(merged))
  } catch {
    // Best-effort attribution should never block navigation.
  }

  return merged
}

export function getAdsAttributionPayload(): string {
  const attribution = captureAdsAttribution()
  return hasPaidAttributionSignal(attribution) ? JSON.stringify(attribution) : ''
}

export function buildAttributionHref(path: string): string {
  if (typeof window === 'undefined') {
    return path
  }

  const preserved = new URLSearchParams()
  const attribution = {
    ...getStoredAdsAttribution(),
    ...collectAttributionFromSearch(window.location.search),
  }

  for (const [key, value] of Object.entries(attribution)) {
    if (shouldPreserveQueryKey(key) && value) {
      preserved.set(key, value)
    }
  }

  const query = preserved.toString()
  return query ? `${path}?${query}` : path
}
