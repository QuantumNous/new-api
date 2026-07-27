import { computed, watch } from 'vue'
import { useColorMode } from '@vueuse/core'

import { migrateLocalStorageKey } from '@/utils/legacyStorage'
import {
  isThemePreference,
  LEGACY_THEME_STORAGE_KEY,
  THEME_STORAGE_KEY,
  type ThemePreference,
} from '@/utils/themePreference'

export type { ThemePreference } from '@/utils/themePreference'
export type ResolvedTheme = Exclude<ThemePreference, 'auto'>
export { THEME_STORAGE_KEY } from '@/utils/themePreference'

// This module evaluates before main.ts runs its migrations (import hoisting),
// so the theme key migrates here — useColorMode below reads it immediately.
if (typeof window !== 'undefined') {
  migrateLocalStorageKey(LEGACY_THEME_STORAGE_KEY, THEME_STORAGE_KEY)
}

function clearInvalidStoredPreference() {
  if (typeof window === 'undefined') return

  try {
    const storedPreference = window.localStorage.getItem(THEME_STORAGE_KEY)
    if (storedPreference && !isThemePreference(storedPreference)) {
      window.localStorage.removeItem(THEME_STORAGE_KEY)
    }
  } catch {
    // VueUse falls back gracefully when storage is unavailable.
  }
}

clearInvalidStoredPreference()

const colorMode = useColorMode<ThemePreference>({
  selector: 'html',
  attribute: 'class',
  initialValue: 'auto',
  storageKey: THEME_STORAGE_KEY,
  modes: {
    auto: '',
    light: 'light',
    dark: 'dark',
  },
})

const preference = computed<ThemePreference>({
  get: () =>
    isThemePreference(colorMode.store.value) ? colorMode.store.value : 'auto',
  set: (value) => {
    if (isThemePreference(value)) colorMode.store.value = value
  },
})

const resolvedTheme = computed<ResolvedTheme>(() =>
  colorMode.state.value === 'dark' ? 'dark' : 'light'
)

if (typeof document !== 'undefined') {
  watch(
    resolvedTheme,
    (theme) => {
      const root = document.documentElement
      root.classList.toggle('dark', theme === 'dark')
      root.classList.toggle('light', theme === 'light')
      root.dataset.theme = theme
      root.style.colorScheme = theme
      document
        .querySelector<HTMLMetaElement>('meta[name="theme-color"]')
        ?.setAttribute('content', theme === 'dark' ? '#262A34' : '#F6F3EB')
    },
    { immediate: true }
  )
}

function setThemePreference(value: ThemePreference) {
  preference.value = value
}

/**
 * Shared application theme state. `preference` keeps the user's three-state
 * selection, while `resolvedTheme` is always the light or dark value applied
 * to the document root by VueUse.
 */
export function useTheme() {
  return {
    preference,
    resolvedTheme,
    setThemePreference,
  }
}
