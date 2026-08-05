import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'

import { publicApi, type PublicStatus } from '@/api/public'
import { BRAND_LOGO_PATH } from '@/constants/branding'
import { useAuthStore } from '@/stores/auth'
import { safeExternalUrl, safeImageUrl } from '@/utils/safeUrl'

export type PublicLoadState =
  'idle' | 'loading' | 'ready' | 'degraded' | 'error'

export interface ModuleAccess {
  enabled: boolean
  requireAuth: boolean
}

const DEFAULT_SYSTEM_NAME = 'RenRen AI'

function parseBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === 'boolean') return value
  if (value === 1 || value === '1' || value === 'true') return true
  if (value === 0 || value === '0' || value === 'false') return false
  return fallback
}

function parseModuleAccess(value: unknown): ModuleAccess {
  if (!value || typeof value !== 'object') {
    return { enabled: parseBoolean(value, true), requireAuth: false }
  }
  const record = value as Record<string, unknown>
  return {
    enabled: parseBoolean(record.enabled, true),
    requireAuth: parseBoolean(record.requireAuth, false),
  }
}

export function parseHeaderModules(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object')
    return value as Record<string, unknown>
  if (typeof value !== 'string' || !value.trim()) return {}
  try {
    const parsed: unknown = JSON.parse(value)
    return parsed && typeof parsed === 'object'
      ? (parsed as Record<string, unknown>)
      : {}
  } catch {
    return {}
  }
}

function toPlainText(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) return ''
  const documentNode = new DOMParser().parseFromString(value, 'text/html')
  return (documentNode.body.textContent || '').replace(/\s+/g, ' ').trim()
}

export const useAppStore = defineStore('app', () => {
  const auth = useAuthStore()
  const phase = ref<PublicLoadState>('idle')
  const statusReachable = ref(false)
  const status = ref<PublicStatus>({})
  const notice = ref('')
  const modelCount = ref<number | null>(null)
  const uptimePercent = ref<number | null>(null)
  const lastError = ref<unknown>(null)
  let initializationPromise: Promise<void> | null = null

  const initialized = computed(
    () => phase.value === 'ready' || phase.value === 'degraded'
  )
  const loading = computed(() => phase.value === 'loading')
  const online = computed(() => phase.value === 'ready')
  const systemName = computed(
    () => status.value.system_name?.trim() || DEFAULT_SYSTEM_NAME
  )
  const logo = computed(
    () => safeImageUrl(status.value.logo) || BRAND_LOGO_PATH
  )
  const docsLink = computed(() => safeExternalUrl(status.value.docs_link) || '')
  const version = computed(() => status.value.version?.trim() || '')
  const headerModules = computed(() =>
    parseHeaderModules(status.value.HeaderNavModules)
  )
  const pricingAccess = computed(() =>
    parseModuleAccess(headerModules.value.pricing)
  )
  const showPricing = computed(
    () =>
      pricingAccess.value.enabled &&
      (!pricingAccess.value.requireAuth || auth.isAuthenticated)
  )
  const showDocs = computed(
    () =>
      parseBoolean(headerModules.value.docs, true) && Boolean(docsLink.value)
  )
  const showAbout = computed(() =>
    parseBoolean(headerModules.value.about, true)
  )
  const userAgreementEnabled = computed(() =>
    Boolean(status.value.user_agreement_enabled)
  )
  const privacyPolicyEnabled = computed(() =>
    Boolean(status.value.privacy_policy_enabled)
  )
  const registerEnabled = computed(() =>
    parseBoolean(status.value.register_enabled, true)
  )
  const modelCountLabel = computed(() =>
    modelCount.value === null ? '--' : String(modelCount.value)
  )
  const uptimeLabel = computed(() =>
    uptimePercent.value === null ? '--' : `${uptimePercent.value.toFixed(2)}%`
  )
  const versionLabel = computed(() => version.value || '--')

  function applyBranding(): void {
    document.title = `${systemName.value} | One Key, All Models`
    const customLogo = safeImageUrl(status.value.logo)
    if (!customLogo) return
    let favicon = document.querySelector<HTMLLinkElement>('link[rel="icon"]')
    if (!favicon) {
      favicon = document.createElement('link')
      favicon.rel = 'icon'
      document.head.append(favicon)
    }
    favicon.href = customLogo
  }

  async function runInitialization(): Promise<void> {
    phase.value = 'loading'
    lastError.value = null
    modelCount.value = null
    uptimePercent.value = null
    try {
      status.value = (await publicApi.status()) || {}
      statusReachable.value = true
      applyBranding()

      const canLoadPricing =
        pricingAccess.value.enabled &&
        (!pricingAccess.value.requireAuth || auth.isAuthenticated)

      const summaries = await Promise.allSettled([
        publicApi.notice(),
        canLoadPricing ? publicApi.pricing() : Promise.resolve(null),
        publicApi.uptime(),
      ])
      const [noticeResult, pricingResult, uptimeResult] = summaries

      if (noticeResult.status === 'fulfilled') {
        notice.value = toPlainText(noticeResult.value)
      }
      if (
        pricingResult.status === 'fulfilled' &&
        pricingResult.value !== null
      ) {
        modelCount.value = pricingResult.value.length
      }
      if (uptimeResult.status === 'fulfilled') {
        const monitors = uptimeResult.value.flatMap(
          (group) => group.monitors || []
        )
        const measured = monitors.filter((monitor) =>
          Number.isFinite(monitor.uptime)
        )
        if (measured.length > 0) {
          uptimePercent.value =
            (measured.reduce(
              (sum, monitor) => sum + Math.min(1, Math.max(0, monitor.uptime)),
              0
            ) /
              measured.length) *
            100
        }
      }

      phase.value = summaries.every((result) => result.status === 'fulfilled')
        ? 'ready'
        : 'degraded'
    } catch (error) {
      statusReachable.value = false
      lastError.value = error
      phase.value = 'error'
    }
  }

  function initialize(): Promise<void> {
    if (phase.value === 'ready' || phase.value === 'degraded') {
      return Promise.resolve()
    }
    if (initializationPromise) return initializationPromise

    initializationPromise = runInitialization().finally(() => {
      initializationPromise = null
    })
    return initializationPromise
  }

  watch(
    [() => auth.isAuthenticated, initialized],
    ([isAuthenticated, isInitialized]) => {
      if (!pricingAccess.value.requireAuth) return
      if (!isAuthenticated) {
        modelCount.value = null
        return
      }
      if (
        !isInitialized ||
        !pricingAccess.value.enabled ||
        modelCount.value !== null
      ) {
        return
      }

      void publicApi.pricing().then(
        (models) => {
          modelCount.value = models.length
        },
        (error: unknown) => {
          lastError.value = error
          phase.value = 'degraded'
        }
      )
    }
  )

  async function retry(): Promise<void> {
    if (phase.value !== 'error') return
    await initialize()
  }

  return {
    phase,
    initialized,
    loading,
    online,
    statusReachable,
    lastError,
    notice,
    systemName,
    logo,
    docsLink,
    showPricing,
    showDocs,
    showAbout,
    registerEnabled,
    userAgreementEnabled,
    privacyPolicyEnabled,
    modelCountLabel,
    uptimeLabel,
    versionLabel,
    initialize,
    retry,
  }
})
