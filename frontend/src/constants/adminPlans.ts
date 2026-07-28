import type {
  AdminPlan,
  AdminPlanSortBy,
  AdminPlanStatus,
  Duration,
  DurationUnit,
  Plan,
  PlanAccent,
  PlanKind,
  SubscriptionMeter,
} from '@/types/console'
import { normalizeOpaqueColor } from '@/utils/cssColor'
import { QUOTA_PER_DOLLAR } from '@/utils/format'

export const ADMIN_PLAN_STATUSES: readonly AdminPlanStatus[] = [
  'active',
  'hidden',
  'archived',
]

export const PLAN_KINDS: readonly PlanKind[] = ['traffic', 'subscription']

export const DURATION_UNITS: readonly DurationUnit[] = [
  'hour',
  'day',
  'week',
  'month',
]

export const SUBSCRIPTION_METERS: readonly SubscriptionMeter[] = [
  'refill',
  'cap',
]

export const PLAN_ACCENT_TOKENS: readonly PlanAccent['token'][] = [
  'accent',
  'signal',
  'support',
  'custom',
]

export const ADMIN_PLAN_SORT_FIELDS: readonly AdminPlanSortBy[] = [
  'sort_order',
  'price',
  'subscribers',
  'id',
]

/** Shared ceilings for the form and the mock validator. */
export const ADMIN_PLAN_LIMITS = {
  nameMaxLength: 32,
  priceMax: 100_000,
  featuresMax: 12,
  featureMaxLength: 64,
  sortOrderMax: 999,
  durationValueMax: 999,
  rateLimitMax: 1_000_000,
  ratioMin: 0.01,
  ratioMax: 100,
} as const

const HOUR_SECONDS = 3_600
const DAY_SECONDS = 86_400

/**
 * Seconds per unit. A month is normalized to 30 days: the catalogue needs one
 * comparable number for pricing maths, and calendar-accurate month arithmetic
 * belongs to period rollover (nextPeriodBoundary), not to unit conversion.
 */
const UNIT_SECONDS: Record<DurationUnit, number> = {
  hour: HOUR_SECONDS,
  day: DAY_SECONDS,
  week: 7 * DAY_SECONDS,
  month: 30 * DAY_SECONDS,
}

export function durationToSeconds(duration: Duration): number {
  return duration.value * UNIT_SECONDS[duration.unit]
}

/**
 * i18n key for a counted duration, e.g. "30 天" / "30 days". Interpolates `n`,
 * so callers must pass the value.
 */
export function durationUnitLabelKey(unit: DurationUnit): string {
  return `planManagement.unit${unit.charAt(0).toUpperCase()}${unit.slice(1)}`
}

/**
 * i18n key for the bare unit noun, for pickers where the count sits in a
 * separate field. Kept distinct from the counted key so neither has to carry a
 * placeholder the other does not want.
 */
export function durationUnitNameKey(unit: DurationUnit): string {
  return `planManagement.unitName${unit.charAt(0).toUpperCase()}${unit.slice(1)}`
}

/**
 * End of the period that contains `from`, advancing by calendar steps for month
 * so a monthly plan keeps its billing day instead of drifting by two days a
 * year. Pure so period rollover stays table-testable.
 */
export function nextPeriodBoundary(from: number, period: Duration): number {
  if (period.unit === 'month') {
    const date = new Date(from * 1_000)
    const day = date.getDate()
    date.setMonth(date.getMonth() + period.value)
    // Clamp Jan 31 + 1 month to Feb 28/29 rather than overflowing into March.
    if (date.getDate() < day) date.setDate(0)
    return Math.floor(date.getTime() / 1_000)
  }
  return from + durationToSeconds(period)
}

/** How many whole periods fit in a term — the basis for total-value maths. */
export function periodsInTerm(period: Duration, term: Duration): number {
  const periodSeconds = durationToSeconds(period)
  if (periodSeconds <= 0) return 0
  return Math.max(1, Math.floor(durationToSeconds(term) / periodSeconds))
}

/** Total quota a plan delivers over its whole life, comparable across kinds. */
export function planLifetimeQuota(plan: Plan): number {
  if (plan.kind === 'traffic') return plan.quota
  return plan.period_quota * periodsInTerm(plan.period, plan.term)
}

/** The plan's lifetime quota expressed as the dollar amount it is worth. */
export function planQuotaValue(plan: Plan): number {
  return planLifetimeQuota(plan) / QUOTA_PER_DOLLAR
}

/** Effective price in dollars per million quota units. */
export function planUnitPrice(plan: Plan): number {
  const perMillion = planLifetimeQuota(plan) / 1_000_000
  if (perMillion <= 0) return 0
  return plan.price / perMillion
}

/**
 * Saving against buying the same quota as raw balance. Positive means the plan
 * is cheaper than topping up; 0 when it carries no advantage.
 */
export function planDiscountPercent(plan: Plan): number {
  const value = planQuotaValue(plan)
  if (value <= 0 || plan.price <= 0) return 0
  return Math.max(0, Math.round((1 - plan.price / value) * 100))
}

/* ---------------- accent ---------------- */

/** CSS colour for a plan accent: semantic token, or a literal custom hex. */
export function planAccentColor(accent: PlanAccent): string {
  if (accent.token === 'custom') {
    return normalizeOpaqueColor(accent.hex ?? '', '#d8984c')
  }
  return `var(--${accent.token})`
}

export function planAccentLabelKey(token: PlanAccent['token']): string {
  return `planManagement.accent${token.charAt(0).toUpperCase()}${token.slice(1)}`
}

/** Relative luminance per WCAG 2.x, from an #rrggbb string. */
function relativeLuminance(hex: string): number {
  const normalized = normalizeOpaqueColor(hex, '#000000').slice(1)
  const channels = [0, 2, 4].map((offset) => {
    const value =
      Number.parseInt(normalized.slice(offset, offset + 2), 16) / 255
    return value <= 0.039_28 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * channels[0]! + 0.7152 * channels[1]! + 0.0722 * channels[2]!
}

export function contrastRatio(foreground: string, background: string): number {
  const a = relativeLuminance(foreground)
  const b = relativeLuminance(background)
  const [light, dark] = a > b ? [a, b] : [b, a]
  return (light! + 0.05) / (dark! + 0.05)
}

/** Day and night card surfaces a custom accent has to read against. */
export const ACCENT_CHECK_SURFACES = {
  day: '#fffdf8',
  night: '#32363f',
} as const

/**
 * Non-blocking legibility check for a custom accent. Emphasis marks only need
 * 3:1, so this warns rather than rejects — the admin keeps the final call.
 */
export function accentContrastWarning(
  accent: PlanAccent
): { day: number; night: number } | null {
  if (accent.token !== 'custom' || !accent.hex) return null
  const day = contrastRatio(accent.hex, ACCENT_CHECK_SURFACES.day)
  const night = contrastRatio(accent.hex, ACCENT_CHECK_SURFACES.night)
  if (day >= 3 && night >= 3) return null
  return {
    day: Math.round(day * 100) / 100,
    night: Math.round(night * 100) / 100,
  }
}

/* ---------------- labels & tones ---------------- */

export function adminPlanStatusTone(
  status: AdminPlanStatus
): 'success' | 'warning' | 'neutral' {
  switch (status) {
    case 'active':
      return 'success'
    case 'hidden':
      return 'warning'
    case 'archived':
      return 'neutral'
  }
}

export function adminPlanStatusLabelKey(status: AdminPlanStatus): string {
  return `planManagement.status${status.charAt(0).toUpperCase()}${status.slice(1)}`
}

export function planKindLabelKey(kind: PlanKind): string {
  return `planManagement.kind${kind.charAt(0).toUpperCase()}${kind.slice(1)}`
}

export function planKindTone(kind: PlanKind): 'info' | 'accent' {
  return kind === 'traffic' ? 'info' : 'accent'
}

export function subscriptionMeterLabelKey(meter: SubscriptionMeter): string {
  return `planManagement.meter${meter.charAt(0).toUpperCase()}${meter.slice(1)}`
}

export function adminPlanSortLabelKey(field: AdminPlanSortBy): string {
  const camel = field.replace(/_(\w)/g, (_, c: string) => c.toUpperCase())
  return `planManagement.sort${camel.charAt(0).toUpperCase()}${camel.slice(1)}`
}

/** Narrowing helper so callers avoid repeating the discriminant literal. */
export function isSubscriptionPlan(
  plan: AdminPlan
): plan is Extract<AdminPlan, { kind: 'subscription' }> {
  return plan.kind === 'subscription'
}
