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

type AuthLayoutProps = {
  children: React.ReactNode
}

export function AuthLayout({ children }: AuthLayoutProps) {
  const { t } = useTranslation()
  const { systemName, logo, loading } = useSystemConfig()

  return (
    <div className='bg-background text-foreground relative grid min-h-svh overflow-hidden'>
      <div aria-hidden className='marketing-mesh absolute inset-0 opacity-25 dark:opacity-10' />
      <div aria-hidden className='marketing-grid absolute inset-0 opacity-[0.06]' />
      <Link
        to='/'
        className='surface-glass absolute top-4 left-4 z-10 flex items-center gap-2 rounded-2xl px-3 py-2 shadow-none transition-opacity hover:opacity-90 sm:top-8 sm:left-8'
      >
        <div className='relative h-8 w-8'>
          {loading ? (
            <Skeleton className='absolute inset-0 rounded-xl' />
          ) : (
            <img
              src={logo}
              alt={t('Logo')}
              className='h-8 w-8 rounded-xl object-cover'
            />
          )}
        </div>
        {loading ? (
          <Skeleton className='h-5 w-24' />
        ) : (
          <h1 className='max-w-44 truncate text-sm font-semibold tracking-tight'>
            {systemName}
          </h1>
        )}
      </Link>

      <div className='container relative flex items-center pt-20 sm:pt-0'>
        <div className='surface-glass mx-auto flex w-full flex-col justify-center rounded-3xl px-5 py-6 shadow-none sm:w-[500px] sm:p-8'>
          <div className='operator-metric-label mb-4'>
            {t('Gateway access')}
          </div>
          {children}
        </div>
      </div>
    </div>
  )
}
