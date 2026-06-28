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
import {
  DownloadSkillError,
  extractDownloadError,
  filenameFromContentDisposition,
  isSafeDownloadUrl,
} from './download-utils'
import type {
  MarketplaceEventPayload,
  MarketplaceFilters,
  MarketplaceListResponse,
  MarketplaceSkill,
  MySkill,
  PublicSkillDetail,
  SavedSkill,
  SkillGrowthEntryPoint,
  SkillGrowthEventType,
} from './types'

// Re-export so existing importers (e.g. skill-detail.tsx) keep importing the
// error type from './api'. The implementation now lives in ./download-utils.
export { DownloadSkillError } from './download-utils'
export { skillDownloadURL } from './lib/growth-surfaces'

export interface MarketplaceSkillsParams {
  page?: number
  limit?: number
  sort?: 'name' | 'created_at' | 'featured_rank' | string
  rail?: 'new_week' | 'trending'
  query?: string
  category?: string
  plan?: MarketplaceFilters['plan']
  kids_safe?: boolean
  featured?: boolean
}

export async function getMarketplaceRailSkills(
  rail: 'new_week' | 'trending',
  filters?: Partial<MarketplaceFilters>
): Promise<MarketplaceListResponse<MarketplaceSkill>> {
  return getMarketplaceSkillsWithParams({
    rail,
    page: 1,
    limit: 6,
    query: filters?.query || undefined,
    category: filters?.category || undefined,
    plan:
      filters?.plan != null && filters.plan !== 'all'
        ? filters.plan
        : undefined,
    kids_safe: filters?.kidsSafeOnly || undefined,
  })
}

export async function getMarketplaceSkills(
  filters?: Partial<MarketplaceFilters>,
  page = 1
): Promise<MarketplaceListResponse<MarketplaceSkill>> {
  return getMarketplaceSkillsWithParams({
    page,
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

export async function getMySkills(): Promise<MarketplaceListResponse<MySkill>> {
  const res = await api.get('/api/v1/marketplace/my-skills', {
    skipErrorHandler: true,
  } as Record<string, unknown>)
  return res.data
}

export async function getSavedSkills(): Promise<
  MarketplaceListResponse<SavedSkill>
> {
  const res = await api.get('/api/v1/marketplace/saved-skills', {
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

export async function getMarketplaceSkill(
  idOrSlug: string
): Promise<PublicSkillDetail> {
  const res = await api.get(
    '/api/v1/marketplace/skills/' + encodeURIComponent(idOrSlug),
    { skipErrorHandler: true } as Record<string, unknown>
  )
  return res.data?.data ?? res.data
}

/**
 * Download a Skill package zip. `downloadCtaUrl` must be the backend-provided
 * `download_cta.url` (not constructed on the frontend). Goes through the axios
 * `api` client so the `New-Api-User` header is attached — a native `<a download>`
 * would omit it and be rejected by SkillUserAuth. On failure throws a
 * DownloadSkillError carrying the backend `error.code`.
 */
export async function downloadSkillPackage(
  downloadCtaUrl: string,
  fallbackSlug: string
): Promise<void> {
  if (!isSafeDownloadUrl(downloadCtaUrl)) {
    throw new DownloadSkillError('DOWNLOAD_UNAVAILABLE')
  }

  let res
  try {
    res = await api.get(downloadCtaUrl, {
      responseType: 'blob',
      skipErrorHandler: true,
    } as Record<string, unknown>)
  } catch (error) {
    const data = (error as { response?: { data?: unknown } })?.response?.data
    throw await extractDownloadError(data)
  }

  const filename = filenameFromContentDisposition(
    res.headers?.['content-disposition'],
    fallbackSlug
  )
  const objectUrl = URL.createObjectURL(res.data as Blob)
  try {
    const anchor = document.createElement('a')
    anchor.href = objectUrl
    anchor.download = filename
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

export async function removeMySkill(skillId: string): Promise<void> {
  await api.delete(
    `/api/v1/marketplace/my-skills/${encodeURIComponent(skillId)}`,
    {
      skipErrorHandler: true,
    } as Record<string, unknown>
  )
}

export async function saveSkill(
  skillId: string,
  entryPoint: SkillGrowthEntryPoint = 'skill_detail'
): Promise<void> {
  await api.post(
    `/api/v1/marketplace/skills/${encodeURIComponent(skillId)}/save`,
    undefined,
    {
      params: { entry_point: entryPoint },
      skipErrorHandler: true,
    } as Record<string, unknown>
  )
}

export async function unsaveSkill(
  skillId: string,
  entryPoint: SkillGrowthEntryPoint = 'skill_detail'
): Promise<void> {
  await api.delete(
    `/api/v1/marketplace/skills/${encodeURIComponent(skillId)}/save`,
    {
      params: { entry_point: entryPoint },
      skipErrorHandler: true,
    } as Record<string, unknown>
  )
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
