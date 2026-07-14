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
import type { ModelRoutePolicy } from '../types'

export type ModelRoutePolicyGroup = {
  requestedModel: string
  policies: ModelRoutePolicy[]
}

export function sortModelRoutePolicies(
  policies: ModelRoutePolicy[]
): ModelRoutePolicy[] {
  return [...policies].sort((left, right) => {
    if (left.manual_priority !== right.manual_priority) {
      return right.manual_priority - left.manual_priority
    }
    return left.channel_id - right.channel_id
  })
}

export function groupModelRoutePolicies(
  policies: ModelRoutePolicy[],
  modelKeyword: string,
  exactMatch: boolean
): ModelRoutePolicyGroup[] {
  const groups = new Map<string, ModelRoutePolicy[]>()
  for (const policy of policies) {
    const existing = groups.get(policy.requested_model)
    if (existing) existing.push(policy)
    else groups.set(policy.requested_model, [policy])
  }

  const keyword = modelKeyword.trim().toLowerCase()
  return [...groups.entries()]
    .filter(([requestedModel, rows]) => {
      if (!keyword) return true
      return rows.some((row) => {
        const values = [requestedModel, row.effective_model || requestedModel]
        if (exactMatch) {
          return values.some((value) => value.toLowerCase() === keyword)
        }
        return values.some((value) => value.toLowerCase().includes(keyword))
      })
    })
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([requestedModel, rows]) => ({
      requestedModel,
      policies: sortModelRoutePolicies(rows),
    }))
}

export function filterPolicyGroupByChannel(
  policies: ModelRoutePolicy[],
  channelKeyword: string
): ModelRoutePolicy[] {
  const keyword = channelKeyword.trim().toLowerCase()
  if (!keyword) return policies
  return policies.filter(
    (policy) =>
      String(policy.channel_id).includes(keyword) ||
      (policy.channel_name || '').toLowerCase().includes(keyword)
  )
}

export function movePolicyWithinGroup(
  policies: ModelRoutePolicy[],
  activeChannelID: number,
  overChannelID: number
): ModelRoutePolicy[] {
  const from = policies.findIndex(
    (policy) => policy.channel_id === activeChannelID
  )
  const to = policies.findIndex((policy) => policy.channel_id === overChannelID)
  if (from < 0 || to < 0 || from === to) return policies
  const next = [...policies]
  const [moved] = next.splice(from, 1)
  next.splice(to, 0, moved)
  return next
}

export function replaceModelPolicyGroup(
  policies: ModelRoutePolicy[],
  requestedModel: string,
  replacement: ModelRoutePolicy[]
): ModelRoutePolicy[] {
  const first = policies.findIndex(
    (policy) => policy.requested_model === requestedModel
  )
  const remaining = policies.filter(
    (policy) => policy.requested_model !== requestedModel
  )
  if (first < 0) return [...remaining, ...replacement]
  remaining.splice(first, 0, ...replacement)
  return remaining
}

export function suggestTopPriority(
  policies: ModelRoutePolicy[],
  lead = 100
): number | null {
  const currentMax = Math.max(
    ...policies.map((policy) => policy.manual_priority)
  )
  if (currentMax >= 9999) return null
  return Math.min(9999, currentMax + lead)
}
