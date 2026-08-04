import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

import type { UserInfo } from '@/types/auth'

export type PrototypeNotifyType = 'email' | 'webhook' | 'bark' | 'gotify'
export type PrototypeBindingId =
  'email' | 'github' | 'linuxdo' | 'discord' | 'wechat' | 'telegram'

export interface PrototypeBinding {
  id: PrototypeBindingId
  bound: boolean
  account: string
}

export interface PrototypeNotificationSettings {
  notifyType: PrototypeNotifyType
  quotaWarningThreshold: number
  notificationEmail: string
  webhookUrl: string
  webhookSecret: string
  barkUrl: string
  gotifyUrl: string
  gotifyToken: string
  gotifyPriority: number
  walletReminder: boolean
  subscriptionReminder: boolean
  upstreamModelUpdateNotify: boolean
  acceptUnsetModelPrice: boolean
  recordIpLog: boolean
}

interface PersistedPrototypeState {
  version: 1
  passkeyEnabled: boolean
  passkeyLastUsedAt: string | null
  twoFAEnabled: boolean
  backupCodes: string[]
  backupGeneration: number
  bindings: PrototypeBinding[]
  notification: PrototypeNotificationSettings
}

export const SETTINGS_PROTOTYPE_STORAGE_PREFIX = 'ren2hub_settings_prototype_v1'

const bindingIds: PrototypeBindingId[] = [
  'email',
  'github',
  'linuxdo',
  'discord',
  'wechat',
  'telegram',
]

const notifyTypes = new Set<PrototypeNotifyType>([
  'email',
  'webhook',
  'bark',
  'gotify',
])

function defaultNotification(): PrototypeNotificationSettings {
  return {
    notifyType: 'email',
    quotaWarningThreshold: 500_000,
    notificationEmail: '',
    webhookUrl: '',
    webhookSecret: '',
    barkUrl: '',
    gotifyUrl: '',
    gotifyToken: '',
    gotifyPriority: 5,
    walletReminder: false,
    subscriptionReminder: false,
    upstreamModelUpdateNotify: false,
    acceptUnsetModelPrice: false,
    recordIpLog: false,
  }
}

function readBindingAccount(
  user: UserInfo | null,
  field: keyof UserInfo,
  demoFallback = ''
): string {
  if (!user) return demoFallback
  if (!Object.hasOwn(user, field)) return demoFallback
  const value = user[field]
  return typeof value === 'string' ? value.trim() : ''
}

function defaultBindings(user: UserInfo | null): PrototypeBinding[] {
  const accounts: Record<PrototypeBindingId, string> = {
    email: user?.email?.trim() ?? '',
    github: readBindingAccount(user, 'github_id', 'ren2-demo'),
    linuxdo: readBindingAccount(user, 'linux_do_id'),
    discord: readBindingAccount(user, 'discord_id'),
    wechat: readBindingAccount(user, 'wechat_id'),
    telegram: readBindingAccount(user, 'telegram_id'),
  }

  return bindingIds.map((id) => ({
    id,
    bound: Boolean(accounts[id]),
    account: accounts[id],
  }))
}

function storageKey(userId: number): string {
  return `${SETTINGS_PROTOTYPE_STORAGE_PREFIX}:${userId}`
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isNotificationSettings(
  value: unknown
): value is PrototypeNotificationSettings {
  if (!isRecord(value)) return false
  return (
    notifyTypes.has(value.notifyType as PrototypeNotifyType) &&
    typeof value.quotaWarningThreshold === 'number' &&
    typeof value.notificationEmail === 'string' &&
    typeof value.webhookUrl === 'string' &&
    typeof value.webhookSecret === 'string' &&
    typeof value.barkUrl === 'string' &&
    typeof value.gotifyUrl === 'string' &&
    typeof value.gotifyToken === 'string' &&
    typeof value.gotifyPriority === 'number' &&
    typeof value.walletReminder === 'boolean' &&
    typeof value.subscriptionReminder === 'boolean' &&
    typeof value.upstreamModelUpdateNotify === 'boolean' &&
    typeof value.acceptUnsetModelPrice === 'boolean' &&
    typeof value.recordIpLog === 'boolean'
  )
}

function isBinding(value: unknown): value is PrototypeBinding {
  if (!isRecord(value)) return false
  return (
    bindingIds.includes(value.id as PrototypeBindingId) &&
    typeof value.bound === 'boolean' &&
    typeof value.account === 'string'
  )
}

function isPersistedState(value: unknown): value is PersistedPrototypeState {
  if (!isRecord(value)) return false
  return (
    value.version === 1 &&
    typeof value.passkeyEnabled === 'boolean' &&
    (typeof value.passkeyLastUsedAt === 'string' ||
      value.passkeyLastUsedAt === null) &&
    typeof value.twoFAEnabled === 'boolean' &&
    Array.isArray(value.backupCodes) &&
    value.backupCodes.every((code) => typeof code === 'string') &&
    typeof value.backupGeneration === 'number' &&
    Array.isArray(value.bindings) &&
    value.bindings.every(isBinding) &&
    isNotificationSettings(value.notification)
  )
}

function createBackupCodes(generation: number): string[] {
  return Array.from({ length: 4 }, (_, index) => {
    const seed = (generation + 1) * 7919 + (index + 1) * 3571
    const left = (seed * 17).toString(16).slice(-4).padStart(4, '0')
    const right = (seed * 29).toString(16).slice(-4).padStart(4, '0')
    return `DEMO-${left}-${right}`.toUpperCase()
  })
}

export const useSettingsPrototypeStore = defineStore(
  'settingsPrototype',
  () => {
    const initialized = ref(false)
    const userId = ref(0)
    const passkeyEnabled = ref(false)
    const passkeyLastUsedAt = ref<string | null>(null)
    const twoFAEnabled = ref(false)
    const backupCodes = ref<string[]>([])
    const backupGeneration = ref(0)
    const bindings = ref<PrototypeBinding[]>([])
    const notification = ref<PrototypeNotificationSettings>(
      defaultNotification()
    )

    const backupCodesRemaining = computed(() => backupCodes.value.length)
    const githubBound = computed(
      () => bindings.value.find((item) => item.id === 'github')?.bound ?? false
    )

    function snapshot(): PersistedPrototypeState {
      return {
        version: 1,
        passkeyEnabled: passkeyEnabled.value,
        passkeyLastUsedAt: passkeyLastUsedAt.value,
        twoFAEnabled: twoFAEnabled.value,
        backupCodes: [...backupCodes.value],
        backupGeneration: backupGeneration.value,
        bindings: bindings.value.map((item) => ({ ...item })),
        notification: { ...notification.value },
      }
    }

    function persist(): void {
      if (!initialized.value) return
      try {
        window.sessionStorage.setItem(
          storageKey(userId.value),
          JSON.stringify(snapshot())
        )
      } catch {
        // Restricted storage keeps the prototype state in memory for this view.
      }
    }

    function reset(user: UserInfo | null): void {
      passkeyEnabled.value = false
      passkeyLastUsedAt.value = null
      twoFAEnabled.value = false
      backupCodes.value = []
      backupGeneration.value = 0
      bindings.value = defaultBindings(user)
      notification.value = defaultNotification()
    }

    function initialize(user: UserInfo | null): void {
      const nextUserId = user?.id ?? 0
      if (initialized.value && userId.value === nextUserId) return

      userId.value = nextUserId
      reset(user)
      try {
        const raw = window.sessionStorage.getItem(storageKey(nextUserId))
        if (raw) {
          const parsed: unknown = JSON.parse(raw)
          if (isPersistedState(parsed)) {
            passkeyEnabled.value = parsed.passkeyEnabled
            passkeyLastUsedAt.value = parsed.passkeyLastUsedAt
            twoFAEnabled.value = parsed.twoFAEnabled
            backupCodes.value = [...parsed.backupCodes]
            backupGeneration.value = parsed.backupGeneration
            const savedBindings = new Map(
              parsed.bindings.map((item) => [item.id, item])
            )
            bindings.value = defaultBindings(user).map((fallback) => {
              const saved = savedBindings.get(fallback.id)
              return saved ? { ...saved } : fallback
            })
            notification.value = { ...parsed.notification }
          }
        }
      } catch {
        reset(user)
      }
      initialized.value = true
    }

    function registerPasskey(): void {
      passkeyEnabled.value = true
      passkeyLastUsedAt.value = null
      persist()
    }

    function removePasskey(): void {
      passkeyEnabled.value = false
      passkeyLastUsedAt.value = null
      persist()
    }

    function enableTwoFA(): string[] {
      twoFAEnabled.value = true
      backupCodes.value = createBackupCodes(backupGeneration.value)
      persist()
      return [...backupCodes.value]
    }

    function regenerateBackupCodes(): string[] {
      backupGeneration.value += 1
      backupCodes.value = createBackupCodes(backupGeneration.value)
      persist()
      return [...backupCodes.value]
    }

    function disableTwoFA(): void {
      twoFAEnabled.value = false
      backupCodes.value = []
      persist()
    }

    function bindAccount(id: PrototypeBindingId, account: string): void {
      const binding = bindings.value.find((item) => item.id === id)
      if (!binding) return
      binding.bound = true
      binding.account = account.trim()
      persist()
    }

    function unbindAccount(id: PrototypeBindingId): void {
      const binding = bindings.value.find((item) => item.id === id)
      if (!binding) return
      binding.bound = false
      binding.account = ''
      persist()
    }

    function saveNotification(next: PrototypeNotificationSettings): void {
      notification.value = { ...next }
      persist()
    }

    return {
      initialized,
      passkeyEnabled,
      passkeyLastUsedAt,
      twoFAEnabled,
      backupCodes,
      backupCodesRemaining,
      bindings,
      githubBound,
      notification,
      initialize,
      registerPasskey,
      removePasskey,
      enableTwoFA,
      regenerateBackupCodes,
      disableTwoFA,
      bindAccount,
      unbindAccount,
      saveNotification,
    }
  }
)
