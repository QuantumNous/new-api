import { nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { authApi } from '@/api/auth'
import { api } from '@/api/console'
import { writeDemoUser } from '@/api/demoStorage'
import { resetMockState, setMockDelay } from '@/api/mock/state'
import { ApiError, type PageResult } from '@/api/types'
import KeyRevealModal from '@/components/console/keys/KeyRevealModal.vue'
import i18n from '@/i18n'
import type { TokenSummary } from '@/types/console'

beforeEach(() => {
  resetMockState()
  setMockDelay(0)
})

afterEach(() => vi.restoreAllMocks())

describe('KeyRevealModal', () => {
  it('clears and invalidates an in-flight secret when closed', async () => {
    const { user } = await authApi.login('demo', 'password123')
    writeDemoUser(user)
    const page = await api.get<PageResult<TokenSummary>>('/api/token/', {
      page: 1,
      page_size: 1,
    })

    setMockDelay(50)
    const wrapper = mount(KeyRevealModal, {
      attachTo: document.body,
      global: { plugins: [i18n] },
      props: { open: false, tokenId: page.items[0].id },
    })

    await wrapper.setProps({ open: true })
    await nextTick()
    await wrapper.setProps({ open: false })
    await new Promise((resolve) => window.setTimeout(resolve, 70))

    const instance = wrapper.vm.$ as unknown as {
      setupState: { fullKey: string; loading: boolean }
    }
    expect(instance.setupState.fullKey).toBe('')
    expect(instance.setupState.loading).toBe(false)
    wrapper.unmount()
  })

  it('silently ignores a transport-wrapped cancellation', async () => {
    let rejectRequest: (error: ApiError) => void = () => undefined
    const request = new Promise<never>((_resolve, reject) => {
      rejectRequest = reject
    })
    vi.spyOn(api, 'get').mockReturnValue(request)

    const wrapper = mount(KeyRevealModal, {
      attachTo: document.body,
      global: { plugins: [i18n] },
      props: { open: false, tokenId: 1 },
    })

    await wrapper.setProps({ open: true })
    await nextTick()
    await wrapper.setProps({ open: false })
    rejectRequest(new ApiError('canceled by transport'))
    await nextTick()

    expect(wrapper.emitted('close')).toBeUndefined()
    wrapper.unmount()
  })
})
