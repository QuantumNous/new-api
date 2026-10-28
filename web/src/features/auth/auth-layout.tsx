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
import { ArrowUpRight, Check, Sparkles } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Skeleton } from '@/components/ui/skeleton'
import { useSystemConfig } from '@/hooks/use-system-config'
import { DEFAULT_LOGO } from '@/lib/constants'
import { cn } from '@/lib/utils'

type AuthLayoutProps = {
  children: React.ReactNode
}

export function AuthLayout({ children }: AuthLayoutProps) {
  const { t } = useTranslation()
  const { systemName, logo, loading } = useSystemConfig()

  return (
    <div className='bg-muted/20 relative grid h-svh max-w-none overflow-hidden lg:grid-cols-[minmax(0,1.08fr)_minmax(420px,0.92fr)]'>
      <div className='pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_12%,color-mix(in_oklab,var(--primary)_16%,transparent),transparent_34%),radial-gradient(circle_at_88%_82%,color-mix(in_oklab,var(--chart-2)_14%,transparent),transparent_30%)]' />
      <aside className='bg-foreground text-background relative hidden overflow-hidden p-12 lg:flex lg:flex-col lg:justify-between xl:p-16'>
        <div className='absolute -top-24 -right-24 size-80 rounded-full border border-white/10 bg-white/5 blur-3xl' />
        <div className='absolute right-16 bottom-16 size-52 rounded-full border border-white/10 bg-white/5 blur-2xl' />
        <div className='relative max-w-xl'>
          <div className='mb-16 flex items-center gap-2 text-sm font-medium tracking-[0.18em] uppercase opacity-70'>
            <Sparkles className='size-4' />
            {t('Unified access')}
          </div>
          <p className='mb-5 text-sm font-medium tracking-[0.22em] text-white/55 uppercase'>
            {t('Powerful API Management Platform')}
          </p>
          <h2 className='max-w-lg text-5xl leading-[1.04] font-semibold tracking-[-0.04em] xl:text-6xl'>
            {t('Unified API Gateway for')}{' '}
            <span className='text-primary-foreground/70'>{t('Secure & Reliable')}</span>
          </h2>
          <p className='mt-7 max-w-md text-base leading-7 text-white/65'>
            {t('One place to manage models, keys, usage, and access across your AI stack.')}
          </p>
          <div className='mt-10 grid max-w-md gap-3 text-sm text-white/75'>
            {['Monitor usage in real time', 'Route requests across providers', 'Keep every team on one gateway'].map((item) => (
              <div key={item} className='flex items-center gap-3'>
                <span className='flex size-6 items-center justify-center rounded-full border border-white/15 bg-white/10'>
                  <Check className='size-3.5' />
                </span>
                {t(item)}
              </div>
            ))}
          </div>
        </div>
        <div className='relative flex items-center justify-between text-xs text-white/45'>
          <span>{t('Secure & Reliable')}</span>
          <ArrowUpRight className='size-4' />
        </div>
      </aside>
      <Link
        to='/'
        className='absolute top-4 left-4 z-10 flex items-center gap-2 transition-opacity hover:opacity-80 sm:top-8 sm:left-8'
      >
        <div
          className={cn('relative h-8', logo === DEFAULT_LOGO ? 'w-40' : 'w-8')}
        >
          {loading ? (
            <Skeleton className='absolute inset-0 rounded-full' />
          ) : (
            <img
              src={logo}
              alt={t('Logo')}
              className='h-full w-full object-contain'
            />
          )}
        </div>
        {loading ? (
          <Skeleton className='h-6 w-24' />
        ) : (
          <h1
            className={cn(
              'text-xl font-medium',
              logo === DEFAULT_LOGO && 'sr-only'
            )}
          >
            {systemName}
          </h1>
        )}
      </Link>
      <div className='relative container flex items-center pt-16 sm:pt-0'>
        <div className='mx-auto flex w-full flex-col justify-center space-y-2 px-4 py-8 sm:w-[480px] sm:p-8'>
          <div className='border-border/60 bg-background/80 rounded-2xl border p-5 shadow-2xl shadow-black/5 backdrop-blur-xl sm:p-8'>
          {children}
          </div>
        </div>
      </div>
    </div>
  )
}
