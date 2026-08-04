import { mount, type DOMWrapper, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import i18n, { loadMessageDomain, setLocale } from '@/i18n'
import { useAuthStore } from '@/stores/auth'
import { useSettingsPrototypeStore } from '@/stores/settingsPrototype'
import AccountSettingsView from '@/views/console/AccountSettingsView.vue'

function buttonByText(wrapper: VueWrapper | DOMWrapper<Element>, text: string) {
  const button = wrapper
    .findAll('button')
    .find((item) => item.text().includes(text))
  if (!button) throw new Error(`Button not found: ${text}`)
  return button
}

async function mountView() {
  const pinia = createPinia()
  setActivePinia(pinia)
  const auth = useAuthStore()
  auth.persist({
    id: 7,
    username: 'demo-user',
    display_name: 'Demo User',
    email: 'demo@example.com',
    role: 10,
    quota: 500_000,
    used_quota: 100_000,
  })
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: AccountSettingsView },
      {
        path: '/auth/sign-in',
        name: 'sign-in',
        component: { template: '<div />' },
      },
    ],
  })
  await router.push('/')
  await router.isReady()

  const wrapper = mount(AccountSettingsView, {
    global: {
      plugins: [pinia, i18n, router],
      stubs: { Teleport: true },
    },
  })
  return { wrapper, auth, prototype: useSettingsPrototypeStore() }
}

beforeEach(async () => {
  sessionStorage.clear()
  await loadMessageDomain('auth')
  await loadMessageDomain('console')
  await setLocale('zh-CN')
})

afterEach(() => vi.restoreAllMocks())

describe('AccountSettingsView', () => {
  it('renders the two account-center panels and all binding providers', async () => {
    const { wrapper } = await mountView()

    expect(wrapper.text()).toContain(
      String(i18n.global.t('settings.accountSecurityPanel'))
    )
    expect(wrapper.text()).toContain(
      String(i18n.global.t('settings.preferencesPanel'))
    )
    expect(wrapper.text()).not.toContain(
      String(i18n.global.t('settings.demoBadge'))
    )
    for (const provider of [
      '邮箱',
      'GitHub',
      'LinuxDO',
      'Discord',
      '微信',
      'Telegram',
    ]) {
      expect(wrapper.text()).toContain(provider)
    }
  })

  it('completes the Passkey and 2FA prototype flows', async () => {
    const { wrapper, prototype } = await mountView()

    await buttonByText(wrapper, '启用 Passkey').trigger('click')
    const passkeyDialog = wrapper.findAll('[role="dialog"]').at(-1)!
    await buttonByText(passkeyDialog, '确认').trigger('click')
    expect(prototype.passkeyEnabled).toBe(true)

    await buttonByText(wrapper, '启用两步验证').trigger('click')
    const setupDialog = wrapper.findAll('[role="dialog"]').at(-1)!
    await setupDialog.get('input[placeholder="000000"]').setValue('123456')
    await buttonByText(setupDialog, '启用两步验证').trigger('click')
    expect(prototype.twoFAEnabled).toBe(true)
    expect(prototype.backupCodes).toHaveLength(4)
  })

  it('validates notification fields before committing the draft', async () => {
    const { wrapper, prototype } = await mountView()

    await buttonByText(wrapper, 'Webhook').trigger('click')
    await buttonByText(wrapper, '保存通知设置').trigger('click')
    expect(wrapper.text()).toContain('请输入有效的 HTTP 或 HTTPS 地址')
    expect(prototype.notification.notifyType).toBe('email')

    await wrapper
      .get('input[placeholder="https://example.com/webhook"]')
      .setValue('https://example.com/hook')
    const walletToggle = wrapper.get(
      'button[role="switch"][aria-label="钱包额度提醒"]'
    )
    await walletToggle.trigger('click')
    await buttonByText(wrapper, '保存通知设置').trigger('click')

    expect(prototype.notification).toMatchObject({
      notifyType: 'webhook',
      webhookUrl: 'https://example.com/hook',
      walletReminder: true,
    })
  })

  it('keeps the existing display-name action connected to the auth store', async () => {
    const { wrapper, auth } = await mountView()
    const updateProfile = vi.spyOn(auth, 'updateProfile').mockResolvedValue()

    await buttonByText(wrapper, '编辑').trigger('click')
    const dialog = wrapper.findAll('[role="dialog"]').at(-1)!
    await dialog.get('input[name="display-name"]').setValue('Renamed User')
    await buttonByText(dialog, '保存资料').trigger('click')

    expect(updateProfile).toHaveBeenCalledWith({ display_name: 'Renamed User' })
  })
})
