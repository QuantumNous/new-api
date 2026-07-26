/**
 * Mock data for the auto-routing dashboard tab.
 * Derived from the same adminChannels seed so vendor names are consistent.
 */
import { adminChannels } from './data'
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

export const routingChannels: ChannelRoutingMetrics[] = adminChannels.map(
  (ch) => ({
    id: ch.id,
    name: ch.name,
    supplier: ch.supplier,
    latency: ch.response_time,
    health: deriveHealth(ch.response_time, ch.status as 1 | 2 | 3),
    upstreamMult: ch.upstream_ratio,
    channelMult: ch.channel_ratio,
    quota: ch.balance,
    weight: ch.weight,
    priority: ch.priority,
    status: ch.status as 1 | 2 | 3,
  })
)
