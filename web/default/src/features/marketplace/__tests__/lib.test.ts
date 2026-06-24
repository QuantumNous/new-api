/*
Copyright (C) 2026 DeepRouter
SPDX-License-Identifier: AGPL-3.0-or-later
*/
import { describe, expect, it } from 'vitest'
import {
  filterMarketplaceSkills,
  marketplaceEmptyState,
  resolveMarketplaceSkill,
  skillStatusFilterValue,
} from '../lib'
import type { MarketplaceFilters, MarketplaceSkill } from '../types'

const baseFilters: MarketplaceFilters = {
  query: '',
  category: '',
  plan: 'all',
  status: 'all',
  kidsSafeOnly: false,
}

const freeSkill: MarketplaceSkill = {
  id: 'free-skill',
  slug: 'free-skill',
  name: 'Free Writer',
  category: 'writing',
  short_description: 'Draft short content',
  required_plan: 'free',
  is_kids_safe: true,
}

const proSkill: MarketplaceSkill = {
  id: 'pro-skill',
  slug: 'pro-skill',
  name: 'Pro Analyst',
  category: 'analysis',
  short_description: 'Deep analysis workflow',
  required_plan: 'pro',
}

const enterpriseSkill: MarketplaceSkill = {
  id: 'enterprise-skill',
  slug: 'enterprise-skill',
  name: 'Enterprise Review',
  category: 'legal',
  short_description: 'Contract review',
  required_plan: 'enterprise',
}

describe('Marketplace state matrix', () => {
  it('uses login CTA for anonymous visitors', () => {
    const resolved = resolveMarketplaceSkill(freeSkill, null)
    expect(resolved.availability.cta).toBe('login')
    expect(resolved.availability.locked).toBe(true)
  })

  it('uses enable CTA for logged-in free users on free skills', () => {
    const resolved = resolveMarketplaceSkill(freeSkill, {
      id: 1,
      username: 'free',
      role: 1,
      group: 'default',
    })
    expect(resolved.availability.cta).toBe('enable')
    expect(skillStatusFilterValue(resolved)).toBe('available')
  })

  it('uses use CTA when the API says the skill is enabled', () => {
    const resolved = resolveMarketplaceSkill(
      {
        ...freeSkill,
        availability: { enabled: true, cta: 'use', locked: false },
      },
      { id: 1, username: 'free', role: 1, group: 'default' }
    )
    expect(resolved.availability.cta).toBe('use')
    expect(skillStatusFilterValue(resolved)).toBe('enabled')
  })

  it('uses upgrade CTA for pro skills viewed by free users', () => {
    const resolved = resolveMarketplaceSkill(proSkill, {
      id: 1,
      username: 'free',
      role: 1,
      group: 'default',
    })
    expect(resolved.availability.cta).toBe('upgrade')
    expect(skillStatusFilterValue(resolved)).toBe('locked')
  })

  it('uses contact sales CTA for enterprise skills viewed by non-enterprise users', () => {
    const resolved = resolveMarketplaceSkill(enterpriseSkill, {
      id: 1,
      username: 'pro',
      role: 1,
      group: 'pro',
    })
    expect(resolved.availability.cta).toBe('contact_sales')
    expect(skillStatusFilterValue(resolved)).toBe('locked')
  })

  it('preserves server-provided renew and quota CTA decisions', () => {
    const renew = resolveMarketplaceSkill(
      {
        ...proSkill,
        availability: {
          enabled: true,
          locked: true,
          lock_code: 'subscription_inactive',
          cta: 'renew',
        },
      },
      { id: 1, username: 'pro', role: 1, group: 'pro' }
    )
    const quota = resolveMarketplaceSkill(
      {
        ...freeSkill,
        availability: {
          enabled: true,
          locked: true,
          lock_code: 'quota_exceeded',
          cta: 'upgrade',
        },
      },
      { id: 1, username: 'free', role: 1, group: 'default' }
    )
    expect(renew.availability.cta).toBe('renew')
    expect(quota.availability.cta).toBe('upgrade')
  })
})

describe('Marketplace filtering and empty states', () => {
  const skills = [
    resolveMarketplaceSkill(freeSkill, {
      id: 1,
      username: 'free',
      role: 1,
      group: 'default',
    }),
    resolveMarketplaceSkill(proSkill, {
      id: 1,
      username: 'free',
      role: 1,
      group: 'default',
    }),
  ]

  it('keeps server-filtered query, category, plan, and Kids Safe results intact', () => {
    expect(
      filterMarketplaceSkills(skills, { ...baseFilters, query: 'writer' })
    ).toHaveLength(2)
    expect(
      filterMarketplaceSkills(skills, { ...baseFilters, category: 'analysis' })
    ).toHaveLength(2)
    expect(
      filterMarketplaceSkills(skills, { ...baseFilters, plan: 'pro' })
    ).toHaveLength(2)
    expect(
      filterMarketplaceSkills(skills, { ...baseFilters, kidsSafeOnly: true })
    ).toHaveLength(2)
  })

  it('filters client-side only by personalized status', () => {
    expect(
      filterMarketplaceSkills(skills, { ...baseFilters, status: 'locked' })
    ).toHaveLength(1)
  })

  it('selects specific empty states for search, category, Kids, errors, and empty catalogs', () => {
    expect(
      marketplaceEmptyState(0, 0, { ...baseFilters, query: 'missing' }, false)
    ).toBe('search')
    expect(
      marketplaceEmptyState(0, 0, { ...baseFilters, category: 'coding' }, false)
    ).toBe('category')
    expect(
      marketplaceEmptyState(0, 0, { ...baseFilters, kidsSafeOnly: true }, false)
    ).toBe('kids')
    expect(
      marketplaceEmptyState(0, 0, { ...baseFilters, status: 'locked' }, false)
    ).toBe('filters')
    expect(marketplaceEmptyState(2, 0, baseFilters, true)).toBe('load-error')
    expect(marketplaceEmptyState(0, 0, baseFilters, false)).toBe('marketplace')
  })
})
