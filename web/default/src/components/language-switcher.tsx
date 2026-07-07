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
import { useCallback } from 'react'
import { useLocation, useNavigate } from '@tanstack/react-router'
import {
  INTERFACE_LANGUAGE_OPTIONS,
  normalizeInterfaceLanguage,
} from '@/i18n/languages'
import { persistUserLanguageCookie } from '@/i18n/user-language-preference'
import { Languages, Check } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/stores/auth-store'
import { api } from '@/lib/api'
import {
  getPublicPathLanguage,
  getTrustedPublicOrigin,
  isPublicWebsitePath,
  localizePublicPath,
} from '@/lib/public-locale'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export function LanguageSwitcher() {
  const { i18n, t } = useTranslation()
  const location = useLocation()
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.auth.user)
  const isPublicPage = isPublicWebsitePath(location.pathname)
  const publicPathSuffix =
    typeof window === 'undefined'
      ? ''
      : `${window.location.search}${window.location.hash}`
  const publicOrigin =
    typeof window === 'undefined'
      ? 'https://flatkey.ai'
      : getTrustedPublicOrigin(window.location.origin)
  const currentLanguage = isPublicPage
    ? getPublicPathLanguage(location.pathname)
    : normalizeInterfaceLanguage(i18n.language)
  const publicLanguageLinks = isPublicPage
    ? INTERFACE_LANGUAGE_OPTIONS.map((lang) => ({
        ...lang,
        href: `${publicOrigin}${localizePublicPath(
          location.pathname,
          lang.code
        )}${publicPathSuffix}`,
      }))
    : []

  const handleChangeLanguage = useCallback(
    async (code: string) => {
      persistUserLanguageCookie(code)
      await i18n.changeLanguage(code)
      if (user) {
        try {
          await api.put('/api/user/self', { language: code })
        } catch {
          // Best-effort persistence; don't block the UI on failure
        }
      }

      if (isPublicWebsitePath(location.pathname)) {
        const pathname = localizePublicPath(location.pathname, code)
        await navigate({
          to: `${pathname}${window.location.search}${window.location.hash}`,
        })
        return
      }
    },
    [i18n, location.pathname, navigate, user]
  )

  return (
    <>
      {publicLanguageLinks.length > 0 && (
        <nav aria-label={t('Change language')} className='sr-only'>
          {publicLanguageLinks.map((lang) => (
            <a
              key={lang.code}
              href={lang.href}
              hrefLang={lang.code}
              aria-current={currentLanguage === lang.code ? 'page' : undefined}
            >
              {lang.label}
            </a>
          ))}
        </nav>
      )}

      <DropdownMenu modal={false}>
        <DropdownMenuTrigger
          render={<Button variant='ghost' size='icon' className='h-9 w-9' />}
        >
          <Languages className='size-[1.2rem]' />
          <span className='sr-only'>{t('Change language')}</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align='end'>
          {INTERFACE_LANGUAGE_OPTIONS.map((lang) => {
            const publicHref =
              publicLanguageLinks.find((link) => link.code === lang.code)
                ?.href ?? ''
            const itemContent = (
              <>
                {lang.label}
                <Check
                  size={14}
                  className={cn(
                    'ms-auto',
                    currentLanguage !== lang.code && 'hidden'
                  )}
                />
              </>
            )

            if (isPublicPage) {
              return (
                <DropdownMenuItem
                  key={lang.code}
                  render={
                    <a
                      href={publicHref}
                      hrefLang={lang.code}
                      aria-current={
                        currentLanguage === lang.code ? 'page' : undefined
                      }
                    />
                  }
                  onClick={(event) => {
                    event.preventDefault()
                    void handleChangeLanguage(lang.code)
                  }}
                >
                  {itemContent}
                </DropdownMenuItem>
              )
            }

            return (
              <DropdownMenuItem
                key={lang.code}
                onClick={() => handleChangeLanguage(lang.code)}
              >
                {itemContent}
              </DropdownMenuItem>
            )
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  )
}
