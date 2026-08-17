import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const route = vi.hoisted(() => ({ query: { aff: 'INVALID' } }))
const push = vi.hoisted(() => vi.fn())
const validateAffiliate = vi.hoisted(() => vi.fn())

vi.mock('vue-router', async () => {
  const actual =
    await vi.importActual<typeof import('vue-router')>('vue-router')
  return {
    ...actual,
    useRoute: () => route,
    useRouter: () => ({ push }),
  }
})
vi.mock('@/api/auth', () => ({
  authApi: {
    register: vi.fn(),
    validateAffiliate,
  },
}))

import { ApiError } from '@/api/types'
import i18n, { loadMessageDomain, setLocale } from '@/i18n'
import { useAppStore } from '@/stores/app'
import { storeAffiliateAttribution } from '@/utils/affiliate'
import SignUpView from '../SignUpView.vue'

describe('SignUpView affiliate attribution', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    localStorage.clear()
    const pinia = createPinia()
    setActivePinia(pinia)
    const app = useAppStore()
    app.phase = 'ready'
    await loadMessageDomain('auth')
    await setLocale('zh-CN')
  })

  it('restores the stored code when a new link carries an invalid code', async () => {
    storeAffiliateAttribution('STORED-CODE')
    validateAffiliate.mockRejectedValueOnce(
      new ApiError('邀请码无效', { business: true })
    )
    const pinia = createPinia()
    setActivePinia(pinia)
    const app = useAppStore()
    app.phase = 'ready'

    const wrapper = mount(SignUpView, {
      global: {
        plugins: [pinia, i18n],
        stubs: {
          AuthLayout: { template: '<div><slot /></div>' },
          PasswordStrengthMeter: true,
          RouterLink: true,
        },
      },
    })
    await flushPromises()

    const inputs = wrapper.findAll('input')
    expect(inputs.at(-1)?.element.value).toBe('STORED-CODE')
    expect(validateAffiliate).toHaveBeenCalledWith('INVALID')
    expect(wrapper.text()).not.toContain('邀请码无效')
    wrapper.unmount()
  })
})
