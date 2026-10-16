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
import { DirectionProvider as BaseDirectionProvider } from '@base-ui/react/direction-provider'
import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  getInterfaceLanguageDirection,
  toIntlLocale,
  type TextDirection,
} from '@/i18n/languages'
import { getCookie, setCookie, removeCookie } from '@/lib/cookies'

export type Direction = TextDirection

const DIRECTION_COOKIE_NAME = 'dir'
const DIRECTION_COOKIE_MAX_AGE = 60 * 60 * 24 * 365 // 1 year

type DirectionContextType = {
  defaultDir: Direction
  dir: Direction
  setDir: (dir: Direction) => void
  resetDir: () => void
}

const DirectionContext = createContext<DirectionContextType | null>(null)

function readDirectionOverride(): Direction | null {
  const saved = getCookie(DIRECTION_COOKIE_NAME)
  return saved === 'ltr' || saved === 'rtl' ? saved : null
}

/**
 * The page direction follows the interface language (`fa` is right-to-left,
 * everything else left-to-right). The manual LTR/RTL choice in the config
 * drawer is stored as an override and cleared when the language changes.
 */
export function DirectionProvider({ children }: { children: React.ReactNode }) {
  const { i18n } = useTranslation()
  const language = i18n.resolvedLanguage || i18n.language
  const defaultDir = getInterfaceLanguageDirection(language)
  const [override, setOverride] = useState<Direction | null>(
    readDirectionOverride
  )
  const previousLanguage = useRef(language)
  const dir = override ?? defaultDir

  useEffect(() => {
    if (previousLanguage.current === language) return
    previousLanguage.current = language
    setOverride(null)
    removeCookie(DIRECTION_COOKIE_NAME)
  }, [language])

  useEffect(() => {
    const htmlElement = document.documentElement
    htmlElement.setAttribute('dir', dir)
    htmlElement.setAttribute('lang', toIntlLocale(language) ?? 'en')
  }, [dir, language])

  const setDir = (nextDir: Direction) => {
    if (nextDir === defaultDir) {
      setOverride(null)
      removeCookie(DIRECTION_COOKIE_NAME)
      return
    }
    setOverride(nextDir)
    setCookie(DIRECTION_COOKIE_NAME, nextDir, DIRECTION_COOKIE_MAX_AGE)
  }

  const resetDir = () => {
    setOverride(null)
    removeCookie(DIRECTION_COOKIE_NAME)
  }

  return (
    <DirectionContext
      value={{
        defaultDir,
        dir,
        setDir,
        resetDir,
      }}
    >
      <BaseDirectionProvider direction={dir}>{children}</BaseDirectionProvider>
    </DirectionContext>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useDirection() {
  const context = useContext(DirectionContext)
  if (!context) {
    throw new Error('useDirection must be used within a DirectionProvider')
  }
  return context
}
