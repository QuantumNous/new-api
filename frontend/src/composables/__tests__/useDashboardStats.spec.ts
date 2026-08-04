import { defineComponent } from 'vue'
import { mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { api } from '@/api/console'
import {
  useDashboardStats,
  type StatsPeriod,
} from '@/composables/useDashboardStats'
import i18n from '@/i18n'

function statsPeriod(marker: number): StatsPeriod {
  return {
    kpi: {
      totalTokens: marker,
      totalQuota: 0,
      totalRequests: 0,
      avgLatency: 0,
      successRate: 0,
    },
    comparison: { quotaDelta: null, requestsDelta: null },
    models: [],
    hourly: [],
    flow: [],
  }
}

let wrapper: VueWrapper | null = null

function setupStats() {
  let state: ReturnType<typeof useDashboardStats> | null = null
  wrapper = mount(
    defineComponent({
      setup() {
        state = useDashboardStats()
        return () => null
      },
    }),
    { global: { plugins: [i18n] } }
  )
  if (!state) throw new Error('expected stats composable instance')
  return state as ReturnType<typeof useDashboardStats>
}

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  vi.restoreAllMocks()
})

describe('useDashboardStats', () => {
  it('discards a late response from a superseded range', async () => {
    const stats = setupStats()

    let resolveSlow: (value: StatsPeriod) => void = () => undefined
    const slow = new Promise<StatsPeriod>((resolve) => {
      resolveSlow = resolve
    })
    const fast = Promise.resolve(statsPeriod(2))
    vi.spyOn(api, 'get').mockReturnValueOnce(slow).mockReturnValueOnce(fast)

    stats.range.value = '30d'
    const firstLoad = stats.load() // hangs on `slow`
    stats.range.value = '7d'
    await stats.load() // resolves immediately with marker 2

    expect(stats.data.value?.kpi.totalTokens).toBe(2)
    expect(stats.loading.value).toBe(false)

    // The stale 30d response lands afterwards and must not clobber 7d data.
    resolveSlow(statsPeriod(1))
    await firstLoad
    expect(stats.data.value?.kpi.totalTokens).toBe(2)
  })

  it('sends the custom window bounds only for the custom range', async () => {
    const stats = setupStats()
    const get = vi.spyOn(api, 'get').mockResolvedValue(statsPeriod(1) as never)

    stats.range.value = 'custom'
    stats.customStart.value = '2026-07-01'
    stats.customEnd.value = '2026-07-14'
    await stats.load()

    expect(get).toHaveBeenCalledWith(
      '/api/data/stats',
      { range: 'custom', start: '2026-07-01', end: '2026-07-14' },
      expect.anything()
    )
  })
})
