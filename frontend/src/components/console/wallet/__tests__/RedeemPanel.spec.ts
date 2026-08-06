import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import { api } from '@/api/console'
import RedeemPanel from '@/components/console/wallet/RedeemPanel.vue'
import { useToast } from '@/composables/useToast'
import i18n, { loadMessageDomain, setLocale } from '@/i18n'

beforeAll(async () => {
  await loadMessageDomain('console')
  setLocale('en')
})

afterEach(() => {
  vi.restoreAllMocks()
  useToast().toasts.splice(0)
})

describe('RedeemPanel', () => {
  it('renders the real redemption form without a fake history request', async () => {
    const get = vi.spyOn(api, 'get')
    const wrapper = mount(RedeemPanel, {
      global: { plugins: [createPinia(), i18n] },
    })

    await flushPromises()

    expect(get).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('Redeem code')
    expect(wrapper.text()).not.toContain('No redeem records yet')
    expect(wrapper.find('input').attributes('placeholder')).toBe(
      'Enter redeem code'
    )

    wrapper.unmount()
  })
})
