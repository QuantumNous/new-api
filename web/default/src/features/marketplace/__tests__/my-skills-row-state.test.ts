/*
Copyright (C) 2026 DeepRouter
SPDX-License-Identifier: AGPL-3.0-or-later
*/
// Coverage: DR-59 My Skills pure row-state mapper — action-driving rowState
// (lock beats deprecation), independent isDeprecated decoration, and the
// mutually-exclusive filter buckets (Deprecated > Locked > Available).
import { describe, expect, it } from 'vitest'
import {
  deriveRowState,
  formatMySkillDate,
  resolveMySkillRow,
  rowMatchesFilter,
  skillKey,
  type MySkillFilter,
} from '../lib/my-skills-row-state'
import type { MySkill } from '../types'

function mySkill(overrides: Partial<MySkill> = {}): MySkill {
  return {
    id: 'skill-1',
    skill_id: 'skill-1',
    slug: 'writing-helper',
    name: 'Writing Helper',
    category: 'writing',
    required_plan: 'free',
    skill_status: 'published',
    enabled: true,
    enabled_at: '2026-06-15T00:00:00Z',
    last_used_at: null,
    availability: { executable: true, locked: false, cta: 'use' },
    ...overrides,
  }
}

describe('deriveRowState / resolveMySkillRow', () => {
  it('executable published row → executable / available / Use / openable', () => {
    const v = resolveMySkillRow(mySkill())
    expect(v.rowState).toBe('executable')
    expect(v.filterBucket).toBe('available')
    expect(v.canUse).toBe(true)
    expect(v.canOpen).toBe(true)
    expect(v.isDeprecated).toBe(false)
    expect(v.lockReason).toBeNull()
    expect(v.warningKey).toBeNull()
  })

  it('plan-locked row → plan_locked / locked / no Use', () => {
    const v = resolveMySkillRow(
      mySkill({
        required_plan: 'pro',
        availability: { locked: true, lock_code: 'SKILL_PLAN_REQUIRED', cta: 'upgrade' },
      })
    )
    expect(v.rowState).toBe('plan_locked')
    expect(v.filterBucket).toBe('locked')
    expect(v.canUse).toBe(false)
    // Published but plan-locked: name still opens Detail (Detail loads for
    // published), only Use is withheld.
    expect(v.canOpen).toBe(true)
    expect(v.lockReason).toBe('plan_required')
  })

  it('subscription-inactive row → plan_locked with subscription_inactive reason', () => {
    const v = resolveMySkillRow(
      mySkill({
        required_plan: 'pro',
        availability: { locked: true, lock_code: 'SKILL_SUBSCRIPTION_INACTIVE', cta: 'renew' },
      })
    )
    expect(v.rowState).toBe('plan_locked')
    expect(v.lockReason).toBe('subscription_inactive')
    expect(v.canUse).toBe(false)
  })

  it('quota-exceeded row → quota_exceeded / locked / no Use (also the free_quota=0 backend edge)', () => {
    const v = resolveMySkillRow(
      mySkill({
        availability: { locked: true, lock_code: 'SKILL_QUOTA_EXCEEDED', cta: 'upgrade' },
      })
    )
    expect(v.rowState).toBe('quota_exceeded')
    expect(v.filterBucket).toBe('locked')
    expect(v.canUse).toBe(false)
    expect(v.lockReason).toBe('quota_exceeded')
  })

  it('kids-blocked row → kids_blocked / locked / no Use', () => {
    const v = resolveMySkillRow(
      mySkill({
        availability: { locked: true, lock_code: 'SKILL_KIDS_MODE_BLOCKED', cta: 'unavailable' },
      })
    )
    expect(v.rowState).toBe('kids_blocked')
    expect(v.filterBucket).toBe('locked')
    expect(v.canUse).toBe(false)
    expect(v.lockReason).toBe('kids_blocked')
  })

  it('archived row → archived / locked / Remove only', () => {
    const v = resolveMySkillRow(
      mySkill({
        skill_status: 'archived',
        availability: { locked: true, lock_code: 'SKILL_NOT_PUBLISHED', cta: 'unavailable' },
      })
    )
    expect(v.rowState).toBe('archived')
    expect(v.filterBucket).toBe('locked')
    expect(v.canUse).toBe(false)
    expect(v.canOpen).toBe(false) // archived Detail is unavailable
    expect(v.canRemove).toBe(true)
    expect(v.lockReason).toBe('unavailable')
  })

  it('deprecated + executable → deprecated / Deprecated filter / warning, but NO Use and NOT openable (Detail is published-only)', () => {
    const v = resolveMySkillRow(
      mySkill({
        skill_status: 'deprecated',
        availability: { executable: true, locked: false, cta: 'use' },
      })
    )
    expect(v.rowState).toBe('deprecated')
    expect(v.isDeprecated).toBe(true)
    expect(v.filterBucket).toBe('deprecated')
    // Use → Skill Detail, which is published-only; deprecated must not Use/open.
    expect(v.canUse).toBe(false)
    expect(v.canOpen).toBe(false)
    expect(v.warningKey).not.toBeNull()
  })

  it('deprecated + plan-locked → plan_locked rowState, Deprecated filter, no Use, warning shown', () => {
    const v = resolveMySkillRow(
      mySkill({
        skill_status: 'deprecated',
        required_plan: 'pro',
        availability: { locked: true, lock_code: 'SKILL_PLAN_REQUIRED', cta: 'upgrade' },
      })
    )
    expect(v.rowState).toBe('plan_locked') // lock beats deprecation for actions
    expect(v.isDeprecated).toBe(true)
    expect(v.filterBucket).toBe('deprecated') // but filter follows skill_status
    expect(v.canUse).toBe(false)
    expect(v.lockReason).toBe('plan_required')
    expect(v.warningKey).not.toBeNull()
  })

  it('deprecated + NOT executable (unlocked) → unavailable, no Use, still Deprecated filter + warning', () => {
    const v = resolveMySkillRow(
      mySkill({
        skill_status: 'deprecated',
        availability: { executable: false, locked: false, cta: 'unavailable' },
      })
    )
    // Deprecation never licenses Use — only availability.executable does.
    expect(v.rowState).toBe('unavailable')
    expect(v.canUse).toBe(false)
    expect(v.isDeprecated).toBe(true)
    expect(v.filterBucket).toBe('deprecated')
    expect(v.warningKey).not.toBeNull()
  })

  it('deprecated + kids-blocked → kids_blocked rowState, Deprecated filter, no Use', () => {
    const v = resolveMySkillRow(
      mySkill({
        skill_status: 'deprecated',
        availability: { locked: true, lock_code: 'SKILL_KIDS_MODE_BLOCKED', cta: 'unavailable' },
      })
    )
    expect(v.rowState).toBe('kids_blocked')
    expect(v.isDeprecated).toBe(true)
    expect(v.filterBucket).toBe('deprecated')
    expect(v.canUse).toBe(false)
    expect(v.warningKey).not.toBeNull()
  })

  it('precedence: archived > locked (archived+plan-locked → archived)', () => {
    expect(
      deriveRowState(
        mySkill({
          skill_status: 'archived',
          availability: { locked: true, lock_code: 'SKILL_PLAN_REQUIRED' },
        })
      )
    ).toBe('archived')
  })

  it('unknown lock_code falls back to unavailable, no Use', () => {
    const v = resolveMySkillRow(
      mySkill({
        availability: { locked: true, lock_code: 'SOMETHING_WEIRD', cta: 'unavailable' },
      })
    )
    expect(v.rowState).toBe('unavailable')
    expect(v.filterBucket).toBe('locked')
    expect(v.canUse).toBe(false)
    expect(v.lockReason).toBe('unavailable')
  })

  it('reads skill_status/skill_id form as well as the base status form', () => {
    expect(deriveRowState(mySkill({ skill_status: undefined, status: 'archived' }))).toBe(
      'archived'
    )
  })

  it('missing skill_status + executable availability → executable rowState but NO Use / not openable', () => {
    const v = resolveMySkillRow(
      mySkill({
        skill_status: undefined,
        status: undefined,
        availability: { executable: true, locked: false, cta: 'use' },
      })
    )
    expect(v.rowState).toBe('executable')
    // Not published (status absent) → name link withheld, and Use is gated on it.
    expect(v.canOpen).toBe(false)
    expect(v.canUse).toBe(false)
  })
})

describe('rowMatchesFilter — mutually-exclusive buckets', () => {
  const rows = {
    executable: resolveMySkillRow(mySkill()),
    planLocked: resolveMySkillRow(
      mySkill({ availability: { locked: true, lock_code: 'SKILL_PLAN_REQUIRED' } })
    ),
    archived: resolveMySkillRow(
      mySkill({ skill_status: 'archived', availability: { locked: true, lock_code: 'SKILL_NOT_PUBLISHED' } })
    ),
    deprecated: resolveMySkillRow(
      mySkill({ skill_status: 'deprecated', availability: { executable: true, locked: false } })
    ),
    deprecatedLocked: resolveMySkillRow(
      mySkill({ skill_status: 'deprecated', availability: { locked: true, lock_code: 'SKILL_PLAN_REQUIRED' } })
    ),
  }

  const inFilter = (filter: MySkillFilter) =>
    Object.entries(rows)
      .filter(([, v]) => rowMatchesFilter(v, filter))
      .map(([k]) => k)
      .sort()

  it('All includes every row', () => {
    expect(inFilter('all').length).toBe(Object.keys(rows).length)
  })

  it('Available includes only executable non-deprecated rows', () => {
    expect(inFilter('available')).toEqual(['executable'])
  })

  it('Locked includes non-deprecated locked/unavailable rows (incl. archived)', () => {
    expect(inFilter('locked')).toEqual(['archived', 'planLocked'])
  })

  it('Deprecated includes all deprecated rows, including deprecated+locked', () => {
    expect(inFilter('deprecated')).toEqual(['deprecated', 'deprecatedLocked'])
  })
})

describe('skillKey / formatMySkillDate', () => {
  it('skillKey prefers skill_id, then id, then slug', () => {
    expect(skillKey(mySkill({ skill_id: 'a', id: 'b', slug: 'c' }))).toBe('a')
    expect(
      skillKey(mySkill({ skill_id: undefined, id: 'b', slug: 'c' }))
    ).toBe('b')
    expect(
      skillKey(mySkill({ skill_id: undefined, id: undefined, slug: 'c' }))
    ).toBe('c')
  })

  it('formatMySkillDate returns null for absent/invalid input and a string for valid', () => {
    expect(formatMySkillDate(null)).toBeNull()
    expect(formatMySkillDate('')).toBeNull()
    expect(formatMySkillDate('not-a-date')).toBeNull()
    expect(formatMySkillDate('2026-06-15T00:00:00Z')).toEqual(expect.any(String))
  })
})
