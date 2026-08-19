import { createPinia } from 'pinia'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

import { api } from '@/api/console'
import i18n, { loadMessageDomain, setLocale } from '@/i18n'
import LogsView from '@/views/console/LogsView.vue'

let wrapper: VueWrapper | null = null

beforeAll(async () => {
  await loadMessageDomain('console')
  await setLocale('zh-CN')
})

beforeEach(() => {
  vi.spyOn(api, 'get').mockImplementation((path: string) => {
    if (path === '/api/log/self') {
      return Promise.resolve({ page: 1, page_size: 10, total: 0, items: [] })
    }
    if (path === '/api/log/self/stat') {
      return Promise.resolve({
        total_requests: 0,
        total_quota: 0,
        today_requests: 0,
        today_quota: 0,
      })
    }
    return Promise.reject(new Error(`Unexpected API request: ${path}`))
  })
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  vi.restoreAllMocks()
})

describe('LogsView business log filters', () => {
  it('does not expose operation log types in the consume log filter', async () => {
    wrapper = mount(LogsView, {
      attachTo: document.body,
      global: {
        plugins: [createPinia(), i18n],
        stubs: { LogsNavTabs: true },
      },
    })
    await flushPromises()

    await wrapper.get('button[aria-label="类型"]').trigger('click')
    const options = wrapper
      .findAll('[role="option"]')
      .map((item) => item.text())

    expect(options).toEqual(['全部', '消费', '充值', '退款', '错误'])
    expect(options).not.toContain('管理')
    expect(options).not.toContain('系统')
    expect(options).not.toContain('登录')
  })
})
