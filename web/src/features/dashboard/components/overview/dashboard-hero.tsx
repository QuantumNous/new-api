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
import {
  ArrowRight,
  BookOpenText,
  KeyRound,
  Layers,
  Sparkles,
  Wallet,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/stores/auth-store'
import { useStatus } from '@/hooks/use-status'
import { useSystemConfig } from '@/hooks/use-system-config'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { heroBackground, mascotHero } from '@/assets/mascots'

interface FeatureChip {
  icon: typeof Sparkles
  label: string
}

/**
 * Dashboard overview hero — large welcome banner with the main mascot,
 * the brand tagline and primary calls-to-action for logged-in users.
 */
export function DashboardHero() {
  const { t } = useTranslation()
  const user = useAuthStore((s) => s.auth.user)
  const { status } = useStatus()
  const { systemName } = useSystemConfig()
  const docsLink = (status?.docs_link as string | undefined) ?? '/docs'

  const greeting = user?.display_name || user?.username
  const brand = status?.system_name || systemName

  const chips: FeatureChip[] = [
    { icon: Layers, label: t('Unified multi-model access') },
    { icon: Sparkles, label: t('High availability & auto retry') },
    { icon: Wallet, label: t('Pay-as-you-go & low cost') },
  ]

  return (
    <section
      aria-label={t('Dashboard hero')}
      className={cn(
        'relative isolate overflow-hidden rounded-3xl',
        'border border-white/40 dark:border-white/10',
        'shadow-[var(--shadow-soft)]'
      )}
    >
      {/* Background layers */}
      <div
        aria-hidden
        className='absolute inset-0 -z-20 hero-gradient'
      />
      <div
        aria-hidden
        className='absolute inset-0 -z-10 bg-cover bg-center opacity-90 dark:opacity-70'
        style={{ backgroundImage: `url(${heroBackground})` }}
      />
      <div
        aria-hidden
        className='absolute inset-0 -z-10 bg-linear-to-r from-background/55 via-background/20 to-transparent dark:from-background/70 dark:via-background/30'
      />

      <div className='relative grid gap-6 px-5 py-6 sm:px-8 sm:py-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:gap-10 lg:py-10'>
        {/* Left: copy + CTA */}
        <div className='flex min-w-0 flex-col justify-center gap-5'>
          {greeting && (
            <div className='inline-flex w-fit items-center gap-1.5 rounded-full bg-white/70 px-3 py-1 text-xs font-medium text-[var(--accent-blue)] backdrop-blur-md dark:bg-white/10'>
              <Sparkles className='size-3.5' aria-hidden />
              {t('Welcome back, {{name}}', { name: greeting })}
            </div>
          )}

          <h1 className='text-balance text-3xl font-bold leading-tight tracking-tight sm:text-4xl xl:text-5xl'>
            {t('One-stop')}{' '}
            <span className='bg-gradient-to-r from-[var(--accent-blue)] to-[var(--accent-cyan)] bg-clip-text text-transparent'>
              LLM API
            </span>{' '}
            {t('Gateway')}
          </h1>

          <p className='max-w-xl text-balance text-sm leading-relaxed text-muted-foreground sm:text-base'>
            {t(
              'Unified access to many large models, smart routing, balance management, fast integration. {{brand}} delivers a stable, low-cost API service for developers and teams.',
              { brand }
            )}
          </p>

          <div className='flex flex-wrap items-center gap-2'>
            <Button size='lg' className='gap-1.5' render={<Link to='/keys' />}>
              <KeyRound className='size-4' aria-hidden />
              {t('Create API Key')}
              <ArrowRight className='size-4' aria-hidden />
            </Button>
            <Button
              size='lg'
              variant='outline'
              className='gap-1.5 bg-white/60 backdrop-blur-md dark:bg-white/5'
              render={
                <a href={docsLink} target='_blank' rel='noreferrer' />
              }
            >
              <BookOpenText className='size-4' aria-hidden />
              {t('View API Docs')}
            </Button>
          </div>

          <div className='flex flex-wrap gap-3 pt-1 text-xs text-muted-foreground'>
            {chips.map((chip) => {
              const Icon = chip.icon
              return (
                <span
                  key={chip.label}
                  className='inline-flex items-center gap-1.5 rounded-full bg-white/60 px-3 py-1 backdrop-blur-md dark:bg-white/5'
                >
                  <Icon className='size-3.5 text-[var(--accent-blue)]' aria-hidden />
                  {chip.label}
                </span>
              )
            })}
          </div>
        </div>

        {/* Right: mascot + glass uptime card */}
        <div className='relative flex min-h-[16rem] items-end justify-center lg:justify-end'>
          <img
            src={mascotHero}
            alt={t('Brand mascot')}
            className='pointer-events-none select-none object-contain drop-shadow-2xl lg:absolute lg:right-0 lg:bottom-0 lg:top-0 lg:my-auto lg:max-h-[26rem]'
            draggable={false}
            loading='eager'
            decoding='async'
          />
        </div>
      </div>
    </section>
  )
}
