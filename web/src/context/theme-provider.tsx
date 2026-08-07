/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
} from 'react'

import { removeCookie } from '@/lib/cookies'

type Theme = 'dark' | 'light' | 'system'
type ResolvedTheme = Exclude<Theme, 'system'>

const FIXED_THEME = 'light' as const
const THEME_COOKIE_NAME = 'vite-ui-theme'
const THEME_COLOR = '#EEF1EC'

type ThemeProviderProps = {
  children: React.ReactNode
  defaultTheme?: Theme
  storageKey?: string
}

type ThemeProviderState = {
  defaultTheme: ResolvedTheme
  resolvedTheme: ResolvedTheme
  theme: ResolvedTheme
  setTheme: (theme: Theme) => void
  resetTheme: () => void
}

const initialState: ThemeProviderState = {
  defaultTheme: FIXED_THEME,
  resolvedTheme: FIXED_THEME,
  theme: FIXED_THEME,
  setTheme: () => null,
  resetTheme: () => null,
}

const ThemeContext = createContext<ThemeProviderState>(initialState)

function applyFixedTheme(storageKey: string) {
  if (typeof document === 'undefined') return

  removeCookie(storageKey)
  removeCookie('chimera-console-theme-reset')
  window.localStorage.removeItem(storageKey)
  window.localStorage.removeItem('chimera-console-theme-reset')

  const root = document.documentElement
  root.classList.remove('dark')
  root.classList.add(FIXED_THEME)
  root.style.colorScheme = FIXED_THEME

  let themeColor = document.querySelector<HTMLMetaElement>(
    'meta[name="theme-color"]'
  )
  if (!themeColor) {
    themeColor = document.createElement('meta')
    themeColor.name = 'theme-color'
    document.head.appendChild(themeColor)
  }
  themeColor.content = THEME_COLOR
}

export function ThemeProvider({
  children,
  storageKey = THEME_COOKIE_NAME,
}: ThemeProviderProps) {
  useEffect(() => {
    applyFixedTheme(storageKey)
  }, [storageKey])

  const setTheme = useCallback(
    (_theme: Theme) => applyFixedTheme(storageKey),
    [storageKey]
  )
  const resetTheme = useCallback(
    () => applyFixedTheme(storageKey),
    [storageKey]
  )

  const contextValue = useMemo<ThemeProviderState>(
    () => ({
      defaultTheme: FIXED_THEME,
      resolvedTheme: FIXED_THEME,
      theme: FIXED_THEME,
      setTheme,
      resetTheme,
    }),
    [resetTheme, setTheme]
  )

  return <ThemeContext value={contextValue}>{children}</ThemeContext>
}

// eslint-disable-next-line react-refresh/only-export-components
export const useTheme = () => {
  const context = useContext(ThemeContext)

  if (!context) throw new Error('useTheme must be used within a ThemeProvider')

  return context
}
