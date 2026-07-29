/**
 * Mock data for the auto-routing dashboard tab.
 * Derived from the same adminChannels seed so vendor names are consistent.
 */
import { adminChannels } from './data'
import {
  ROUTE_HEALTH_BUCKETS,
  ROUTE_HEALTH_BUCKET_SECONDS,
  routeHealthStateFromValue,
  type RouteHealthCheck,
  type RouteHealthState,
} from '@/utils/routeHealth'
import type { ChannelRoutingMetrics } from '@/utils/routeScore'

/** Approximate a channel health percentage from response_time and status. */
function deriveHealth(responseTime: number, status: 1 | 2 | 3): number {
  if (status !== 1) return 0
  if (responseTime === 0) return 50 // untested
  if (responseTime < 300) return 92 + Math.round((300 - responseTime) / 30)
  if (responseTime < 800) return 82 + Math.round((800 - responseTime) / 50)
  if (responseTime < 2000) return 65 + Math.round((2000 - responseTime) / 80)
  return Math.max(40, 65 - Math.round((responseTime - 2000) / 200))
}

const healthAnchor =
  Math.floor(Date.now() / 1000 / ROUTE_HEALTH_BUCKET_SECONDS) *
  ROUTE_HEALTH_BUCKET_SECONDS

function deriveHealthChecks(
  id: number,
  responseTime: number,
  status: 1 | 2 | 3,
  health: number
): RouteHealthCheck[] {
  const timestamps = Array.from(
    { length: ROUTE_HEALTH_BUCKETS },
    (_, index) =>
      healthAnchor -
      (ROUTE_HEALTH_BUCKETS - index - 1) * ROUTE_HEALTH_BUCKET_SECONDS
  )

  if (status !== 1) {
    return timestamps.map((timestamp) => ({ timestamp, state: 'down' }))
  }
  if (responseTime === 0) {
    return timestamps.map((timestamp) => ({ timestamp, state: 'unknown' }))
  }

  const current = routeHealthStateFromValue(health)
  const states: RouteHealthState[] = [
    'healthy',
    'healthy',
    'degraded',
    'healthy',
    'down',
  ]
  const rotation = Math.abs(id + health) % states.length

  return timestamps.map((timestamp, index) => ({
    timestamp,
    state:
      index === ROUTE_HEALTH_BUCKETS - 1
        ? current
        : states[(index + rotation) % states.length]!,
  }))
}

export const routingChannels: ChannelRoutingMetrics[] = adminChannels.map(
  (ch) => {
    const status = ch.status as 1 | 2 | 3
    const health = deriveHealth(ch.response_time, status)

    return {
      id: ch.id,
      name: ch.name,
      supplier: ch.supplier,
      latency: ch.response_time,
      health,
      upstreamMult: ch.upstream_ratio,
      channelMult: ch.channel_ratio,
      quota: ch.balance,
      weight: ch.weight,
      priority: ch.priority,
      status,
      healthChecks: deriveHealthChecks(ch.id, ch.response_time, status, health),
    }
  }
)
