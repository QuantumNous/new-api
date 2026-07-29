import { describe, expect, it } from 'vitest'

import {
  alignRouteHealthChecks,
  summarizeRouteHealth,
  type RouteHealthCheck,
} from '@/utils/routeHealth'

const NOW = 7_500
const BUCKETS = [4_200, 4_800, 5_400, 6_000, 6_600, 7_200]

function checks(states: RouteHealthCheck['state'][]): RouteHealthCheck[] {
  return states.map((state, index) => ({
    timestamp: BUCKETS[index]!,
    state,
  }))
}

describe('alignRouteHealthChecks', () => {
  it('fills missing recent buckets with unknown', () => {
    const aligned = alignRouteHealthChecks(
      [
        { timestamp: 4_190, state: 'healthy' },
        { timestamp: 6_620, state: 'down' },
      ],
      NOW
    )

    expect(aligned.map((check) => check.timestamp)).toEqual(BUCKETS)
    expect(aligned.map((check) => check.state)).toEqual([
      'healthy',
      'unknown',
      'unknown',
      'unknown',
      'unknown',
      'down',
    ])
  })

  it('uses the last check within each bucket and ignores future checks', () => {
    const aligned = alignRouteHealthChecks(
      [
        { timestamp: 6_610, state: 'down' },
        { timestamp: 6_690, state: 'degraded' },
        { timestamp: 6_699, state: 'healthy' },
        { timestamp: NOW + 1, state: 'down' },
      ],
      NOW
    )

    expect(aligned[4]).toEqual({ timestamp: 6_600, state: 'unknown' })
    expect(aligned[5]).toEqual({ timestamp: 7_200, state: 'healthy' })
  })
})

describe('summarizeRouteHealth', () => {
  it('uses healthy and then degraded as failover priorities', () => {
    const summary = summarizeRouteHealth(
      [
        {
          status: 1,
          healthChecks: checks([
            'down',
            'unknown',
            'degraded',
            'down',
            'unknown',
            'down',
          ]),
        },
        {
          status: 1,
          healthChecks: checks([
            'healthy',
            'degraded',
            'down',
            'down',
            'healthy',
            'down',
          ]),
        },
      ],
      NOW
    )

    expect(summary.checks.map((check) => check.state)).toEqual([
      'healthy',
      'degraded',
      'degraded',
      'down',
      'healthy',
      'down',
    ])
    expect(summary.state).toBe('down')
  })

  it('counts degraded buckets as available', () => {
    const summary = summarizeRouteHealth(
      [
        {
          status: 1,
          healthChecks: checks([
            'healthy',
            'degraded',
            'down',
            'unknown',
            'degraded',
            'down',
          ]),
        },
      ],
      NOW
    )

    expect(summary.availability).toBe(60)
  })

  it('keeps a down plus unknown bucket unknown', () => {
    const summary = summarizeRouteHealth(
      [
        { status: 1, healthChecks: checks(Array(6).fill('down')) },
        { status: 1, healthChecks: checks(Array(6).fill('unknown')) },
      ],
      NOW
    )

    expect(summary.checks.every((check) => check.state === 'unknown')).toBe(
      true
    )
    expect(summary.availability).toBeNull()
  })

  it('reports every bucket down when no channel is enabled', () => {
    const summary = summarizeRouteHealth(
      [
        { status: 2, healthChecks: checks(Array(6).fill('healthy')) },
        { status: 3, healthChecks: checks(Array(6).fill('healthy')) },
      ],
      NOW
    )

    expect(summary.checks.every((check) => check.state === 'down')).toBe(true)
    expect(summary.state).toBe('down')
    expect(summary.availability).toBe(0)
  })

  it('reports unknown with no availability when enabled history is absent', () => {
    const summary = summarizeRouteHealth([{ status: 1 }], NOW)

    expect(summary.checks.every((check) => check.state === 'unknown')).toBe(
      true
    )
    expect(summary.state).toBe('unknown')
    expect(summary.availability).toBeNull()
  })

  it('ignores disabled channel history', () => {
    const summary = summarizeRouteHealth(
      [
        { status: 1, healthChecks: checks(Array(6).fill('degraded')) },
        { status: 2, healthChecks: checks(Array(6).fill('healthy')) },
      ],
      NOW
    )

    expect(summary.checks.every((check) => check.state === 'degraded')).toBe(
      true
    )
  })
})
