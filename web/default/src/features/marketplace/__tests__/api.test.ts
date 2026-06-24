/*
Copyright (C) 2026 DeepRouter
SPDX-License-Identifier: AGPL-3.0-or-later
*/
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '@/lib/api'
import {
  emitMarketplaceEvent,
  getMarketplaceSkills,
  recordMarketplaceSkillEvent,
  skillDownloadURL,
} from '../api'

vi.mock('@/lib/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
  },
}))

describe('Marketplace API review regressions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('passes server-side marketplace filters to the list API', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({
      data: {
        data: [],
        pagination: { page: 1, limit: 100, total: 0, has_next: false },
      },
    })

    await getMarketplaceSkills({
      query: 'writer',
      category: 'writing',
      plan: 'pro',
      status: 'locked',
      kidsSafeOnly: true,
    })

    expect(api.get).toHaveBeenCalledWith(
      '/api/v1/marketplace/skills',
      expect.objectContaining({
        params: expect.objectContaining({
          limit: 100,
          sort: 'featured_rank',
          query: 'writer',
          category: 'writing',
          plan: 'pro',
          kids_safe: true,
        }),
      })
    )
  })

  it('loads only the requested server-filtered page', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({
      data: {
        data: [{ id: 'skill-2' }],
        pagination: { page: 2, limit: 100, total: 201, has_next: true },
      },
    })

    const result = await getMarketplaceSkills(
      {
        query: 'legal',
        category: 'review',
        plan: 'enterprise',
        status: 'locked',
        kidsSafeOnly: false,
      },
      2
    )

    expect(result.data.map((skill) => skill.id)).toEqual(['skill-2'])
    expect(api.get).toHaveBeenCalledWith(
      '/api/v1/marketplace/skills',
      expect.objectContaining({
        params: expect.objectContaining({
          page: 2,
          limit: 100,
          query: 'legal',
          category: 'review',
          plan: 'enterprise',
        }),
      })
    )
    expect(api.get).toHaveBeenCalledTimes(1)
  })

  it('defaults to page one for marketplace list calls', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({
      data: {
        data: [],
        pagination: { page: 1, limit: 100, total: 0, has_next: false },
      },
    })

    await getMarketplaceSkills({
      query: 'legal',
      category: 'review',
      plan: 'enterprise',
      status: 'locked',
      kidsSafeOnly: false,
    })

    expect(api.get).toHaveBeenCalledWith(
      '/api/v1/marketplace/skills',
      expect.objectContaining({
        params: expect.objectContaining({
          page: 1,
          limit: 100,
        }),
      })
    )
  })

  it('records marketplace events through the existing skill-scoped endpoint', async () => {
    vi.mocked(api.post).mockResolvedValueOnce({})

    await emitMarketplaceEvent({
      event_type: 'skill_impression',
      skill_id: 'writing-helper',
      entry_point: 'marketplace_card',
    })

    expect(api.post).toHaveBeenCalledWith(
      '/api/v1/marketplace/skills/writing-helper/events',
      {
        event_type: 'skill_impression',
        entry_point: 'marketplace_card',
      },
      expect.objectContaining({
        skipErrorHandler: true,
      })
    )
  })

  it('keeps the playground growth-surface helpers exported from marketplace api', async () => {
    vi.mocked(api.post).mockResolvedValueOnce({})

    expect(skillDownloadURL('writing helper', 'recommended')).toBe(
      '/api/v1/marketplace/skills/writing%20helper/download?entry_point=recommended'
    )

    await recordMarketplaceSkillEvent('writing helper', {
      event_type: 'skill_detail_view',
      entry_point: 'recommended',
    })

    expect(api.post).toHaveBeenCalledWith(
      '/api/v1/marketplace/skills/writing%20helper/events',
      {
        event_type: 'skill_detail_view',
        entry_point: 'recommended',
      },
      expect.anything()
    )
  })
})
