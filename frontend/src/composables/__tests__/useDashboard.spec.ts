import { defineComponent } from 'vue'
import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { api } from '@/api/console'
import { useDashboard, type TokenTrendPoint } from '@/composables/useDashboard'
import i18n from '@/i18n'

afterEach(() => {
  vi.restoreAllMocks()
})

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
    let state: ReturnType<typeof useDashboard> | null = null
    const wrapper = mount(
      defineComponent({
        setup() {
          state = useDashboard()
          return () => null
        },
      }),
      { global: { plugins: [createPinia(), i18n] } }
    )

    const dashboard = state as unknown as ReturnType<typeof useDashboard>
    await dashboard.load()

    expect(dashboard.tokenTrend.value).toEqual(trend)
    expect(get).toHaveBeenCalledWith('/api/next/dashboard/token-trend', {
      range: '30d',
      tz_offset: expect.any(String),
    })
    wrapper.unmount()
  })
})
