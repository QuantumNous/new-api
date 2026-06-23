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
import type { AuthUser } from '@/stores/auth-store'
import type { MarketplaceEmptyStateKind } from './components/empty-state'
import type {
  MarketplaceFilters,
  MarketplaceSkill,
  MarketplaceStatusFilter,
  SkillCTAAction,
  SkillPlan,
} from './types'

export type ResolvedMarketplaceSkill = MarketplaceSkill & {
  availability: NonNullable<MarketplaceSkill['availability']>
}

export function userPlan(user: AuthUser | null): SkillPlan | null {
  if (user == null) return null
  if (user.group === 'enterprise') return 'enterprise'
  if (user.group === 'pro') return 'pro'
  return 'free'
}

function planLevel(plan: SkillPlan): number {
  switch (plan) {
    case 'enterprise':
      return 2
    case 'pro':
      return 1
    case 'free':
      return 0
  }
}

function planSatisfied(required: SkillPlan, current: SkillPlan): boolean {
  return planLevel(current) >= planLevel(required)
}

function normalizeCTA(action?: string | null): SkillCTAAction | null {
  switch (action) {
    case 'download':
    case 'enable':
    case 'use':
    case 'upgrade':
    case 'renew':
    case 'contact_sales':
    case 'login':
    case 'unavailable':
      return action
    default:
      return null
  }
}

export function resolveMarketplaceSkill(
  skill: MarketplaceSkill,
  user: AuthUser | null
): ResolvedMarketplaceSkill {
  const existing = skill.availability ?? {}
  const existingCTA = normalizeCTA(existing.cta)
  if (existingCTA != null) {
    return {
      ...skill,
      availability: {
        ...existing,
        cta: existingCTA,
      },
    }
  }

  if (user == null) {
    return {
      ...skill,
      availability: {
        ...existing,
        enabled: null,
        locked: true,
        lock_code: 'auth_required',
        cta: 'login',
      },
    }
  }

  if (skill.status === 'archived' || skill.status === 'draft') {
    return {
      ...skill,
      availability: {
        ...existing,
        locked: true,
        lock_code: 'skill_not_published',
        cta: 'unavailable',
      },
    }
  }

  if (skill.status === 'deprecated' && existing.enabled !== true) {
    return {
      ...skill,
      availability: {
        ...existing,
        enabled: false,
        locked: true,
        lock_code: 'skill_not_published',
        cta: 'unavailable',
      },
    }
  }

  const currentPlan = userPlan(user) ?? 'free'
  if (!planSatisfied(skill.required_plan, currentPlan)) {
    return {
      ...skill,
      availability: {
        ...existing,
        enabled: existing.enabled ?? false,
        locked: true,
        lock_code: 'plan_required',
        cta: skill.required_plan === 'enterprise' ? 'contact_sales' : 'upgrade',
      },
    }
  }

  if (existing.enabled === true || existing.executable === true) {
    return {
      ...skill,
      availability: {
        ...existing,
        enabled: true,
        executable: existing.executable ?? true,
        locked: existing.locked ?? false,
        cta: 'use',
      },
    }
  }

  return {
    ...skill,
    availability: {
      ...existing,
      enabled: false,
      locked: existing.locked ?? false,
      cta: 'enable',
    },
  }
}

export function skillStatusFilterValue(
  skill: ResolvedMarketplaceSkill
): MarketplaceStatusFilter {
  if (
    skill.availability.cta === 'unavailable' ||
    skill.status === 'archived' ||
    skill.status === 'draft'
  ) {
    return 'unavailable'
  }
  if (skill.availability.enabled === true) return 'enabled'
  if (
    skill.availability.locked === true &&
    skill.availability.cta !== 'enable'
  ) {
    return 'locked'
  }
  return 'available'
}

export function filterMarketplaceSkills(
  skills: ResolvedMarketplaceSkill[],
  filters: MarketplaceFilters
): ResolvedMarketplaceSkill[] {
  return skills.filter((skill) => {
    if (
      filters.status !== 'all' &&
      skillStatusFilterValue(skill) !== filters.status
    ) {
      return false
    }
    return true
  })
}

export function marketplaceEmptyState(
  totalCount: number,
  filteredCount: number,
  filters: MarketplaceFilters,
  isError: boolean
): MarketplaceEmptyStateKind {
  if (isError) return 'load-error'
  if (filteredCount > 0) return 'marketplace'
  if (filters.kidsSafeOnly) return 'kids'
  if (filters.query.trim().length > 0) return 'search'
  if (filters.category) return 'category'
  if (filters.plan !== 'all' || filters.status !== 'all') return 'filters'
  if (totalCount === 0) return 'marketplace'
  return 'filters'
}
