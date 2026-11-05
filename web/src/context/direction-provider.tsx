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
import { createContext, useContext, useLayoutEffect, useState } from 'react'
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
  /** Direction implied by the interface language; "reset" returns to it. */
  defaultDir: Direction
  /** Direction currently applied to the document. */
  dir: Direction
  /** True when the interface language is right-to-left, which pins `dir` to `rtl`. */
  isLockedByLanguage: boolean
  setDir: (dir: Direction) => void
  resetDir: () => void
}

const DirectionContext = createContext<DirectionContextType | null>(null)

/**
 * Owns `<html dir>` and `<html lang>`.
 *
 * Right-to-left interface languages (Arabic) always render right-to-left. For
 * every other language the layout direction is the manual preference stored in
 * the `dir` cookie, which defaults to left-to-right. Keep the pre-paint script
 * in `index.html` in step with this rule so the first frame has the right
 * direction.
 */
export function DirectionProvider({ children }: { children: React.ReactNode }) {
  const { i18n } = useTranslation()
  const [preferredDir, setPreferredDir] = useState<Direction>(() =>
    getCookie(DIRECTION_COOKIE_NAME) === 'rtl' ? 'rtl' : 'ltr'
  )

  const activeLanguage = i18n.resolvedLanguage || i18n.language
  const languageDir = getInterfaceLanguageDirection(activeLanguage)
  const isLockedByLanguage = languageDir === 'rtl'
  const dir = isLockedByLanguage ? languageDir : preferredDir
  const documentLang = toIntlLocale(activeLanguage) ?? 'en'

  useLayoutEffect(() => {
    const htmlElement = document.documentElement
    htmlElement.setAttribute('dir', dir)
    htmlElement.setAttribute('lang', documentLang)
  }, [dir, documentLang])

  const setDir = (nextDir: Direction) => {
    setPreferredDir(nextDir)
    setCookie(DIRECTION_COOKIE_NAME, nextDir, DIRECTION_COOKIE_MAX_AGE)
  }

  const resetDir = () => {
    setPreferredDir('ltr')
    removeCookie(DIRECTION_COOKIE_NAME)
  }

  return (
    <DirectionContext
      value={{
        defaultDir: languageDir,
        dir,
        isLockedByLanguage,
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
