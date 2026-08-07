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
  useState,
} from 'react'

import { getCookie, removeCookie, setCookie } from '@/lib/cookies'
import {
  CONTENT_LAYOUT_VALUES,
  type ContentLayout,
  DEFAULT_THEME_CUSTOMIZATION,
  resolveThemeFont,
  THEME_COOKIE_KEYS,
  THEME_FONT_VALUES,
  THEME_RADIUS_VALUES,
  THEME_SCALE_VALUES,
  type ThemeCustomization,
  type ThemeFont,
  type ThemeRadius,
  type ThemeScale,
} from '@/lib/theme-customization'

const COOKIE_MAX_AGE = 60 * 60 * 24 * 365
const REMOVED_PRESET_KEY = 'theme_preset'

function readCookie<T extends string>(
  name: string,
  allowed: ReadonlySet<T>,
  fallback: T
): T {
  const value = getCookie(name)
  return value && allowed.has(value as T) ? (value as T) : fallback
}

function applyAttribute(name: string, value: string | null) {
  if (typeof document === 'undefined' || !document.body) return
  if (value === null) {
    document.body.removeAttribute(name)
  } else {
    document.body.setAttribute(name, value)
  }
}

type ThemeCustomizationContextType = {
  defaults: ThemeCustomization
  customization: ThemeCustomization
  setFont: (font: ThemeFont) => void
  setRadius: (radius: ThemeRadius) => void
  setScale: (scale: ThemeScale) => void
  setContentLayout: (contentLayout: ContentLayout) => void
  resetCustomization: () => void
}

const FALLBACK_CONTEXT: ThemeCustomizationContextType = {
  defaults: DEFAULT_THEME_CUSTOMIZATION,
  customization: DEFAULT_THEME_CUSTOMIZATION,
  setFont: () => {},
  setRadius: () => {},
  setScale: () => {},
  setContentLayout: () => {},
  resetCustomization: () => {},
}

const ThemeCustomizationContext =
  createContext<ThemeCustomizationContextType>(FALLBACK_CONTEXT)

export function ThemeCustomizationProvider(props: {
  children: React.ReactNode
}) {
  const [font, _setFont] = useState<ThemeFont>(() =>
    readCookie<ThemeFont>(
      THEME_COOKIE_KEYS.font,
      THEME_FONT_VALUES,
      DEFAULT_THEME_CUSTOMIZATION.font
    )
  )
  const [radius, _setRadius] = useState<ThemeRadius>(() =>
    readCookie<ThemeRadius>(
      THEME_COOKIE_KEYS.radius,
      THEME_RADIUS_VALUES,
      DEFAULT_THEME_CUSTOMIZATION.radius
    )
  )
  const [scale, _setScale] = useState<ThemeScale>(() =>
    readCookie<ThemeScale>(
      THEME_COOKIE_KEYS.scale,
      THEME_SCALE_VALUES,
      DEFAULT_THEME_CUSTOMIZATION.scale
    )
  )
  const [contentLayout, _setContentLayout] = useState<ContentLayout>(() =>
    readCookie<ContentLayout>(
      THEME_COOKIE_KEYS.contentLayout,
      CONTENT_LAYOUT_VALUES,
      DEFAULT_THEME_CUSTOMIZATION.contentLayout
    )
  )

  useEffect(() => {
    removeCookie(REMOVED_PRESET_KEY)
    window.localStorage.removeItem(REMOVED_PRESET_KEY)
    applyAttribute('data-theme-preset', null)
  }, [])

  useEffect(() => {
    applyAttribute('data-theme-font', resolveThemeFont(font))
  }, [font])

  useEffect(() => {
    applyAttribute(
      'data-theme-radius',
      radius === DEFAULT_THEME_CUSTOMIZATION.radius ? null : radius
    )
  }, [radius])

  useEffect(() => {
    applyAttribute(
      'data-theme-scale',
      scale === DEFAULT_THEME_CUSTOMIZATION.scale ? null : scale
    )
  }, [scale])

  useEffect(() => {
    applyAttribute('data-theme-content-layout', contentLayout)
  }, [contentLayout])

  const setFont = useCallback((value: ThemeFont) => {
    _setFont(value)
    if (value === DEFAULT_THEME_CUSTOMIZATION.font) {
      removeCookie(THEME_COOKIE_KEYS.font)
    } else {
      setCookie(THEME_COOKIE_KEYS.font, value, COOKIE_MAX_AGE)
    }
  }, [])

  const setRadius = useCallback((value: ThemeRadius) => {
    _setRadius(value)
    if (value === DEFAULT_THEME_CUSTOMIZATION.radius) {
      removeCookie(THEME_COOKIE_KEYS.radius)
    } else {
      setCookie(THEME_COOKIE_KEYS.radius, value, COOKIE_MAX_AGE)
    }
  }, [])

  const setScale = useCallback((value: ThemeScale) => {
    _setScale(value)
    if (value === DEFAULT_THEME_CUSTOMIZATION.scale) {
      removeCookie(THEME_COOKIE_KEYS.scale)
    } else {
      setCookie(THEME_COOKIE_KEYS.scale, value, COOKIE_MAX_AGE)
    }
  }, [])

  const setContentLayout = useCallback((value: ContentLayout) => {
    _setContentLayout(value)
    if (value === DEFAULT_THEME_CUSTOMIZATION.contentLayout) {
      removeCookie(THEME_COOKIE_KEYS.contentLayout)
    } else {
      setCookie(THEME_COOKIE_KEYS.contentLayout, value, COOKIE_MAX_AGE)
    }
  }, [])

  const resetCustomization = useCallback(() => {
    setFont(DEFAULT_THEME_CUSTOMIZATION.font)
    setRadius(DEFAULT_THEME_CUSTOMIZATION.radius)
    setScale(DEFAULT_THEME_CUSTOMIZATION.scale)
    setContentLayout(DEFAULT_THEME_CUSTOMIZATION.contentLayout)
  }, [setFont, setRadius, setScale, setContentLayout])

  const value = useMemo<ThemeCustomizationContextType>(
    () => ({
      defaults: DEFAULT_THEME_CUSTOMIZATION,
      customization: { font, radius, scale, contentLayout },
      setFont,
      setRadius,
      setScale,
      setContentLayout,
      resetCustomization,
    }),
    [
      font,
      radius,
      scale,
      contentLayout,
      setFont,
      setRadius,
      setScale,
      setContentLayout,
      resetCustomization,
    ]
  )

  return (
    <ThemeCustomizationContext.Provider value={value}>
      {props.children}
    </ThemeCustomizationContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useThemeCustomization() {
  return useContext(ThemeCustomizationContext)
}
