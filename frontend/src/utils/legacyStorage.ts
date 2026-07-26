/**
 * One-time localStorage key migrations. Preference keys were renamed from the
 * legacy `renren_*` prefix to `ren2hub_*`; copying the stored value on startup
 * keeps existing sessions' preferences. The locale key migrates separately in
 * src/i18n (it must resolve before the i18n instance is created), and the
 * dashboard balance-visibility key stays legacy until the dashboard refactor
 * lands.
 */
const LEGACY_KEY_RENAMES: ReadonlyArray<readonly [string, string]> = [
  ['renren_sidebar_collapsed', 'ren2hub_sidebar_collapsed'],
  ['renren_lab_sidebar_collapsed', 'ren2hub_lab_sidebar_collapsed'],
  ['renren_lab_private', 'ren2hub_lab_private'],
  ['renren_lab_sound', 'ren2hub_lab_sound'],
  ['renren_market_currency', 'ren2hub_market_currency'],
  ['renren_market_view', 'ren2hub_market_view'],
  ['renren_models_view', 'ren2hub_models_view'],
  [
    'renren_admin_channel_visible_fields',
    'ren2hub_admin_channel_visible_fields',
  ],
  [
    'renren_admin_redemption_visible_fields',
    'ren2hub_admin_redemption_visible_fields',
  ],
  ['renren_admin_user_visible_fields', 'ren2hub_admin_user_visible_fields'],
]

export function migrateLocalStorageKey(legacyKey: string, key: string): void {
  try {
    const legacy = window.localStorage.getItem(legacyKey)
    if (legacy === null) return
    if (window.localStorage.getItem(key) === null) {
      window.localStorage.setItem(key, legacy)
    }
    window.localStorage.removeItem(legacyKey)
  } catch {
    // Storage unavailable — callers fall back to their defaults.
  }
}

export function migrateLegacyLocalStorage(): void {
  for (const [legacyKey, key] of LEGACY_KEY_RENAMES) {
    migrateLocalStorageKey(legacyKey, key)
  }
}
