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

function badgeLabelForSourceType(sourceType: string): string {
  if (sourceType === 'paid') return 'Paid Ads'
  if (sourceType === 'utm') return 'UTM'
  if (sourceType === 'organic') return 'Organic'
  if (sourceType === 'referral') return 'Referral'
  if (sourceType === 'direct') return 'Direct'
  return 'No source'
}

export function getUserAttributionDisplay(
  rawAttribution?: string
): UserAttributionDisplay {
  const raw = parseAttributionPayload(rawAttribution)
  if (Object.keys(raw).length === 0) {
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
  const sourceType = raw.source_type || normalized.source_type || ''
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
