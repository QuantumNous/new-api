import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import {
  SETTINGS_PROTOTYPE_STORAGE_PREFIX,
  useSettingsPrototypeStore,
} from '@/stores/settingsPrototype'
import type { UserInfo } from '@/types/auth'

const user: UserInfo = {
  id: 7,
  username: 'demo-user',
  display_name: 'Demo User',
  email: 'demo@example.com',
  role: 1,
  quota: 500_000,
  used_quota: 100_000,
}

beforeEach(() => {
  sessionStorage.clear()
  setActivePinia(createPinia())
})

describe('settingsPrototype store', () => {
  it('initializes account-derived bindings and stable defaults', () => {
    const store = useSettingsPrototypeStore()
    store.initialize(user)

    expect(store.notification.quotaWarningThreshold).toBe(500_000)
    expect(store.bindings.find((item) => item.id === 'email')).toMatchObject({
      bound: true,
      account: 'demo@example.com',
    })
    expect(store.bindings.find((item) => item.id === 'github')).toMatchObject({
      bound: true,
      account: 'ren2-demo',
    })
  })

  it('persists confirmed prototype actions for the browser session', () => {
    const store = useSettingsPrototypeStore()
    store.initialize(user)
    store.registerPasskey()
    store.enableTwoFA()
    store.bindAccount('linuxdo', 'linuxdo-demo')
    store.saveNotification({
      ...store.notification,
      notifyType: 'webhook',
      webhookUrl: 'https://example.com/hook',
      walletReminder: true,
    })

    setActivePinia(createPinia())
    const restored = useSettingsPrototypeStore()
    restored.initialize(user)

    expect(restored.passkeyEnabled).toBe(true)
    expect(restored.twoFAEnabled).toBe(true)
    expect(restored.backupCodes).toHaveLength(4)
    expect(
      restored.bindings.find((item) => item.id === 'linuxdo')
    ).toMatchObject({ bound: true, account: 'linuxdo-demo' })
    expect(restored.notification).toMatchObject({
      notifyType: 'webhook',
      webhookUrl: 'https://example.com/hook',
      walletReminder: true,
    })
  })

  it('resets malformed storage and isolates different users', () => {
    sessionStorage.setItem(
      `${SETTINGS_PROTOTYPE_STORAGE_PREFIX}:${user.id}`,
      '{broken'
    )
    const first = useSettingsPrototypeStore()
    first.initialize(user)
    expect(first.passkeyEnabled).toBe(false)

    first.registerPasskey()
    first.initialize({ ...user, id: 8, email: 'other@example.com' })
    expect(first.passkeyEnabled).toBe(false)
    expect(first.bindings.find((item) => item.id === 'email')?.account).toBe(
      'other@example.com'
    )
  })
})
