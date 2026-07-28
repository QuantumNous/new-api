import { beforeEach, describe, expect, it } from 'vitest'

import { writeDemoUser } from '@/api/demoStorage'
import { mockUser } from '@/api/mock/data'
import { dispatchMock } from '@/api/mock/handlers'
import { resetMockState } from '@/api/mock/state'
import {
  durationToSeconds,
  nextPeriodBoundary,
  periodsInTerm,
  planLifetimeQuota,
  planUnitPrice,
  contrastRatio,
  accentContrastWarning,
} from '@/constants/adminPlans'
import type {
  AdminPlan,
  AdminPlanPage,
  EntitlementSummary,
  Plan,
} from '@/types/console'

const AUTH = { headers: { 'X-Ren2Hub-Demo-User': '1' } }

function ctx(params?: Record<string, unknown>, data?: Record<string, unknown>) {
  return { ...AUTH, params: params ?? {}, data: data ?? {} }
}

beforeEach(() => {
  resetMockState()
  writeDemoUser({ ...mockUser })
})

async function list(
  params: Record<string, unknown> = {}
): Promise<AdminPlanPage> {
  const response = await dispatchMock<AdminPlanPage>(
    'GET',
    '/api/plan/',
    ctx({ page_size: 100, ...params })
  )
  expect(response.success).toBe(true)
  return response.data
}

async function storefront(): Promise<Plan[]> {
  const response = await dispatchMock<Plan[]>(
    'GET',
    '/api/subscription/plans',
    ctx()
  )
  expect(response.success).toBe(true)
  return response.data
}

async function entitlements(): Promise<EntitlementSummary> {
  const response = await dispatchMock<EntitlementSummary>(
    'GET',
    '/api/subscription/self',
    ctx()
  )
  expect(response.success).toBe(true)
  return response.data
}

function findPlan(page: AdminPlanPage, name: string): AdminPlan {
  const plan = page.items.find((item) => item.name === name)
  expect(plan).toBeDefined()
  return plan!
}

const validTraffic = {
  kind: 'traffic' as const,
  name: '测试流量包',
  price: 12,
  quota: 30_000_000,
  validity: { value: 30, unit: 'day' as const },
  features: ['权益一'],
  accent: { token: 'accent' as const },
  recommended: false,
  exclusive_channel_id: null,
  sort_order: 9,
  status: 'active' as const,
}

const validSubscription = {
  kind: 'subscription' as const,
  name: '测试订阅包',
  price: 30,
  period: { value: 1, unit: 'day' as const },
  meter: 'refill' as const,
  period_quota: 2_000_000,
  term: { value: 1, unit: 'month' as const },
  features: ['权益一'],
  accent: { token: 'signal' as const },
  recommended: false,
  exclusive_channel_id: null,
  sort_order: 10,
  status: 'active' as const,
}

/* ------------------------------------------------------------------ */
/* duration maths                                                       */
/* ------------------------------------------------------------------ */

describe('duration helpers', () => {
  it.each([
    [{ value: 6, unit: 'hour' as const }, 21_600],
    [{ value: 1, unit: 'day' as const }, 86_400],
    [{ value: 2, unit: 'week' as const }, 1_209_600],
    [{ value: 1, unit: 'month' as const }, 2_592_000],
  ])('converts %o to %i seconds', (duration, expected) => {
    expect(durationToSeconds(duration)).toBe(expected)
  })

  it('advances a monthly period by calendar month, not by 30 days', () => {
    // 2026-01-15 12:00 local → 2026-02-15 12:00 local
    const start = Math.floor(new Date(2026, 0, 15, 12).getTime() / 1_000)
    const next = nextPeriodBoundary(start, { value: 1, unit: 'month' })
    const date = new Date(next * 1_000)
    expect(date.getMonth()).toBe(1)
    expect(date.getDate()).toBe(15)
  })

  it('clamps a month-end rollover instead of overflowing the month', () => {
    // Jan 31 + 1 month must land on Feb 28/29, never Mar 2/3.
    const start = Math.floor(new Date(2026, 0, 31, 12).getTime() / 1_000)
    const date = new Date(
      nextPeriodBoundary(start, { value: 1, unit: 'month' }) * 1_000
    )
    expect(date.getMonth()).toBe(1)
    expect(date.getDate()).toBeGreaterThanOrEqual(28)
  })

  it('advances non-month units by fixed spans', () => {
    const start = 1_000_000
    expect(nextPeriodBoundary(start, { value: 6, unit: 'hour' })).toBe(
      start + 21_600
    )
  })

  it('counts whole periods in a term and floors a partial one', () => {
    expect(
      periodsInTerm({ value: 1, unit: 'day' }, { value: 1, unit: 'month' })
    ).toBe(30)
    expect(
      periodsInTerm({ value: 1, unit: 'week' }, { value: 1, unit: 'month' })
    ).toBe(4)
    // A period longer than the term still counts as one, never zero.
    expect(
      periodsInTerm({ value: 2, unit: 'month' }, { value: 1, unit: 'month' })
    ).toBe(1)
  })
})

describe('cross-kind comparability', () => {
  it('measures a subscription by its lifetime grant, not one period', () => {
    const plan: Plan = {
      id: 1,
      kind: 'subscription',
      name: 'x',
      price: 30,
      period: { value: 1, unit: 'day' },
      meter: 'refill',
      period_quota: 1_000_000,
      term: { value: 1, unit: 'month' },
      features: [],
      accent: { token: 'accent' },
      exclusive_channel_id: null,
    }
    expect(planLifetimeQuota(plan)).toBe(30_000_000)
    // $30 for 30M units → $1.00 per 1M.
    expect(planUnitPrice(plan)).toBeCloseTo(1, 5)
  })

  it('measures a traffic pack by its single grant', () => {
    const plan: Plan = {
      id: 2,
      kind: 'traffic',
      name: 'y',
      price: 5,
      quota: 10_000_000,
      validity: null,
      features: [],
      accent: { token: 'accent' },
      exclusive_channel_id: null,
    }
    expect(planLifetimeQuota(plan)).toBe(10_000_000)
    expect(planUnitPrice(plan)).toBeCloseTo(0.5, 5)
  })
})

describe('custom accent contrast', () => {
  it('computes a known contrast ratio', () => {
    // Black on white is the 21:1 reference pair.
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 1)
  })

  it('warns only when a custom accent fails on either theme', () => {
    // Semantic tokens are never checked — they are theme-managed.
    expect(accentContrastWarning({ token: 'accent' })).toBeNull()
    // This mid purple is one of the few that clears 3:1 on both surfaces.
    expect(
      accentContrastWarning({ token: 'custom', hex: '#8f7ce0' })
    ).toBeNull()

    // Near-white passes at night but fails against the cream day surface —
    // the exact asymmetry a single-surface check would miss.
    const light = accentContrastWarning({ token: 'custom', hex: '#fffef8' })
    expect(light).not.toBeNull()
    expect(light!.day).toBeLessThan(3)
    expect(light!.night).toBeGreaterThanOrEqual(3)

    // And the mirror case: near-black fails at night, passes by day.
    const dark = accentContrastWarning({ token: 'custom', hex: '#2f333c' })
    expect(dark).not.toBeNull()
    expect(dark!.night).toBeLessThan(3)
  })
})

/* ------------------------------------------------------------------ */
/* catalogue                                                            */
/* ------------------------------------------------------------------ */

describe('mock admin plan catalogue', () => {
  it('serves only active plans to the storefront, in display order', async () => {
    const page = await list()
    expect(page.items.some((plan) => plan.status !== 'active')).toBe(true)

    const publicPlans = await storefront()

    expect(publicPlans.map((plan) => plan.name)).toEqual(
      page.items
        .filter((plan) => plan.status === 'active')
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((plan) => plan.name)
    )
    // Admin-only counters never cross into the public payload.
    expect(publicPlans.every((plan) => !('subscribers' in plan))).toBe(true)
    expect(publicPlans.every((plan) => !('status' in plan))).toBe(true)
  })

  it('carries both kinds with their own exclusive fields', async () => {
    const publicPlans = await storefront()
    const traffic = publicPlans.filter((plan) => plan.kind === 'traffic')
    const subscriptions = publicPlans.filter(
      (plan) => plan.kind === 'subscription'
    )

    expect(traffic.length).toBeGreaterThan(0)
    expect(subscriptions.length).toBeGreaterThan(0)
    // The union keeps the shapes disjoint on the wire, not just in types.
    expect(traffic.every((plan) => !('period_quota' in plan))).toBe(true)
    expect(subscriptions.every((plan) => !('quota' in plan))).toBe(true)
  })

  it('reports kind and status counts over the keyword result, not the facet', async () => {
    const page = await list({ kind: 'traffic' })

    expect(page.items.every((plan) => plan.kind === 'traffic')).toBe(true)
    // Counts still describe the unfaceted set, so the chips stay usable.
    expect(page.kind_counts.subscription).toBeGreaterThan(0)
    expect(page.status_counts.hidden).toBeGreaterThan(0)
  })

  it('creates each kind and lists it on the storefront', async () => {
    for (const body of [validTraffic, validSubscription]) {
      const created = await dispatchMock<AdminPlan>(
        'POST',
        '/api/plan/',
        ctx({}, body)
      )
      expect(created.success).toBe(true)
      expect(created.data.kind).toBe(body.kind)
    }

    const names = (await storefront()).map((plan) => plan.name)
    expect(names).toContain('测试流量包')
    expect(names).toContain('测试订阅包')
  })

  it('rejects a subscription whose term is shorter than one period', async () => {
    const response = await dispatchMock(
      'POST',
      '/api/plan/',
      ctx(
        {},
        {
          ...validSubscription,
          period: { value: 2, unit: 'month' },
          term: { value: 1, unit: 'month' },
        }
      )
    )
    expect(response.success).toBe(false)
  })

  it('rejects an unknown duration unit and a non-positive quota', async () => {
    const badUnit = await dispatchMock(
      'POST',
      '/api/plan/',
      ctx({}, { ...validTraffic, validity: { value: 1, unit: 'fortnight' } })
    )
    expect(badUnit.success).toBe(false)

    const noQuota = await dispatchMock(
      'POST',
      '/api/plan/',
      ctx({}, { ...validTraffic, quota: 0 })
    )
    expect(noQuota.success).toBe(false)
  })

  it('accepts a null validity as "never expires"', async () => {
    const created = await dispatchMock<AdminPlan>(
      'POST',
      '/api/plan/',
      ctx({}, { ...validTraffic, validity: null })
    )
    expect(created.success).toBe(true)
    expect(created.data.validity).toBeNull()
  })

  it('rejects a malformed custom accent but accepts a valid one', async () => {
    const bad = await dispatchMock(
      'POST',
      '/api/plan/',
      ctx({}, { ...validTraffic, accent: { token: 'custom', hex: 'purple' } })
    )
    expect(bad.success).toBe(false)

    const good = await dispatchMock<AdminPlan>(
      'POST',
      '/api/plan/',
      ctx({}, { ...validTraffic, accent: { token: 'custom', hex: '#7F6BD6' } })
    )
    expect(good.success).toBe(true)
    // Normalized to lowercase #rrggbb on write.
    expect(good.data.accent).toEqual({ token: 'custom', hex: '#7f6bd6' })
  })

  it('rejects an exclusive channel that does not exist', async () => {
    const response = await dispatchMock(
      'POST',
      '/api/plan/',
      ctx({}, { ...validTraffic, exclusive_channel_id: 999_999 })
    )
    expect(response.success).toBe(false)
  })

  it('pins kind on edit, ignoring a hostile body', async () => {
    const target = findPlan(await list(), '入门流量包')
    expect(target.kind).toBe('traffic')

    const updated = await dispatchMock<AdminPlan>(
      'PUT',
      `/api/plan/${target.id}`,
      ctx(
        {},
        {
          ...validSubscription,
          // Both of these must be ignored: kind is immutable, and shelf state
          // belongs to the status route.
          kind: 'subscription',
          status: 'archived',
          name: target.name,
          quota: 20_000_000,
          validity: { value: 60, unit: 'day' },
        }
      )
    )

    expect(updated.success).toBe(true)
    expect(updated.data.kind).toBe('traffic')
    expect(updated.data.quota).toBe(20_000_000)
    expect(updated.data.status).toBe('active')
    // The other kind's fields must not linger alongside the traffic ones.
    expect(updated.data.period_quota).toBeUndefined()
  })

  it('withdraws a delisted plan from the storefront but keeps it for admins', async () => {
    const target = findPlan(await list(), '专业订阅')

    const toggled = await dispatchMock<AdminPlan>(
      'POST',
      `/api/plan/${target.id}/status`,
      ctx({}, { status: 'hidden' })
    )
    expect(toggled.success).toBe(true)

    expect((await storefront()).map((p) => p.name)).not.toContain('专业订阅')
    expect((await list()).items.map((p) => p.name)).toContain('专业订阅')
  })

  it('refuses to sell a delisted plan even when its id is known', async () => {
    const hidden = (await list()).items.find((plan) => plan.status === 'hidden')
    expect(hidden).toBeDefined()

    const purchase = await dispatchMock(
      'POST',
      '/api/subscription/purchase',
      ctx({}, { plan_id: hidden!.id })
    )
    expect(purchase.success).toBe(false)
  })

  it('refuses to delete or archive a plan that still has holders', async () => {
    const busy = findPlan(await list(), '专业订阅')
    expect(busy.subscribers).toBeGreaterThan(0)

    expect(
      (await dispatchMock('DELETE', `/api/plan/${busy.id}`, ctx())).success
    ).toBe(false)
    expect(
      (
        await dispatchMock(
          'POST',
          `/api/plan/${busy.id}/status`,
          ctx({}, { status: 'archived' })
        )
      ).success
    ).toBe(false)
  })

  it('rejects a whole batch when any member still has holders', async () => {
    const page = await list()
    const empty = findPlan(page, '内测体验包')
    const busy = findPlan(page, '专业订阅')

    const response = await dispatchMock(
      'POST',
      '/api/plan/batch',
      ctx({}, { ids: [empty.id, busy.id] })
    )
    expect(response.success).toBe(false)

    // All-or-nothing: the deletable member survives the rejected batch.
    expect((await list()).items.map((p) => p.id)).toContain(empty.id)
  })
})

/* ------------------------------------------------------------------ */
/* entitlements                                                         */
/* ------------------------------------------------------------------ */

describe('entitlements', () => {
  it('returns one subscription plus every traffic grant', async () => {
    const summary = await entitlements()

    expect(summary.subscription).not.toBeNull()
    expect(summary.subscription!.name).toBe('专业订阅')
    // Grants are held individually because each expires on its own schedule.
    expect(summary.traffic.length).toBe(2)
    expect(summary.traffic.map((pack) => pack.expire_time)).toContain(-1)
  })

  it('resolves the period window and the exclusive channel', async () => {
    const summary = await entitlements()
    const subscription = summary.subscription!

    expect(subscription.period_end).toBeGreaterThan(subscription.period_start)
    expect(subscription.period_end).toBeGreaterThan(
      Math.floor(Date.now() / 1000)
    )
    expect(subscription.exclusive_channel).toBeDefined()
    expect(subscription.meter).toBe('refill')
  })

  it('drops the exclusive channel once that channel is deleted', async () => {
    const before = await entitlements()
    const channelId = before.subscription!.exclusive_channel!.id

    const deleted = await dispatchMock(
      'DELETE',
      `/api/channel/${channelId}`,
      ctx()
    )
    expect(deleted.success).toBe(true)

    // The plan keeps its dangling id; the wire shape simply omits the channel
    // rather than inventing a name.
    const after = await entitlements()
    expect(after.subscription!.exclusive_channel).toBeUndefined()
  })

  it('toggles auto-renew and echoes the full summary back', async () => {
    const response = await dispatchMock<EntitlementSummary>(
      'PUT',
      '/api/subscription/self',
      ctx({}, { auto_renew: false })
    )
    expect(response.success).toBe(true)
    expect(response.data.subscription!.auto_renew).toBe(false)
    expect(response.data.traffic.length).toBe(2)
  })

  it('drives the dashboard rate cap and multiplier from the active plan', async () => {
    const response = await dispatchMock<{
      limits: { rate_limit: number }
      discounts: { plan_ratio: number }
    }>('GET', '/api/data/self', ctx())

    expect(response.success).toBe(true)
    // 专业订阅 carries rate_limit 300 and ratio 0.95.
    expect(response.data.limits.rate_limit).toBe(300)
    expect(response.data.discounts.plan_ratio).toBe(0.95)
  })

  it('keeps historical order subjects pinned to what was actually sold', async () => {
    const target = findPlan(await list(), '专业订阅')

    await dispatchMock(
      'PUT',
      `/api/plan/${target.id}`,
      ctx(
        {},
        {
          name: '改名后的订阅',
          price: 999,
          period: target.period,
          meter: target.meter,
          period_quota: target.period_quota,
          term: target.term,
          features: target.features,
          accent: target.accent,
          recommended: false,
          exclusive_channel_id: target.exclusive_channel_id,
          sort_order: target.sort_order,
        }
      )
    )

    const orders = await dispatchMock<{ items: Array<{ subject: string }> }>(
      'GET',
      '/api/order/',
      ctx({ type: 'subscription', page_size: 20 })
    )

    expect(orders.success).toBe(true)
    expect(orders.data.items.length).toBeGreaterThan(0)
    expect(
      orders.data.items.every((order) => !order.subject.includes('改名后'))
    ).toBe(true)
  })
})
