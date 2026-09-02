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
import { Check, Sparkles } from 'lucide-react'
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
    <div className='dopa-page-canvas dopa-auth-canvas dopa-auth-lamp relative grid min-h-svh max-w-none overflow-hidden lg:grid-cols-[1.08fr_0.92fr]'>
      {/* Ambient dopamine decoration */}
      <div aria-hidden='true' className='pointer-events-none absolute inset-0'>
        <div className='dopa-blob dopa-float bg-primary/30 absolute -top-16 -left-16 size-64' />
        <div className='dopa-blob dopa-float-alt bg-chart-3/25 absolute right-[-4rem] bottom-[-4rem] size-72' />
        <div className='dopa-blob dopa-float-delayed bg-chart-4/20 absolute top-1/3 right-1/4 size-40' />
      </div>
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
      <section className='relative hidden items-end px-10 py-12 lg:flex xl:px-16 xl:py-16'>
        <div className='dopa-fade-up max-w-2xl'>
          <span className='dopa-section-kicker'>
            <Sparkles className='size-4' />
            {t('Leave expensive monthly fees behind · Ready in 1 minute')}
          </span>
          <h2 className='mt-6 text-5xl leading-[1.02] font-black tracking-[-0.07em] text-balance xl:text-6xl'>
            {t("Bring top-tier AI into everyone's daily life")}
          </h2>
          <p className='dopa-gradient-text mt-4 text-3xl leading-tight font-black tracking-[-0.05em] xl:text-4xl'>
            {t('Pay as you go, savings you can see')}
          </p>
          <div className='mt-10 grid gap-3 text-sm font-semibold'>
            {[
              t('True pay-as-you-go: pay only for what you use'),
              t('Fully compatible with 30+ popular everyday tools'),
              t('Manual setup, always available'),
            ].map((item) => (
              <span key={item} className='flex items-center gap-3'>
                <span className='bg-primary/12 text-primary flex size-7 items-center justify-center rounded-full'>
                  <Check className='size-3.5' />
                </span>
                {item}
              </span>
            ))}
          </div>
        </div>
      </section>
      <div className='lg:bg-background/46 relative flex items-center px-4 pt-20 pb-8 sm:px-8 sm:pt-24 lg:px-10 lg:pt-16'>
        <div className='dopa-fade-up dopa-paper dopa-cut-corner relative mx-auto flex w-full flex-col justify-center space-y-2 overflow-hidden px-5 py-8 sm:w-[500px] sm:p-9'>
          {children}
        </div>
      </div>
    </div>
  )
}
