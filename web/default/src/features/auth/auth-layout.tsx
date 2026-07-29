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

import { PageTransition } from '@/components/page-transition'
import { Skeleton } from '@/components/ui/skeleton'
import { useSystemConfig } from '@/hooks/use-system-config'

type AuthLayoutProps = {
  children: React.ReactNode
}

export function AuthLayout({ children }: AuthLayoutProps) {
  const { t } = useTranslation()
  const { systemName, logo, loading } = useSystemConfig()

  return (
    <div className='relative grid h-svh max-w-none overflow-hidden'>
      {/* Marketing-aligned ambient gradient (matches public home / Model Hub) */}
      <div
        aria-hidden
        className='pointer-events-none absolute inset-0 opacity-40 dark:opacity-25'
        style={{
          background: [
            'radial-gradient(ellipse 55% 45% at 15% 20%, oklch(0.72 0.18 250 / 55%) 0%, transparent 70%)',
            'radial-gradient(ellipse 45% 40% at 85% 15%, oklch(0.65 0.15 280 / 45%) 0%, transparent 70%)',
            'radial-gradient(ellipse 50% 35% at 50% 90%, oklch(0.70 0.12 220 / 30%) 0%, transparent 70%)',
          ].join(', '),
        }}
      />
      <div
        aria-hidden
        className='from-background via-background/90 to-background pointer-events-none absolute inset-0 bg-linear-to-b'
      />

      <Link
        to='/'
        className='absolute top-4 left-4 z-10 flex items-center gap-2 transition-opacity hover:opacity-80 sm:top-8 sm:left-8'
      >
        <div className='relative h-8 w-8'>
          {loading ? (
            <Skeleton className='absolute inset-0 rounded-full' />
          ) : (
            <img
              src={logo}
              alt={t('Logo')}
              className='h-8 w-8 rounded-full object-cover ring-1 ring-black/5 dark:ring-white/10'
            />
          )}
        </div>
        {loading ? (
          <Skeleton className='h-6 w-24' />
        ) : (
          <h1 className='text-xl font-medium tracking-tight'>{systemName}</h1>
        )}
      </Link>

      <div className='relative container flex items-center pt-16 sm:pt-0'>
        <PageTransition className='mx-auto flex w-full flex-col justify-center space-y-2 px-4 py-8 sm:w-[480px] sm:p-8'>
          <div className='bg-card/95 rounded-2xl border p-5 shadow-sm backdrop-blur-md sm:p-7'>
            {children}
          </div>
        </PageTransition>
      </div>
    </div>
  )
}
