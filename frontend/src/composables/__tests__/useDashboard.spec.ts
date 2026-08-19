import { defineComponent } from 'vue'
import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { api } from '@/api/console'
import {
  fetchSelfUsage,
  useDashboard,
  type TokenTrendPoint,
} from '@/composables/useDashboard'
import i18n from '@/i18n'

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

function mountDashboardState() {
  let state!: ReturnType<typeof useDashboard>
  const wrapper = mount(
    defineComponent({
      setup() {
        state = useDashboard()
        return () => null
      },
    }),
    { global: { plugins: [createPinia(), i18n] } }
  )
  return { state, wrapper }
}

describe('useDashboard', () => {
  it('loads the real 30-day token trend with the client timezone offset', async () => {
    const trend: TokenTrendPoint[] = [
      {
        date: '2026-08-17',
        input: 1200,
        output: 300,
        cache_create: 500,
        cache_read: 1800,
        hit_rate: 60,
      },
    ]
    const get = vi.spyOn(api, 'get').mockImplementation(async (path) => {
      if (path === '/api/data/self') return [] as never
      if (path === '/api/next/dashboard/token-trend') return trend as never
      if (path === '/api/next/dashboard/system-status') {
        return {
          cpu_percent: null,
          memory_used_gb: null,
          memory_total_gb: null,
          bandwidth_up_mbps: null,
          bandwidth_down_mbps: null,
          disk_used_gb: null,
          disk_total_gb: null,
          api_success_rate: null,
          bandwidth_series: null,
        } as never
      }
      throw new Error(`unexpected dashboard request: ${path}`)
    })
    const { state, wrapper } = mountDashboardState()
    await state.load()

    expect(state.tokenTrend.value).toEqual(trend)
    expect(get).toHaveBeenCalledWith('/api/next/dashboard/token-trend', {
      range: '30d',
      tz_offset: expect.any(String),
    })
    wrapper.unmount()
  })

  it('loads monthly spend from the local calendar-month boundary', async () => {
    vi.useFakeTimers()
    const now = new Date(2026, 7, 31, 12)
    vi.setSystemTime(now)
    const monthStartTimestamp = new Date(2026, 7, 1).getTime() / 1000
    const endTimestamp = now.getTime() / 1000
    const get = vi
      .spyOn(api, 'get')
      .mockImplementation(async (path, params) => {
        if (path === '/api/data/self') {
          if (params?.start_timestamp === monthStartTimestamp) {
            return [
              {
                model_name: 'gpt-4o',
                created_at: monthStartTimestamp,
                count: 1,
                quota: 500_000,
                token_used: 100,
              },
            ] as never
          }
          return [] as never
        }
        if (path === '/api/next/dashboard/token-trend') return [] as never
        if (path === '/api/next/dashboard/system-status') {
          return {
            cpu_percent: null,
            memory_used_gb: null,
            memory_total_gb: null,
            bandwidth_up_mbps: null,
            bandwidth_down_mbps: null,
            disk_used_gb: null,
            disk_total_gb: null,
            api_success_rate: null,
            bandwidth_series: null,
          } as never
        }
        throw new Error(`unexpected dashboard request: ${path}`)
      })
    const { state, wrapper } = mountDashboardState()
    await state.load()

    const selfUsageRanges = get.mock.calls
      .filter(([path]) => path === '/api/data/self')
      .map(([, params]) => params)
    expect(selfUsageRanges).toContainEqual({
      start_timestamp: monthStartTimestamp,
      end_timestamp: monthStartTimestamp + 30 * 86_400 - 1,
    })
    expect(selfUsageRanges).toContainEqual({
      start_timestamp: monthStartTimestamp + 30 * 86_400,
      end_timestamp: endTimestamp,
    })
    expect(state.stats.value?.month_quota).toBe(500_000)
    wrapper.unmount()
  })

  it('splits self-usage queries at the backend thirty-day limit', async () => {
    const startTimestamp = 1_700_000_000
    const maxRange = 30 * 86_400
    const get = vi.spyOn(api, 'get').mockResolvedValue([] as never)

    await fetchSelfUsage(startTimestamp, startTimestamp + maxRange)

    expect(get).toHaveBeenCalledTimes(2)
    expect(get.mock.calls[0]?.[1]).toEqual({
      start_timestamp: startTimestamp,
      end_timestamp: startTimestamp + maxRange - 1,
    })
    expect(get.mock.calls[1]?.[1]).toEqual({
      start_timestamp: startTimestamp + maxRange,
      end_timestamp: startTimestamp + maxRange,
    })
  })
})
