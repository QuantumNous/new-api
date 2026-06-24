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
  'fbclid',
  'gad_campaignid',
  'gad_source',
  'gbraid',
  'gclid',
  'lng',
  'msclkid',
  'ttclid',
  'wbraid',
])

const ATTRIBUTION_STORAGE_KEY = 'ads:attribution'
const SHARED_ATTRIBUTION_COOKIE_KEY = 'flatkey_ads_attribution'
const PAID_CLICK_IDS = new Set([
  'fbclid',
  'gbraid',
  'gclid',
  'msclkid',
  'ttclid',
  'wbraid',
])
const PAID_UTM_MEDIUMS = new Set([
  'affiliate',
  'cpc',
  'cpm',
  'display',
  'paid',
  'paid-search',
  'paid-social',
  'paid_search',
  'paid_social',
  'ppc',
  'retargeting',
  'sem',
])
const SEARCH_ENGINE_HOSTS: Array<{ source: string; hosts: string[] }> = [
  {
    source: 'google',
    hosts: [
      'google.com',
      'google.com.hk',
      'google.co.jp',
      'google.co.uk',
      'google.de',
      'google.fr',
      'google.com.br',
      'google.co.in',
      'google.com.au',
      'google.ca',
    ],
  },
  { source: 'bing', hosts: ['bing.com'] },
  { source: 'baidu', hosts: ['baidu.com'] },
  { source: 'yahoo', hosts: ['yahoo.com'] },
  { source: 'yandex', hosts: ['yandex.com', 'yandex.ru'] },
  { source: 'duckduckgo', hosts: ['duckduckgo.com'] },
  { source: 'naver', hosts: ['search.naver.com', 'naver.com'] },
  { source: 'sogou', hosts: ['sogou.com'] },
]
const SEARCH_QUERY_KEYS = ['q', 'query', 'p', 'wd', 'word', 'keyword', 'text']

export type AttributionValues = Record<string, string>

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

function getSharedAdsAttribution(): Record<string, string> {
  if (typeof document === 'undefined') {
    return {}
  }

  const cookieString =
    typeof document.cookie === 'string' ? document.cookie : ''
  const prefix = `${SHARED_ATTRIBUTION_COOKIE_KEY}=`
  const cookie = cookieString
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix))

  if (!cookie) {
    return {}
  }

  try {
    return parseAttributionPayload(
      decodeURIComponent(cookie.slice(prefix.length))
    )
  } catch {
    return {}
  }
}

function cleanAttributionValues(values: AttributionValues): AttributionValues {
  return Object.fromEntries(
    Object.entries(values)
      .map(([key, value]) => [key.trim(), value.trim()])
      .filter(([key, value]) => key && value)
  )
}

function detectSearchSource(referrer: string): string {
  if (!referrer) return ''
  try {
    const host = new URL(referrer).hostname.toLowerCase()
    return (
      SEARCH_ENGINE_HOSTS.find((entry) =>
        entry.hosts.some(
          (candidate) => host === candidate || host.endsWith(`.${candidate}`)
        )
      )?.source ?? ''
    )
  } catch {
    return ''
  }
}

function getSearchKeyword(referrer: string): string {
  if (!referrer) return ''
  try {
    const url = new URL(referrer)
    for (const key of SEARCH_QUERY_KEYS) {
      const value = url.searchParams.get(key)?.trim()
      if (value) return value.replace(/\+/g, ' ')
    }
    return ''
  } catch {
    return ''
  }
}

function isExternalReferrer(referrer: string): boolean {
  if (!referrer) return false
  try {
    return new URL(referrer).origin !== window.location.origin
  } catch {
    return false
  }
}

function getSanitizedReferrer(referrer: string): string {
  try {
    const referrerUrl = new URL(referrer)
    return `${referrerUrl.origin}${referrerUrl.pathname}`
  } catch {
    return ''
  }
}

function getPaidSource(values: AttributionValues): string {
  if (values.gclid || values.gbraid || values.wbraid || values.gad_source) {
    return values.utm_source || 'google'
  }
  if (values.msclkid) return values.utm_source || 'microsoft'
  if (values.fbclid) return values.utm_source || 'facebook'
  if (values.ttclid) return values.utm_source || 'tiktok'
  if (Object.keys(values).some((key) => key.startsWith('hsa_'))) {
    return values.utm_source || 'hubspot'
  }
  return values.utm_source || 'ads'
}

function hasPaidAttributionSignal(values: AttributionValues): boolean {
  const medium = values.utm_medium?.toLowerCase()
  return (
    Object.keys(values).some(
      (key) =>
        PAID_CLICK_IDS.has(key) ||
        key === 'gad_campaignid' ||
        key === 'gad_source' ||
        key.startsWith('hsa_')
    ) || Boolean(medium && PAID_UTM_MEDIUMS.has(medium))
  )
}

function hasPaidClickId(values: AttributionValues): boolean {
  return Object.keys(values).some((key) => PAID_CLICK_IDS.has(key))
}

function hasCampaignSignal(values: AttributionValues): boolean {
  return (
    Object.keys(values).some((key) => shouldPreserveQueryKey(key)) ||
    Boolean(values.referrer)
  )
}

export function normalizeAttribution(
  values: AttributionValues
): AttributionValues {
  const cleaned = cleanAttributionValues(values)
  const campaign =
    cleaned.utm_campaign || cleaned.hsa_cam || cleaned.gad_campaignid || ''
  const keyword = cleaned.utm_term || cleaned.hsa_kw || ''

  if (hasPaidAttributionSignal(cleaned)) {
    return {
      source_type: 'paid',
      source: getPaidSource(cleaned),
      medium: hasPaidClickId(cleaned) ? 'cpc' : cleaned.utm_medium || 'cpc',
      campaign,
      keyword,
      is_paid: 'true',
      rule_version: '2026-06-16',
    }
  }

  if (cleaned.utm_source || cleaned.utm_medium || cleaned.utm_campaign) {
    return {
      source_type: 'utm',
      source: cleaned.utm_source || '',
      medium: cleaned.utm_medium || '',
      campaign,
      keyword,
      is_paid: 'false',
      rule_version: '2026-06-16',
    }
  }

  if (cleaned.aff) {
    return {
      source_type: 'affiliate',
      source: cleaned.aff,
      medium: 'affiliate',
      campaign: '',
      keyword: '',
      is_paid: 'false',
      rule_version: '2026-06-16',
    }
  }

  const organicSource = detectSearchSource(cleaned.referrer || '')
  if (organicSource) {
    return {
      source_type: 'organic',
      source: organicSource,
      medium: 'organic',
      campaign: '',
      keyword: cleaned.keyword || getSearchKeyword(cleaned.referrer || ''),
      is_paid: 'false',
      rule_version: '2026-06-16',
    }
  }

  if (cleaned.referrer) {
    return {
      source_type: 'referral',
      source: cleaned.referrer,
      medium: 'referral',
      campaign: '',
      keyword: '',
      is_paid: 'false',
      rule_version: '2026-06-16',
    }
  }

  return {
    source_type: 'direct',
    source: 'direct',
    medium: 'none',
    campaign: '',
    keyword: '',
    is_paid: 'false',
    rule_version: '2026-06-16',
  }
}

export function mergeAttributionValues(
  existing: AttributionValues,
  current: AttributionValues
): AttributionValues {
  const cleanExisting = cleanAttributionValues(existing)
  const cleanCurrent = cleanAttributionValues(current)
  const existingNormalized = normalizeAttribution(cleanExisting)
  const currentNormalized = normalizeAttribution(cleanCurrent)

  if (
    existingNormalized.source_type === 'paid' &&
    currentNormalized.source_type !== 'paid'
  ) {
    return {
      ...cleanExisting,
      ...existingNormalized,
    }
  }

  if (cleanExisting.landing_path && !hasCampaignSignal(cleanCurrent)) {
    return {
      ...cleanExisting,
      ...existingNormalized,
    }
  }

  const merged = {
    ...cleanExisting,
    ...cleanCurrent,
  }
  return {
    ...merged,
    ...normalizeAttribution(merged),
  }
}

export function parseAttributionPayload(raw?: string): AttributionValues {
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {}
    }
    return cleanAttributionValues(
      Object.fromEntries(
        Object.entries(parsed).filter(([, value]) => typeof value === 'string')
      ) as AttributionValues
    )
  } catch {
    return {}
  }
}

export function getAttributionPayload(values: AttributionValues): string {
  const merged = {
    ...cleanAttributionValues(values),
    ...normalizeAttribution(values),
  }
  if (Object.keys(merged).length === 0) {
    return ''
  }
  return JSON.stringify(merged)
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

  const queryAttribution = collectAttributionFromSearch(window.location.search)
  const sharedAttribution = getSharedAdsAttribution()
  const current: AttributionValues = {
    ...(hasCampaignSignal(queryAttribution)
      ? { ...sharedAttribution, ...queryAttribution }
      : { ...queryAttribution, ...sharedAttribution }),
    landing_path:
      hasCampaignSignal(queryAttribution) || !sharedAttribution.landing_path
        ? window.location.pathname
        : sharedAttribution.landing_path,
    captured_at:
      hasCampaignSignal(queryAttribution) || !sharedAttribution.captured_at
        ? new Date().toISOString()
        : sharedAttribution.captured_at,
  }
  if (isExternalReferrer(document.referrer)) {
    const keyword = getSearchKeyword(document.referrer)
    if (keyword) {
      current.keyword = keyword
    }

    const referrer = getSanitizedReferrer(document.referrer)
    if (referrer) {
      current.referrer = referrer
    }
  }

  const merged = mergeAttributionValues(getStoredAdsAttribution(), current)

  try {
    window.localStorage.setItem(ATTRIBUTION_STORAGE_KEY, JSON.stringify(merged))
  } catch {
    // Best-effort attribution should never block navigation.
  }

  return merged
}

export function getAdsAttributionPayload(): string {
  const attribution = captureAdsAttribution()
  return getAttributionPayload(attribution)
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
