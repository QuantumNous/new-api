import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'

import { api } from '@/api/console'
import i18n, { loadMessageDomain, setLocale } from '@/i18n'
import type { TokenSummary } from '@/types/console'
import KeysView from '@/views/console/KeysView.vue'

const tokens: TokenSummary[] = Array.from({ length: 10 }, (_, index) => ({
  id: index + 1,
  name: `Token ${index + 1}`,
  key_preview: `sk-${index + 1}...demo`,
  type: index % 2 === 0 ? 'auto' : 'manual',
  status: 1,
  used_quota: 100,
  remain_quota: 900,
  unlimited: false,
  model_limits: [],
  ip_limits: [],
  rate_limit: 0,
  load_balance: true,
  channels: [],
  expired_time: -1,
  created_time: 1_722_000_000,
}))

let wrapper: VueWrapper | null = null

beforeAll(async () => {
  await loadMessageDomain('console')
  await setLocale('zh-CN')
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  vi.restoreAllMocks()
})

describe('KeysView mobile loading contract', () => {
  it('keeps pagination and focus stable with page-sized skeletons', async () => {
    let tokenRequestCount = 0
    const pendingPage = new Promise<never>(() => {})
    vi.spyOn(api, 'get').mockImplementation((path: string) => {
      if (path === '/api/models/available') {
        return Promise.resolve({ models: [] })
      }
      if (path === '/api/token/') {
        tokenRequestCount++
        if (tokenRequestCount > 1) return pendingPage
        return Promise.resolve({ items: tokens, total: 25 })
      }
      return Promise.reject(new Error(`Unexpected API request: ${path}`))
    })

    wrapper = mount(KeysView, {
      attachTo: document.body,
      global: { plugins: [i18n] },
    })
    await flushPromises()

    const pagination = wrapper.get('[data-key-mobile-pagination]')
    const nextPage = pagination.get('button[aria-label="下一页"]')
    const nextPageButton = nextPage.element as HTMLButtonElement
    nextPageButton.focus()
    await nextPage.trigger('click')
    await flushPromises()

    expect(wrapper.findAll('[data-key-mobile-skeleton-row]')).toHaveLength(10)
    expect(
      wrapper.get('[data-key-mobile-pagination]').attributes('aria-busy')
    ).toBe('true')
    expect(document.activeElement).toBe(nextPageButton)
  })
})
