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
import { api } from '@/lib/api'
import type {
  MarketplaceEventPayload,
  MarketplaceFilters,
  MarketplaceListResponse,
  MarketplaceSkill,
  MySkill,
  SkillGrowthEntryPoint,
  SkillGrowthEventType,
} from './types'
export { skillDownloadURL } from './lib/growth-surfaces'

export interface MarketplaceSkillsParams {
  page?: number
  limit?: number
  sort?: 'name' | 'created_at' | 'featured_rank' | string
  query?: string
  category?: string
  plan?: MarketplaceFilters['plan']
  kids_safe?: boolean
  featured?: boolean
}

export async function getMarketplaceSkills(
  filters?: Partial<MarketplaceFilters>
): Promise<MarketplaceListResponse<MarketplaceSkill>> {
  return getMarketplaceSkillsWithParams({
    limit: 100,
    sort: 'featured_rank',
    query: filters?.query || undefined,
    category: filters?.category || undefined,
    plan:
      filters?.plan != null && filters.plan !== 'all'
        ? filters.plan
        : undefined,
    kids_safe: filters?.kidsSafeOnly || undefined,
  })
}

export async function getMarketplaceSkillsWithParams(
  params: MarketplaceSkillsParams
): Promise<MarketplaceListResponse<MarketplaceSkill>> {
  const res = await api.get('/api/v1/marketplace/skills', {
    params,
    skipErrorHandler: true,
  } as Record<string, unknown>)
  return res.data
}

export async function getAllMarketplaceSkills(
  filters?: Partial<MarketplaceFilters>
): Promise<MarketplaceListResponse<MarketplaceSkill>> {
  const firstPage = await getMarketplaceSkills(filters)
  const allSkills = [...(firstPage.data ?? [])]
  const pagination = firstPage.pagination
  if (pagination?.has_next) {
    const totalPages = Math.ceil(pagination.total / pagination.limit)
    for (let page = pagination.page + 1; page <= totalPages; page += 1) {
      const nextPage = await getMarketplaceSkillsWithParams({
        page,
        limit: pagination.limit,
        sort: 'featured_rank',
        query: filters?.query || undefined,
        category: filters?.category || undefined,
        plan:
          filters?.plan != null && filters.plan !== 'all'
            ? filters.plan
            : undefined,
        kids_safe: filters?.kidsSafeOnly || undefined,
      })
      allSkills.push(...(nextPage.data ?? []))
      if (nextPage.pagination?.has_next !== true) break
    }
  }
  return {
    ...firstPage,
    data: allSkills,
    pagination:
      firstPage.pagination == null
        ? undefined
        : {
            ...firstPage.pagination,
            page: 1,
            limit: allSkills.length,
            has_next: false,
          },
  }
}

export async function getMySkills(): Promise<MarketplaceListResponse<MySkill>> {
  const res = await api.get('/api/v1/marketplace/my-skills', {
    skipErrorHandler: true,
  } as Record<string, unknown>)
  return res.data
}

export async function emitMarketplaceEvent(
  payload: MarketplaceEventPayload
): Promise<void> {
  await recordMarketplaceSkillEvent(payload.skill_id, {
    event_type: payload.event_type,
    entry_point: payload.entry_point,
  })
}

export async function recordMarketplaceSkillEvent(
  skillId: string,
  event: {
    event_type: SkillGrowthEventType
    entry_point: SkillGrowthEntryPoint
  }
): Promise<void> {
  await api.post(
    `/api/v1/marketplace/skills/${encodeURIComponent(skillId)}/events`,
    event,
    {
      skipErrorHandler: true,
    } as Record<string, unknown>
  )
}
