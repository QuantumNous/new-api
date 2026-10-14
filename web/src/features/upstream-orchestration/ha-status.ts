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
import type { UpstreamRoute } from './types'

export type UpstreamHAStatus = {
  authoritative: boolean
  nonHaModels: string[]
}

export function calculateUpstreamHA(routes: UpstreamRoute[]): UpstreamHAStatus {
  let authoritative = true
  const sourcesByModel = new Map<string, Set<number>>()
  for (const route of routes) {
    if (route.state !== 'active' || route.detached) continue
    if (route.effective_models == null) {
      authoritative = false
      continue
    }
    for (const model of route.effective_models) {
      const modelName = model.trim()
      if (!modelName) continue
      const key = `${modelName}:${route.protocol}`
      const sourceIDs = sourcesByModel.get(key) ?? new Set<number>()
      sourceIDs.add(route.source_id)
      sourcesByModel.set(key, sourceIDs)
    }
  }
  return {
    authoritative,
    nonHaModels: authoritative
      ? [...sourcesByModel.entries()]
          .filter(([, sourceIDs]) => sourceIDs.size < 2)
          .map(([key]) => key)
          .sort()
      : [],
  }
}
