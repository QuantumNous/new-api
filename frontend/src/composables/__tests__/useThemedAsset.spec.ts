import { nextTick } from 'vue'
import { afterAll, describe, expect, it } from 'vitest'

import { useTheme } from '@/composables/useTheme'
import { useThemedAsset } from '@/composables/useThemedAsset'

afterAll(() => {
  useTheme().setThemePreference('auto')
})

describe('useThemedAsset', () => {
  it('reactively selects the asset for the resolved theme', async () => {
    const theme = useTheme()
    const asset = useThemedAsset('day-sketch.webp', 'one-night.webp')

    theme.setThemePreference('light')
    await nextTick()
    expect(asset.value).toBe('day-sketch.webp')

    theme.setThemePreference('dark')
    await nextTick()
    expect(asset.value).toBe('one-night.webp')
  })
})
