import { describe, expect, it } from 'vitest'

import {
  groupByVendor,
  scoreBand,
  scoreChannels,
  WEIGHTS,
  type ChannelRoutingMetrics,
} from '@/utils/routeScore'

function makeChannel(
  overrides: Partial<ChannelRoutingMetrics> = {}
): ChannelRoutingMetrics {
  return {
    id: 1,
    name: 'ch',
    supplier: 'OpenAI',
    latency: 300,
    quota: 100,
    weight: 10,
    priority: 1,
    status: 1,
    ...overrides,
  }
}

describe('scoreChannels', () => {
  it('only ranks enabled channels', () => {
    const scored = scoreChannels([
      makeChannel({ id: 1 }),
      makeChannel({ id: 2, status: 2 }),
      makeChannel({ id: 3, status: 3 }),
    ])

    expect(scored.map((c) => c.id)).toEqual([1])
  })

  it('sorts best-first and keeps scores within 0-100', () => {
    const scored = scoreChannels([
      makeChannel({ id: 1, latency: 2000, quota: 1, priority: 1 }),
      makeChannel({ id: 2, latency: 100, quota: 500, priority: 10 }),
    ])

    expect(scored.map((c) => c.id)).toEqual([2, 1])
    for (const c of scored) {
      expect(c.score).toBeGreaterThanOrEqual(0)
      expect(c.score).toBeLessThanOrEqual(100)
    }
  })

  it('ranks untested latency below every measured channel', () => {
    const scored = scoreChannels([
      makeChannel({ id: 1, latency: 900 }),
      makeChannel({ id: 2, latency: 0 }),
      makeChannel({ id: 3, latency: 100 }),
    ])
    const byId = new Map(scored.map((c) => [c.id, c]))

    expect(byId.get(2)!.breakdown.latency).toBeLessThan(
      byId.get(1)!.breakdown.latency
    )
    expect(byId.get(1)!.breakdown.latency).toBeLessThan(
      byId.get(3)!.breakdown.latency
    )
  })

  it('awards full marks on factors with no spread in the candidate set', () => {
    const [only] = scoreChannels([makeChannel()])

    expect(only!.breakdown.latency).toBe(1)
    expect(only!.breakdown.priority).toBe(1)
    expect(only!.score).toBe(100)
  })

  it('keeps the factor weights a complete partition of the score', () => {
    const total = Object.values(WEIGHTS).reduce((sum, w) => sum + w, 0)

    expect(total).toBeCloseTo(1, 10)
  })

  it('keeps upstream quota as fifteen percent of the composite score', () => {
    const scored = scoreChannels([
      makeChannel({ id: 1, quota: 50 }),
      makeChannel({ id: 2, quota: 100 }),
    ])
    const byId = new Map(scored.map((channel) => [channel.id, channel]))

    expect(WEIGHTS.quota).toBe(0.15)
    expect(byId.get(1)!.breakdown.quota).toBe(0)
    expect(byId.get(2)!.breakdown.quota).toBe(1)
    expect(byId.get(2)!.score - byId.get(1)!.score).toBe(15)
  })

  it('ranks the higher persisted priority value first', () => {
    const scored = scoreChannels([
      makeChannel({ id: 1, priority: 1 }),
      makeChannel({ id: 2, priority: 5 }),
    ])
    const byId = new Map(scored.map((c) => [c.id, c]))

    expect(byId.get(1)!.breakdown.priority).toBe(0)
    expect(byId.get(2)!.breakdown.priority).toBe(1)
  })
})

describe('scoreBand', () => {
  it('colours composite scores by the shared thresholds', () => {
    expect(scoreBand(70)).toBe('success')
    expect(scoreBand(69)).toBe('warning')
    expect(scoreBand(45)).toBe('warning')
    expect(scoreBand(44)).toBe('danger')
  })
})

describe('groupByVendor', () => {
  it('groups by supplier, defaulting a missing supplier to Other', () => {
    const scored = scoreChannels([
      makeChannel({ id: 1, supplier: 'OpenAI', latency: 800 }),
      makeChannel({ id: 2, supplier: '' }),
      makeChannel({ id: 3, supplier: 'OpenAI', latency: 100 }),
    ])
    const grouped = groupByVendor(scored)

    expect([...grouped.keys()].sort()).toEqual(['OpenAI', 'Other'])
    const openai = grouped.get('OpenAI')!
    expect(openai.map((c) => c.id)).toEqual([3, 1])
  })
})
