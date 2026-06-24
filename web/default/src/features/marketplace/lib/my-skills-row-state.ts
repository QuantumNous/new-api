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
import {
  normalizeLockState,
  type LockStateKind,
} from '../components/lock-state-utils'
import type { MySkill } from '../types'

// DR-59 My Skills row-state mapper (pure, no I/O — unit-tested in isolation).
//
// Two independent outputs per row:
//  (a) `rowState` — the single action-driving state. Lock is evaluated BEFORE
//      deprecation so the UI never appears to bypass `availability.locked`.
//  (b) `isDeprecated` — an independent decoration flag (skill_status ===
//      'deprecated') that drives the warning badge and the Deprecated filter,
//      regardless of `rowState`. Deprecation is a decoration, not a reason to
//      skip a lock.
//
// Source of truth for the lock taxonomy: the backend availability resolver
// (internal/skill/availability/availability.go) + tasks/02 §4.3.3.

export type MySkillRowState =
  | 'executable'
  | 'plan_locked'
  | 'quota_exceeded'
  | 'kids_blocked'
  | 'deprecated'
  | 'archived'
  | 'unavailable'

export type MySkillFilterBucket = 'available' | 'locked' | 'deprecated'

export type MySkillFilter = 'all' | MySkillFilterBucket

/** A My Skills row paired with its derived view-model, used by table + mobile. */
export interface MySkillRowItem {
  skill: MySkill
  view: MySkillRowView
}

export interface MySkillRowView {
  /** The single action-driving state (lock beats deprecation). */
  rowState: MySkillRowState
  /** Independent decoration: skill_status === 'deprecated'. */
  isDeprecated: boolean
  /** Mutually-exclusive filter bucket (Deprecated > Locked > Available). */
  filterBucket: MySkillFilterBucket
  /** i18n key for the status badge label. */
  statusLabelKey: string
  /**
   * Whether the row offers the Use action. Use navigates to Skill Detail
   * (D-09), and Skill Detail is **published-only** on the backend
   * (`GetMarketplaceSkill` queries `status = published`), so Use is offered
   * only for published+executable rows — never deprecated/archived, which
   * would dead-end at a 404 Detail page.
   */
  canUse: boolean
  /**
   * Whether the skill name links to Skill Detail. Same published-only constraint
   * as `canUse`: deprecated/archived rows render the name as plain text.
   */
  canOpen: boolean
  /** Remove is always offered (DR-56). */
  canRemove: boolean
  /**
   * Lock reason for the `LockState` badge, or null for non-locked rows.
   * Note V1 (DR-59): locked rows render reason + Remove only — no clickable
   * primary CTA, because the skill surface has no wired plan-upgrade/renew flow.
   */
  lockReason: LockStateKind | null
  /** i18n key for the deprecated warning, or null. */
  warningKey: string | null
}

const STATUS_LABEL_KEY: Record<MySkillRowState, string> = {
  executable: 'Available',
  plan_locked: 'Plan required',
  quota_exceeded: 'Quota exceeded',
  kids_blocked: 'Blocked in Kids Mode',
  deprecated: 'Deprecated',
  archived: 'Unavailable',
  unavailable: 'Unavailable',
}

const DEPRECATED_WARNING_KEY =
  'This Skill is deprecated. You can keep using it for now, but it may be retired.'

function skillStatusOf(skill: MySkill): string | undefined {
  return skill.skill_status ?? skill.status
}

/**
 * Derive the action-driving `rowState`. Precedence (first match wins):
 *   1. archived
 *   2. availability.locked === true  (kids > quota > plan/subscription > other)
 *   3. skill_status === 'deprecated'  (⇒ executable, since locks caught above)
 *   4. executable
 *   5. fallback → unavailable
 */
export function deriveRowState(skill: MySkill): MySkillRowState {
  const status = skillStatusOf(skill)
  const availability = skill.availability
  const locked = availability?.locked === true
  const executable = availability?.executable === true

  if (status === 'archived') return 'archived'

  if (locked) {
    switch (normalizeLockState(availability?.lock_code)) {
      case 'kids_blocked':
        return 'kids_blocked'
      case 'quota_exceeded':
        return 'quota_exceeded'
      case 'plan_required':
      case 'subscription_inactive':
        return 'plan_locked'
      default:
        return 'unavailable'
    }
  }

  // Deprecation is a decoration, never a license to navigate/use. A deprecated
  // row keeps rowState='deprecated' when availability says it would otherwise be
  // executable, but canUse/canOpen stay false (resolveMySkillRow) because Skill
  // Detail is published-only; a non-executable deprecated row falls to
  // unavailable. Either way it stays flagged for the warning + Deprecated filter.
  if (status === 'deprecated') return executable ? 'deprecated' : 'unavailable'
  if (executable) return 'executable'
  return 'unavailable'
}

function filterBucketFor(
  rowState: MySkillRowState,
  isDeprecated: boolean
): MySkillFilterBucket {
  // Deprecated takes precedence at the filter level (by skill_status), so a
  // deprecated row that is also locked still appears under Deprecated.
  if (isDeprecated) return 'deprecated'
  if (rowState === 'executable') return 'available'
  return 'locked'
}

function lockReasonFor(
  rowState: MySkillRowState,
  skill: MySkill
): LockStateKind | null {
  switch (rowState) {
    case 'plan_locked':
      // Preserve subscription_inactive vs plan_required for the badge copy.
      return normalizeLockState(skill.availability?.lock_code) ===
        'subscription_inactive'
        ? 'subscription_inactive'
        : 'plan_required'
    case 'quota_exceeded':
      return 'quota_exceeded'
    case 'kids_blocked':
      return 'kids_blocked'
    case 'archived':
    case 'unavailable':
      return 'unavailable'
    default:
      return null
  }
}

export function resolveMySkillRow(skill: MySkill): MySkillRowView {
  const rowState = deriveRowState(skill)
  const isDeprecated = skillStatusOf(skill) === 'deprecated'
  // Skill Detail (the Use / name-link target) is published-only on the backend,
  // so both Use and the name link are gated on a published row. canUse requires
  // canOpen explicitly (not just rowState==='executable') so a payload missing
  // skill_status can never yield a clickable Use with a non-clickable name.
  const canOpen = skillStatusOf(skill) === 'published'
  const canUse = rowState === 'executable' && canOpen

  return {
    rowState,
    isDeprecated,
    filterBucket: filterBucketFor(rowState, isDeprecated),
    statusLabelKey: STATUS_LABEL_KEY[rowState],
    canUse,
    canOpen,
    canRemove: true,
    lockReason: lockReasonFor(rowState, skill),
    warningKey: isDeprecated ? DEPRECATED_WARNING_KEY : null,
  }
}

/**
 * The stable identifier for a My Skills row: the DR-54 response uses `skill_id`
 * (the value the DR-56 `DELETE /my-skills/:id` route expects). One source of
 * truth so the row key, the pending-disable check, and the remove call all
 * agree even if a future payload carries both `id` and `skill_id`.
 */
export function skillKey(skill: MySkill): string {
  return skill.skill_id ?? skill.id ?? skill.slug
}

/** True when the row belongs in the active filter tab. */
export function rowMatchesFilter(
  view: MySkillRowView,
  filter: MySkillFilter
): boolean {
  return filter === 'all' || view.filterBucket === filter
}

/**
 * Format an ISO date for the My Skills table. Returns null for absent/invalid
 * input so the caller can render a localized fallback ("Never" / "—").
 */
export function formatMySkillDate(value?: string | null): string | null {
  if (value == null || value === '') return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}
