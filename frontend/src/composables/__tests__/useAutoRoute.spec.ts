import { defineComponent } from 'vue'
import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { api } from '@/api/console'
import { buildVendorRouteList, useAutoRoute } from '@/composables/useAutoRoute'
import i18n from '@/i18n'
import type { ChannelRoutingMetrics } from '@/utils/routeScore'

const NOW = 7_500

afterEach(() => {
  vi.restoreAllMocks()
})

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

  it('loads the authenticated administrator routing contract', async () => {
    const get = vi.spyOn(api, 'get').mockResolvedValue([] as never)
    let state: ReturnType<typeof useAutoRoute> | null = null
    const wrapper = mount(
      defineComponent({
        setup() {
          state = useAutoRoute()
          return () => null
        },
      }),
      { global: { plugins: [i18n] } }
    )

    await (state as unknown as ReturnType<typeof useAutoRoute>).load()

    expect(get).toHaveBeenCalledWith(
      '/api/next/admin/dashboard/routes',
      undefined,
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    )
    wrapper.unmount()
  })
})
