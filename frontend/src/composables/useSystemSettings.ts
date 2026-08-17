import { ref, readonly } from 'vue'
import { api } from '@/api/console'
import { ApiError } from '@/api/types'
import { useToast } from '@/composables/useToast'
import {
  SYSTEM_SETTINGS_DEFAULTS,
  type AllSystemSettings,
  type SystemOption,
} from '@/types/systemSettings'

export type SystemSettingValue = string | boolean | number
export type SystemSettingsRawOptions = Record<string, string>

interface SecretStatusResponse {
  configured?: string[]
}

/** Parse a raw string value into boolean / number / string based on the default key type. */
function castValue(
  key: string,
  raw: string,
  defaults: AllSystemSettings
): string | boolean | number {
  const def = defaults[key as keyof AllSystemSettings]
  if (typeof def === 'boolean') {
    return raw === 'true' || raw === '1'
  }
  if (typeof def === 'number') {
    const n = Number(raw)
    return Number.isFinite(n) ? n : def
  }
  return raw
}

/** Merge a flat array of SystemOption into the typed settings object. */
function parseOptions(
  options: SystemOption[],
  defaults: AllSystemSettings
): AllSystemSettings {
  const result = { ...defaults }
  for (const opt of options) {
    if (Object.prototype.hasOwnProperty.call(defaults, opt.key)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(result as any)[opt.key] = castValue(opt.key, opt.value, defaults)
    }
  }
  return result
}

// Module-level singleton so multiple consumers share the same fetch
const _settings = ref<AllSystemSettings>({ ...SYSTEM_SETTINGS_DEFAULTS })
const _rawOptions = ref<SystemSettingsRawOptions>({})
const _configuredSecrets = ref<string[]>([])
const _loading = ref(false)
const _loaded = ref(false)
let _fetchPromise: Promise<void> | null = null

export function useSystemSettings() {
  const toast = useToast()

  async function load(force = false): Promise<void> {
    if (_loaded.value && !force) return
    if (_fetchPromise) return _fetchPromise

    _loading.value = true
    // api.get<T> unwraps the ApiResponse envelope and returns .data directly
    // /api/option/ returns { success, message, data: SystemOption[] }
    // so T = SystemOption[]
    _fetchPromise = api
      .get<SystemOption[]>('/api/option/')
      .then(async (data) => {
        const raw: SystemSettingsRawOptions = {}
        for (const option of Array.isArray(data) ? data : []) {
          raw[option.key] = option.value
        }
        _rawOptions.value = raw
        _settings.value = parseOptions(
          Array.isArray(data) ? data : [],
          SYSTEM_SETTINGS_DEFAULTS
        )
        const secretStatus = await api.get<SecretStatusResponse>(
          '/api/option/secret-status'
        )
        _configuredSecrets.value = Array.isArray(secretStatus?.configured)
          ? secretStatus.configured
          : []
        _loaded.value = true
      })
      .catch((err) => {
        const msg = err instanceof ApiError ? err.message : String(err)
        toast.error(msg)
      })
      .finally(() => {
        _loading.value = false
        _fetchPromise = null
      })

    return _fetchPromise
  }

  async function updateOption(
    key: string,
    value: SystemSettingValue
  ): Promise<boolean> {
    return saveOptions({ [key]: value })
  }

  /** Save a whole patch atomically. Sensitive blank fields must be omitted. */
  async function saveOptions(
    patch: Partial<Record<string, SystemSettingValue>>
  ): Promise<boolean> {
    const entries = Object.entries(patch)
    if (entries.length === 0) return true

    try {
      await api.put<null>('/api/option/bulk', { options: patch })
      const nextRaw = { ..._rawOptions.value }
      for (const [key, value] of entries) {
        nextRaw[key] = String(value)
        if (Object.prototype.hasOwnProperty.call(SYSTEM_SETTINGS_DEFAULTS, key)) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ;(_settings.value as any)[key] = value
        }
      }
      _rawOptions.value = nextRaw
      return true
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : String(err)
      toast.error(msg)
      return false
    }
  }

  function rawValue(key: string, fallback: SystemSettingValue = ''): SystemSettingValue {
    const value = _rawOptions.value[key]
    if (value === undefined) return fallback
    if (typeof fallback === 'boolean') return value === 'true' || value === '1'
    if (typeof fallback === 'number') {
      const parsed = Number(value)
      return Number.isFinite(parsed) ? parsed : fallback
    }
    return value
  }

  function isSecretConfigured(key: string): boolean {
    return _configuredSecrets.value.includes(key)
  }

  return {
    settings: readonly(_settings),
    rawOptions: readonly(_rawOptions),
    configuredSecrets: readonly(_configuredSecrets),
    loading: readonly(_loading),
    loaded: readonly(_loaded),
    load,
    updateOption,
    saveOptions,
    rawValue,
    isSecretConfigured,
  }
}
