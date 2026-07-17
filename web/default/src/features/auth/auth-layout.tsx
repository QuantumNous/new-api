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
  title?: string
  description?: React.ReactNode
  icon?: React.ReactNode
  footer?: React.ReactNode
  children: React.ReactNode
}

export function AuthLayout(props: AuthLayoutProps) {
  const { t } = useTranslation()
  const { systemName, logo, loading } = useSystemConfig()
  const hasHeader = Boolean(props.icon || props.title || props.description)

  return (
    <div className='bg-background flex min-h-svh flex-col items-center justify-center px-6 py-10'>
      <div className='flex w-full max-w-sm flex-col gap-8'>
        <Link
          to='/'
          className='flex items-center justify-center gap-2.5 transition-opacity hover:opacity-80'
        >
          {loading ? (
            <Skeleton className='h-8 w-8 rounded-full' />
          ) : (
            <img
              src={logo}
              alt={t('Logo')}
              className='h-8 w-8 rounded-full object-cover'
            />
          )}
          {loading ? (
            <Skeleton className='h-6 w-28' />
          ) : (
            <span className='text-lg font-medium'>{systemName}</span>
          )}
        </Link>

        <main className='flex flex-col gap-6'>
          {hasHeader && (
            <header className='flex flex-col items-center gap-2 text-center'>
              {props.icon}
              {props.title && (
                <h1 className='text-xl font-semibold tracking-tight'>
                  {props.title}
                </h1>
              )}
              {props.description && (
                <p className='text-muted-foreground text-sm text-balance'>
                  {props.description}
                </p>
              )}
            </header>
          )}
          {props.children}
        </main>

        {props.footer && (
          <footer className='text-muted-foreground text-center text-sm'>
            {props.footer}
          </footer>
        )}
      </div>
    </div>
  )
}
