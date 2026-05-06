import { useEffect, useRef, useState } from 'react'
import { useTheme } from '@/context/theme-provider'

/**
 * Lazy-load VChart's `ThemeManager` and switch its theme to follow the
 * resolved app theme (light / dark). Returns flags consumers can use to
 * defer chart rendering until the theme is ready.
 */
let themeManagerPromise: Promise<
  (typeof import('@visactor/vchart'))['ThemeManager']
> | null = null

export function useChartTheme() {
  const { resolvedTheme } = useTheme()
  const [themeReady, setThemeReady] = useState(false)
  const themeRef = useRef<
    (typeof import('@visactor/vchart'))['ThemeManager'] | null
  >(null)

  useEffect(() => {
    let cancelled = false
    const updateTheme = async () => {
      setThemeReady(false)
      if (!themeManagerPromise) {
        themeManagerPromise = import('@visactor/vchart').then(
          (m) => m.ThemeManager
        )
      }
      const ThemeManager = await themeManagerPromise
      if (cancelled) return
      themeRef.current = ThemeManager
      ThemeManager.setCurrentTheme(resolvedTheme === 'dark' ? 'dark' : 'light')
      setThemeReady(true)
    }
    updateTheme()
    return () => {
      cancelled = true
    }
  }, [resolvedTheme])

  return { resolvedTheme, themeReady }
}
