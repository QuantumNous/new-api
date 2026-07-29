import { describe, expect, it } from 'vitest'

import { buildVendorRouteList } from '@/composables/useAutoRoute'
import type { ChannelRoutingMetrics } from '@/utils/routeScore'

const NOW = 7_500

function channel(
  id: number,
  supplier: string,
  status: 1 | 2 | 3
): ChannelRoutingMetrics {
  return {
    id,
    name: `${supplier}-${id}`,
    supplier,
    latency: 300,
    health: status === 1 ? 95 : 0,
    upstreamMult: 1,
    channelMult: 1,
    quota: 100,
    weight: 10,
    priority: 1,
    status,
  }
}

describe('buildVendorRouteList', () => {
  it('retains a supplier whose channels are all disabled', () => {
    const groups = buildVendorRouteList(
      [
        channel(1, 'Unavailable', 2),
        channel(2, 'Unavailable', 3),
        channel(3, 'Healthy', 1),
      ],
      NOW
    )
    const unavailable = groups.find((group) => group.vendor === 'Unavailable')!

    expect(unavailable.activeCount).toBe(0)
    expect(unavailable.channels).toHaveLength(2)
    expect(unavailable.channels.every((item) => item.rank === null)).toBe(true)
    expect(unavailable.channels.every((item) => item.score === null)).toBe(true)
    expect(unavailable.monitor.state).toBe('down')
    expect(unavailable.monitor.availability).toBe(0)
  })
})
