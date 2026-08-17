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
      {/* Mezon-style purple radial background — matches the landing hero */}
      <div
        aria-hidden
        className='pointer-events-none absolute inset-0 -z-10 opacity-25 dark:opacity-[0.12]'
        style={{
          background: [
            'radial-gradient(ellipse 60% 50% at 20% 20%, oklch(0.68 0.18 280 / 75%) 0%, transparent 70%)',
            'radial-gradient(ellipse 50% 40% at 80% 15%, oklch(0.55 0.26 293 / 45%) 0%, transparent 70%)',
            'radial-gradient(ellipse 40% 35% at 40% 80%, oklch(0.62 0.15 285 / 40%) 0%, transparent 70%)',
          ].join(', '),
        }}
      />
      <div
        aria-hidden
        className='absolute inset-0 -z-10 bg-[linear-gradient(to_right,color-mix(in_oklch,var(--landing-primary)_22%,transparent)_1px,transparent_1px),linear-gradient(to_bottom,color-mix(in_oklch,var(--landing-primary)_22%,transparent)_1px,transparent_1px)] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_30%,black_20%,transparent_100%)] bg-[size:4rem_4rem] opacity-[0.1]'
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
              className='h-8 w-8 rounded-full object-cover'
            />
          )}
        </div>
        {loading ? (
          <Skeleton className='h-6 w-24' />
        ) : (
          <h1 className='text-xl font-medium'>{systemName}</h1>
        )}
      </Link>

      <div className='container flex items-center pt-16 sm:pt-0'>
        <div className='mx-auto flex w-full flex-col justify-center px-4 py-8 sm:w-[480px] sm:p-8'>
          <div className='border-landing-primary/20 bg-card/80 space-y-8 rounded-3xl border p-8 shadow-[0_8px_40px_-12px_var(--landing-primary)] backdrop-blur-sm'>
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}
