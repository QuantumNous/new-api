export type ThemePreference = 'auto' | 'light' | 'dark'

export const THEME_STORAGE_KEY = 'ren2hub_theme_mode'
export const LEGACY_THEME_STORAGE_KEY = 'renren_theme_mode'

export function isThemePreference(value: unknown): value is ThemePreference {
  return value === 'auto' || value === 'light' || value === 'dark'
}

export function resolveStoredThemePreference(
  storage: Pick<Storage, 'getItem'>
): ThemePreference {
  try {
    const current = storage.getItem(THEME_STORAGE_KEY)
    if (current !== null) return isThemePreference(current) ? current : 'auto'

    const legacy = storage.getItem(LEGACY_THEME_STORAGE_KEY)
    return isThemePreference(legacy) ? legacy : 'auto'
  } catch {
    return 'auto'
  }
}
