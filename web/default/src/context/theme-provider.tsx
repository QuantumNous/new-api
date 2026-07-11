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
import { createContext, useContext, useEffect, useMemo } from 'react'

type Theme = 'dark' | 'light' | 'system'
type ResolvedTheme = Exclude<Theme, 'system'>

type ThemeProviderProps = {
  children: React.ReactNode
  defaultTheme?: Theme
  storageKey?: string
}

type ThemeProviderState = {
  defaultTheme: Theme
  resolvedTheme: ResolvedTheme
  theme: Theme
  setTheme: (theme: Theme) => void
  resetTheme: () => void
}

// The app ships a single light theme only. Dark/system switching and the
// theme-settings UI have been removed; this provider keeps the useTheme()
// surface that charts, toasts, and the home iframe still consume, but it
// always resolves to light.
const LIGHT_ONLY_STATE: ThemeProviderState = {
  defaultTheme: 'light',
  resolvedTheme: 'light',
  theme: 'light',
  setTheme: () => null,
  resetTheme: () => null,
}

const ThemeContext = createContext<ThemeProviderState>(LIGHT_ONLY_STATE)

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  // Pin the document root to the light theme on mount and clear any stale
  // dark class left over from the previous theme switcher.
  useEffect(() => {
    const root = window.document.documentElement
    root.classList.remove('dark')
    root.classList.add('light')
  }, [])

  const value = useMemo(() => LIGHT_ONLY_STATE, [])

  return (
    <ThemeContext value={value} {...props}>
      {children}
    </ThemeContext>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export const useTheme = () => {
  const context = useContext(ThemeContext)

  if (!context) throw new Error('useTheme must be used within a ThemeProvider')

  return context
}
