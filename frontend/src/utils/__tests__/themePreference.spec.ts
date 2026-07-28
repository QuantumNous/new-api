import indexHtml from '../../../index.html?raw'
import { describe, expect, it } from 'vitest'

import {
  LEGACY_THEME_STORAGE_KEY,
  resolveStoredThemePreference,
  THEME_STORAGE_KEY,
} from '@/utils/themePreference'

describe('initial theme preference', () => {
  it('prefers the current storage key over the legacy key', () => {
    const values = new Map([
      [THEME_STORAGE_KEY, 'dark'],
      [LEGACY_THEME_STORAGE_KEY, 'light'],
    ])

    expect(
      resolveStoredThemePreference({
        getItem: (key) => values.get(key) ?? null,
      })
    ).toBe('dark')
  })

  it('falls back to a valid legacy value only when the current key is absent', () => {
    expect(
      resolveStoredThemePreference({
        getItem: (key) => (key === LEGACY_THEME_STORAGE_KEY ? 'light' : null),
      })
    ).toBe('light')

    expect(
      resolveStoredThemePreference({
        getItem: (key) => (key === THEME_STORAGE_KEY ? 'sepia' : 'dark'),
      })
    ).toBe('auto')
  })

  it('keeps the inline anti-FOUC contract synchronous and ordered', () => {
    const currentRead = indexHtml.indexOf(`getItem('${THEME_STORAGE_KEY}')`)
    const legacyRead = indexHtml.indexOf(
      `getItem('${LEGACY_THEME_STORAGE_KEY}')`
    )

    expect(currentRead).toBeGreaterThan(-1)
    expect(legacyRead).toBeGreaterThan(currentRead)
    expect(indexHtml).not.toContain('type="module" src="/theme')
  })
})
