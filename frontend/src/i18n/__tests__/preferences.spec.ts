import { describe, expect, it, vi } from 'vitest'

import {
  LEGACY_LOCALE_STORAGE_KEY,
  LOCALE_STORAGE_KEY,
  resolveInitialLocale,
  resolveInitialLocaleFromStorage,
} from '@/i18n'

describe('locale and theme preferences', () => {
  it('migrates the legacy locale key once', () => {
    localStorage.setItem(LEGACY_LOCALE_STORAGE_KEY, 'en')
    expect(resolveInitialLocale(localStorage, 'zh-CN')).toBe('en')
    expect(localStorage.getItem(LOCALE_STORAGE_KEY)).toBe('en')
    expect(localStorage.getItem(LEGACY_LOCALE_STORAGE_KEY)).toBeNull()
  })

  it('falls back to the browser locale when storage access is blocked', () => {
    expect(
      resolveInitialLocaleFromStorage(() => {
        throw new DOMException('blocked', 'SecurityError')
      }, 'en-US')
    ).toBe('en')
  })

  it('removes an invalid theme preference', async () => {
    localStorage.setItem('renren_theme_mode', 'sepia')
    vi.resetModules()
    await import('@/composables/useTheme')
    expect(localStorage.getItem('renren_theme_mode')).not.toBe('sepia')
  })
})
