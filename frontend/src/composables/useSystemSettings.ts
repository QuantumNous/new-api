import { ref, readonly } from 'vue'
import { api } from '@/api/console'
import { ApiError } from '@/api/types'
import { useToast } from '@/composables/useToast'
import {
  SYSTEM_SETTINGS_DEFAULTS,
  type AllSystemSettings,
  type SystemOption,
} from '@/types/systemSettings'

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
      .then((data) => {
        _settings.value = parseOptions(
          Array.isArray(data) ? data : [],
          SYSTEM_SETTINGS_DEFAULTS
        )
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
    value: string | boolean | number
  ): Promise<boolean> {
    try {
      // PUT /api/option/ expects { key, value } and returns { success, message }
      // api.put unwraps the envelope; success:false throws as ApiError
      await api.put<null>('/api/option/', { key, value })
      // Optimistically update local state
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(_settings.value as any)[key] = value
      return true
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : String(err)
      toast.error(msg)
      return false
    }
  }

  /** Save prerequisites before their enable switches, then resync on partial failure. */
  async function saveOptions(
    patch: Partial<Record<string, string | boolean | number>>
  ): Promise<boolean> {
    const entries = Object.entries(patch).sort(([left], [right]) => {
      const leftIsEnable = left.endsWith('Enabled') || left.endsWith('.enabled')
      const rightIsEnable =
        right.endsWith('Enabled') || right.endsWith('.enabled')
      return Number(leftIsEnable) - Number(rightIsEnable)
    })
    let savedAny = false
    for (const [key, value] of entries) {
      const ok = await updateOption(key, value as string | boolean | number)
      if (!ok) {
        if (savedAny) await load(true)
        return false
      }
      savedAny = true
    }
    return true
  }

  return {
    settings: readonly(_settings),
    loading: readonly(_loading),
    loaded: readonly(_loaded),
    load,
    updateOption,
    saveOptions,
  }
}
