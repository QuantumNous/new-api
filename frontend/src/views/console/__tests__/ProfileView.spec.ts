import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { api } from '@/api/console'
import i18n, { loadMessageDomain, setLocale } from '@/i18n'
import { useAuthStore } from '@/stores/auth'
import { useSettingsPrototypeStore } from '@/stores/settingsPrototype'
import ProfileView from '@/views/console/ProfileView.vue'

beforeEach(async () => {
  sessionStorage.clear()
  await loadMessageDomain('console')
  await setLocale('zh-CN')
})

afterEach(() => vi.restoreAllMocks())

describe('ProfileView', () => {
  it('reads 2FA and GitHub summaries from the shared prototype store', async () => {
    vi.spyOn(api, 'get').mockImplementation(async (url: string) => {
      if (url === '/api/data/self') {
        return {
          quota: 500_000,
          used_quota: 100_000,
          today_quota: 0,
          today_requests: 0,
          total_requests: 12,
          month_quota_delta: 0,
          month_requests_delta: 0,
          model_share: [],
          limits: { rate_limit: 0, current_rpm: 0 },
          discounts: { global_ratio: 1, plan_ratio: 1, effective_ratio: 1 },
        }
      }
      if (url === '/api/data/system') {
        return {
          cpu_percent: 0,
          memory_used_gb: 0,
          memory_total_gb: 1,
          bandwidth_up_mbps: 0,
          bandwidth_down_mbps: 0,
          disk_used_gb: 0,
          disk_total_gb: 1,
          api_success_rate: 100,
          bandwidth_series: { up: [], down: [] },
        }
      }
      return []
    })

    const pinia = createPinia()
    setActivePinia(pinia)
    const auth = useAuthStore()
    auth.persist({
      id: 7,
      username: 'demo-user',
      display_name: 'Demo User',
      email: 'demo@example.com',
      role: 1,
      quota: 500_000,
      used_quota: 100_000,
    })
    const prototype = useSettingsPrototypeStore()
    prototype.initialize(auth.user)
    prototype.enableTwoFA()

    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/', name: 'profile', component: ProfileView }],
    })
    await router.push('/')
    await router.isReady()

    const wrapper = mount(ProfileView, {
      global: { plugins: [pinia, i18n, router] },
    })
    await flushPromises()

    expect(wrapper.text()).toContain('已开启')
    expect(wrapper.text()).toContain('已绑定')
  })
})
