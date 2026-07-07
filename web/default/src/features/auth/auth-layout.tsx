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
import { Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { useSystemConfig } from '@/hooks/use-system-config'
import { Skeleton } from '@/components/ui/skeleton'
import { FlatkeyBrandLogo } from '@/components/brand/flatkey-brand-logo'
import { LanguageSwitcher } from '@/components/language-switcher'
import { OFFICIAL_WEBSITE_ORIGIN, localizedWebsitePath, officialWebsiteUrl } from '@/lib/origins'

type AuthLayoutProps = {
  children: React.ReactNode
}

export function AuthLayout({ children }: AuthLayoutProps) {
  const { t, i18n } = useTranslation()
  const { systemName, loading } = useSystemConfig()

  return (
    <div className='auth-landing text-foreground relative grid min-h-svh max-w-none overflow-hidden bg-[linear-gradient(180deg,#fbfbff_0%,#f6f3ff_44%,#ffffff_100%)] dark:bg-[linear-gradient(180deg,#050712_0%,#080b18_44%,#03040b_100%)] dark:text-white'>
      <div
        aria-hidden
        className='pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(109,40,217,0.09)_1px,transparent_1px),linear-gradient(to_bottom,rgba(109,40,217,0.07)_1px,transparent_1px)] bg-[size:4.5rem_4.5rem] opacity-50 dark:bg-[linear-gradient(to_right,rgba(167,139,250,0.09)_1px,transparent_1px),linear-gradient(to_bottom,rgba(167,139,250,0.07)_1px,transparent_1px)] dark:opacity-45'
      />
      <div
        aria-hidden
        className='pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_62%_42%_at_50%_14%,rgba(124,58,237,0.12),transparent_72%),radial-gradient(ellipse_42%_34%_at_78%_32%,rgba(217,70,239,0.08),transparent_70%),radial-gradient(ellipse_36%_28%_at_18%_72%,rgba(99,102,241,0.1),transparent_76%)] dark:bg-[radial-gradient(ellipse_62%_42%_at_50%_14%,rgba(124,58,237,0.28),transparent_72%),radial-gradient(ellipse_42%_34%_at_78%_32%,rgba(217,70,239,0.16),transparent_70%),radial-gradient(ellipse_36%_28%_at_18%_72%,rgba(99,102,241,0.18),transparent_76%)]'
      />
      {(() => {
        const logoClassName =
          'absolute top-4 left-4 z-10 flex items-center rounded-full transition-opacity hover:opacity-90 sm:top-8 sm:left-8'
        const logoInner = (
          <>
            <div className='relative h-11'>
              {loading ? (
                <Skeleton className='absolute inset-y-1 left-0 w-32 rounded-full' />
              ) : (
                <FlatkeyBrandLogo alt={t('Logo')} className='h-11' />
              )}
            </div>
            {loading ? (
              <Skeleton className='h-6 w-24' />
            ) : (
              <h1 className='sr-only text-xl font-semibold tracking-normal'>
                {systemName}
              </h1>
            )}
          </>
        )
        // When a separate marketing site is configured, the logo links out to its home
        // (OpenRouter-style). Otherwise fall back to the in-app root.
        return OFFICIAL_WEBSITE_ORIGIN ? (
          <a href={officialWebsiteUrl(localizedWebsitePath(i18n.language, '/'))} className={logoClassName}>
            {logoInner}
          </a>
        ) : (
          <Link to='/' className={logoClassName}>
            {logoInner}
          </Link>
        )
      })()}
      <div className='absolute top-4 right-4 z-10 sm:top-8 sm:right-8'>
        <LanguageSwitcher />
      </div>
      <div className='relative z-10 container flex items-center pt-20 sm:pt-0'>
        <div className='mx-auto flex w-full flex-col justify-center space-y-2 rounded-3xl border border-violet-200/60 bg-white/82 px-5 py-8 shadow-[0_28px_100px_-54px_rgba(91,33,182,0.42)] backdrop-blur-xl sm:w-[520px] sm:p-10 dark:border-violet-300/12 dark:bg-white/[0.035] dark:shadow-[0_28px_100px_-48px_rgba(124,58,237,0.62)]'>
          {children}
        </div>
      </div>
    </div>
  )
}
