/*
Copyright (C) 2026 DeepRouter
SPDX-License-Identifier: AGPL-3.0-or-later
*/
import fs from 'node:fs'
import path from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '@/lib/api'
import {
  emitMarketplaceEvent,
  getDownloadLeaderboardSkills,
  getSavedSkills,
  getMarketplaceRailSkills,
  getMarketplaceSkills,
  recordMarketplaceSkillEvent,
  saveSkill,
  skillDownloadURL,
  unsaveSkill,
} from '../api'

vi.mock('@/lib/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
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

  it('passes DR-90 rail parameters to the marketplace list API', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({
      data: {
        data: [],
        pagination: { page: 1, limit: 6, total: 0, has_next: false },
      },
    })

    await getMarketplaceRailSkills('trending', {
      query: 'growth',
      category: 'writing',
      plan: 'free',
      kidsSafeOnly: true,
    })

    expect(api.get).toHaveBeenCalledWith(
      '/api/v1/marketplace/skills',
      expect.objectContaining({
        params: expect.objectContaining({
          rail: 'trending',
          page: 1,
          limit: 6,
          query: 'growth',
          category: 'writing',
          plan: 'free',
          kids_safe: true,
        }),
      })
    )
  })

  it('requests download leaderboards with window and category filters', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({
      data: {
        data: [],
        pagination: { page: 1, limit: 6, total: 0, has_next: false },
      },
    })

    await getDownloadLeaderboardSkills({
      window: '7d',
      category: 'writing',
      limit: 6,
    })

    expect(api.get).toHaveBeenCalledWith(
      '/api/v1/marketplace/leaderboards/downloads',
      expect.objectContaining({
        params: expect.objectContaining({
          window: '7d',
          category: 'writing',
          limit: 6,
        }),
      })
    )
  })

  it('records marketplace events through the existing skill-scoped endpoint', async () => {
    vi.mocked(api.post).mockResolvedValueOnce({})

    await emitMarketplaceEvent({
      event_type: 'skill_impression',
      skill_id: 'writing-helper',
      entry_point: 'trending',
    })

    expect(api.post).toHaveBeenCalledWith(
      '/api/v1/marketplace/skills/writing-helper/events',
      {
        event_type: 'skill_impression',
        entry_point: 'trending',
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

  it('renders DR-93 detail instructions from the detail payload', () => {
    const source = fs.readFileSync(
      path.resolve(process.cwd(), 'src/features/marketplace/skill-detail.tsx'),
      'utf8'
    )

    expect(source).toContain("t('Download and usage')")
    expect(source).toContain('detail.instructions.download_instructions')
    expect(source).toContain('detail.instructions.usage_instructions')
    expect(source).toContain('detail.instructions.prerequisites')
    expect(source).toContain('detail.instructions.quickstart')
    expect(source).toContain('detail.instructions.example_io')
  })

  it('loads saved skills from the Saved list endpoint', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: { data: [] } })

    await getSavedSkills()

    expect(api.get).toHaveBeenCalledWith(
      '/api/v1/marketplace/saved-skills',
      expect.objectContaining({ skipErrorHandler: true })
    )
  })

  it('saves and unsaves skills with entry-point attribution', async () => {
    vi.mocked(api.post).mockResolvedValueOnce({})
    vi.mocked(api.delete).mockResolvedValueOnce({})

    await saveSkill('writing helper', 'marketplace_card')
    await unsaveSkill('writing helper', 'saved_list')

    expect(api.post).toHaveBeenCalledWith(
      '/api/v1/marketplace/skills/writing%20helper/save',
      undefined,
      expect.objectContaining({
        params: { entry_point: 'marketplace_card' },
        skipErrorHandler: true,
      })
    )
    expect(api.delete).toHaveBeenCalledWith(
      '/api/v1/marketplace/skills/writing%20helper/save',
      expect.objectContaining({
        params: { entry_point: 'saved_list' },
        skipErrorHandler: true,
      })
    )
  })
})
