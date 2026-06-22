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
    <div className='relative grid h-svh max-w-none overflow-hidden bg-background'>
      <div className='pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_16%_12%,oklch(0.95_0.03_68/.7),transparent_42%),radial-gradient(circle_at_82%_2%,oklch(0.92_0.05_46/.45),transparent_46%)]' />
      <Link
        to='/'
        className='pointer-events-auto absolute top-4 left-4 z-10 flex items-center gap-2 rounded-full bg-card/85 px-3 py-1.5 shadow-sm ring-1 ring-border/70 backdrop-blur-sm transition-opacity hover:opacity-80 sm:top-8 sm:left-8'
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
      <div className='container relative z-10 flex items-center pt-16 sm:pt-0'>
        <div className='mx-auto flex w-full flex-col justify-center space-y-2 rounded-3xl border border-border/75 bg-card/92 px-4 py-8 shadow-[0_24px_68px_-42px_color-mix(in_oklch,var(--foreground)_30%,transparent)] backdrop-blur-sm sm:w-[500px] sm:p-9'>
          {children}
        </div>
      </div>
    </div>
  )
}
