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
import type { UpstreamGroup, UpstreamRoute } from './types'

export function getUnroutedUpstreamGroups(
  groups: UpstreamGroup[],
  routes: UpstreamRoute[]
): UpstreamGroup[] {
  const routedGroups = new Set<string>()
  for (const route of routes) {
    if (route.detached || route.state !== 'active') continue
    routedGroups.add(
      `${route.source_id}\u0000${route.external_group_id.trim()}`
    )
  }
  return groups.filter(
    (group) =>
      !routedGroups.has(`${group.source_id}\u0000${group.external_id.trim()}`)
  )
}

export function getUpstreamGroupModels(group: UpstreamGroup): string[] {
  try {
    const parsed: unknown = JSON.parse(group.models)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (value): value is string =>
        typeof value === 'string' && value.trim().length > 0
    )
  } catch {
    return []
  }
}
