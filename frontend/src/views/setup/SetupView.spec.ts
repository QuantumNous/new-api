import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'

const replace = vi.hoisted(() => vi.fn())
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))

vi.mock('vue-router', async () => {
  const actual =
    await vi.importActual<typeof import('vue-router')>('vue-router')
  return { ...actual, useRouter: () => ({ replace }) }
})
vi.mock('@/composables/useToast', () => ({ useToast: () => toast }))

import i18n, { loadMessageDomain, setLocale } from '@/i18n'
import { useAppStore } from '@/stores'
import { useSetupStore } from '@/stores/setup'
import SetupView from './SetupView.vue'

async function mountSetup(rootInitialized = false) {
  const pinia = createPinia()
  setActivePinia(pinia)
  await loadMessageDomain('setup')
  await setLocale('zh-CN')

  const setup = useSetupStore()
  setup.phase = 'ready'
  setup.status = {
    status: false,
    root_init: rootInitialized,
    database_type: 'sqlite',
  }
  const app = useAppStore()
  app.phase = 'ready'

  const wrapper = mount(SetupView, {
    attachTo: document.body,
    global: {
      plugins: [pinia, i18n],
      stubs: {
        BrandMark: true,
        LanguageSelector: true,
        ThemeSwitcher: true,
      },
    },
  })
  await flushPromises()
  return { wrapper, setup }
}

describe('SetupView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('keeps account fields across navigation without exposing the password', async () => {
    const { wrapper, setup } = await mountSetup()
    const continueButton = () =>
      wrapper.findAll('button').find((button) => button.text() === '继续')!

    await continueButton().trigger('click')
    await wrapper.get('#setup-username').setValue('admin')
    await wrapper.get('#setup-password').setValue('secret123')
    await wrapper.get('#setup-confirm-password').setValue('secret123')
    await continueButton().trigger('click')
    await continueButton().trigger('click')

    expect(wrapper.text()).not.toContain('secret123')
    expect(setup.values.password).toBe('secret123')
    await wrapper
      .findAll('button')
      .find((button) => button.text() === '返回')!
      .trigger('click')
    await wrapper
      .findAll('button')
      .find((button) => button.text() === '返回')!
      .trigger('click')
    expect(wrapper.get<HTMLInputElement>('#setup-password').element.value).toBe(
      'secret123'
    )
    expect(document.querySelector('label[for="setup-password"]')).not.toBeNull()
    expect(document.querySelector('label button')).toBeNull()
    wrapper.unmount()
  })

  it('skips account inputs when a root administrator already exists', async () => {
    const { wrapper } = await mountSetup(true)
    await wrapper
      .findAll('button')
      .find((button) => button.text() === '继续')!
      .trigger('click')

    expect(wrapper.find('#setup-username').exists()).toBe(false)
    expect(wrapper.text()).toContain('复用现有凭据')
    wrapper.unmount()
  })

  it('keeps fields and reenables submission after a business failure', async () => {
    const { wrapper, setup } = await mountSetup()
    setup.currentStep = 3
    setup.values.username = 'admin'
    setup.values.password = 'password123'
    setup.values.confirmPassword = 'password123'
    vi.spyOn(setup, 'submit').mockRejectedValue(new Error('failed'))
    await wrapper.vm.$nextTick()

    const submit = wrapper
      .findAll('button')
      .find((button) => button.text().includes('初始化系统'))!
    await submit.trigger('click')
    await flushPromises()

    expect(setup.values.password).toBe('password123')
    expect(submit.attributes('disabled')).toBeUndefined()
    expect(toast.error).toHaveBeenCalled()
    wrapper.unmount()
  })
})
