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
import {
  normalizeAttribution,
  parseAttributionPayload,
  type AttributionValues,
} from '@/lib/analytics/attribution'

export type UserAttributionDisplay = {
  raw: AttributionValues
  sourceType: string
  badgeLabel: string
  sourceMedium: string
  detail: string
  landingPath: string
  hasAttribution: boolean
}

const ALLOWED_SOURCE_TYPES = new Set([
  'paid',
  'affiliate',
  'utm',
  'organic',
  'referral',
  'direct',
])
const PAID_CLICK_ID_KEYS = new Set([
  'fbclid',
  'gbraid',
  'gclid',
  'msclkid',
  'ttclid',
  'wbraid',
])
const TOOLTIP_RAW_KEYS = new Set([
  'source_type',
  'source',
  'medium',
  'campaign',
  'keyword',
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'aff',
  'gad_campaignid',
  'gad_source',
  ...PAID_CLICK_ID_KEYS,
])

function badgeLabelForSourceType(sourceType: string): string {
  if (sourceType === 'paid') return 'Paid Ads'
  if (sourceType === 'affiliate') return 'Affiliate'
  if (sourceType === 'utm') return 'UTM'
  if (sourceType === 'organic') return 'Organic'
  if (sourceType === 'referral') return 'Referral'
  if (sourceType === 'direct') return 'Direct'
  return 'No source'
}

function hasAttributionSignal(raw: AttributionValues): boolean {
  return Object.entries(raw).some(([key, value]) => {
    if (!value) return false
    if (key === 'source_type') return ALLOWED_SOURCE_TYPES.has(value)
    if (
      key === 'source' ||
      key === 'medium' ||
      key === 'campaign' ||
      key === 'keyword' ||
      key === 'landing_path' ||
      key === 'referrer' ||
      key === 'aff' ||
      key === 'gad_campaignid' ||
      key === 'gad_source'
    ) {
      return true
    }
    return (
      key.startsWith('utm_') ||
      key.startsWith('hsa_') ||
      PAID_CLICK_ID_KEYS.has(key)
    )
  })
}

export function getSafeAttributionTooltipRaw(
  raw: AttributionValues
): AttributionValues {
  return Object.fromEntries(
    Object.entries(raw).filter(
      ([key, value]) => TOOLTIP_RAW_KEYS.has(key) && value
    )
  )
}

export function getUserAttributionDisplay(
  rawAttribution?: string
): UserAttributionDisplay {
  const raw = parseAttributionPayload(rawAttribution)
  if (!hasAttributionSignal(raw)) {
    return {
      raw,
      sourceType: '',
      badgeLabel: 'No source',
      sourceMedium: '',
      detail: '',
      landingPath: '',
      hasAttribution: false,
    }
  }

  const normalized = normalizeAttribution(raw)
  const normalizedSourceType = normalized.source_type || ''
  const sourceType = ALLOWED_SOURCE_TYPES.has(raw.source_type || '')
    ? raw.source_type
    : normalizedSourceType
  const source = raw.source || normalized.source || ''
  const medium = raw.medium || normalized.medium || ''
  const campaign = raw.campaign || normalized.campaign || ''
  const keyword = raw.keyword || normalized.keyword || ''
  const landingPath = raw.landing_path || ''

  return {
    raw: {
      ...raw,
      ...normalized,
    },
    sourceType,
    badgeLabel: badgeLabelForSourceType(sourceType),
    sourceMedium: [source, medium].filter(Boolean).join(' / '),
    detail: [campaign, keyword].filter(Boolean).join(' / '),
    landingPath,
    hasAttribution: true,
  }
}
