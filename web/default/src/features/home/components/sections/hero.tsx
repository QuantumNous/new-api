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
import { ArrowRight, Braces, Layers3, Sparkles } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { useSystemConfig } from '@/hooks/use-system-config'

import { useHomeStats } from '../../hooks'
import { HeroEcosystem } from '../hero-ecosystem'

interface HeroProps {
  className?: string
  isAuthenticated?: boolean
}

export function Hero(props: HeroProps) {
  const { t } = useTranslation()
  const { systemName } = useSystemConfig()
  const statsQuery = useHomeStats()
  const stats = statsQuery.data?.data
  const brand = systemName || 'BoxAI'

  const facts = stats
    ? [
        {
          icon: Layers3,
          label: t('{{count}} Available Models', {
            count: stats.available_models,
          }),
        },
        {
          icon: Sparkles,
          label: t('{{count}} Model Providers', {
            count: stats.active_vendors,
          }),
        },
        {
          icon: Braces,
          label: t('{{count}} Supported Endpoint Types', {
            count: stats.endpoint_types,
          }),
        },
      ]
    : [
        { icon: Layers3, label: t('Unified Model Catalog') },
        { icon: Braces, label: t('Unified API Access') },
      ]

  return (
    <section
      aria-label={t('Multi-dimensional API Integration Platform')}
      className='relative z-10 overflow-hidden px-6 pt-24 pb-16 md:pt-32 md:pb-20 lg:pt-36 lg:pb-24'
    >
      <div
        aria-hidden
        className='pointer-events-none absolute inset-0 -z-10 opacity-40 dark:opacity-[0.18]'
        style={{
          background: [
            'radial-gradient(ellipse 70% 55% at 15% 20%, oklch(0.78 0.14 250 / 70%) 0%, transparent 70%)',
            'radial-gradient(ellipse 55% 45% at 85% 15%, oklch(0.72 0.12 280 / 55%) 0%, transparent 72%)',
            'radial-gradient(ellipse 45% 40% at 55% 85%, oklch(0.80 0.08 220 / 40%) 0%, transparent 70%)',
          ].join(', '),
        }}
      />

      <div className='mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-12 lg:gap-8'>
        <div className='flex flex-col items-start text-left lg:col-span-5'>
          <div
            className='landing-animate-fade-up mb-5 inline-flex items-center gap-1.5 rounded-full border border-blue-500/20 bg-blue-500/5 px-3 py-1.5 text-[11px] font-medium text-blue-600 opacity-0 shadow-xs dark:border-blue-400/20 dark:bg-blue-400/5 dark:text-blue-400'
            style={{ animationDelay: '0ms' }}
          >
            <Sparkles className='size-3.5' />
            <span>{t('AI Aggregation Platform')}</span>
          </div>

          <h1
            className='landing-animate-fade-up text-[clamp(2.25rem,4.5vw,3.4rem)] leading-[1.12] font-bold tracking-tight opacity-0'
            style={{ animationDelay: '60ms' }}
          >
            <span className='bg-gradient-to-r from-blue-500 via-blue-600 to-violet-500 bg-clip-text text-transparent'>
              {brand}
            </span>{' '}
            {t('Unified AI API Gateway')}
          </h1>

          <p
            className='landing-animate-fade-up text-muted-foreground mt-5 max-w-xl text-base leading-relaxed opacity-0 md:text-[15px]'
            style={{ animationDelay: '120ms' }}
          >
            <span className='text-foreground font-medium'>{brand}</span>{' '}
            {t(
              '(you-box.com) helps developers and enterprises access OpenAI, Claude, Gemini and more through one unified API.'
            )}
          </p>

          <div
            className='landing-animate-fade-up mt-6 flex flex-wrap gap-2 opacity-0'
            style={{ animationDelay: '160ms' }}
          >
            {facts.map((item) => (
              <span
                key={item.label}
                className='border-border/50 bg-background/70 text-muted-foreground inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium shadow-xs backdrop-blur-sm'
              >
                <item.icon className='size-3.5 text-blue-500' />
                {item.label}
              </span>
            ))}
          </div>

          <div
            className='landing-animate-fade-up mt-8 flex flex-wrap items-center gap-3 opacity-0'
            style={{ animationDelay: '200ms' }}
          >
            <Button
              className='group h-11 rounded-full bg-gradient-to-r from-blue-600 to-violet-600 px-6 text-sm font-medium text-white shadow-md hover:from-blue-500 hover:to-violet-500'
              render={
                <Link to={props.isAuthenticated ? '/dashboard' : '/sign-up'} />
              }
            >
              {t('Get Started')}
              <ArrowRight className='ml-1.5 size-4 transition-transform duration-200 group-hover:translate-x-0.5' />
            </Button>
            <Button
              variant='outline'
              className='border-border/50 hover:border-border hover:bg-muted/50 h-11 rounded-full px-6 text-sm font-medium'
              render={<Link to='/pricing' />}
            >
              {t('View Pricing')}
            </Button>
          </div>
        </div>

        <div
          className='landing-animate-fade-up opacity-0 lg:col-span-7'
          style={{ animationDelay: '280ms' }}
        >
          <HeroEcosystem vendors={stats?.vendors ?? []} />
        </div>
      </div>
    </section>
  )
}
