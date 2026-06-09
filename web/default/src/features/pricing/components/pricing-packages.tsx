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
  Ban,
  Boxes,
  CheckCircle2,
  DollarSign,
  Gauge,
  Mail,
  Wallet,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/stores/auth-store'
import { Button } from '@/components/ui/button'
import { FlatkeyTallyEmbed } from './flatkey-tally-embed'

export function PricingPackages() {
  const { t } = useTranslation()
  const user = useAuthStore((state) => state.auth.user)
  const ctaTarget = user ? '/dashboard' : '/sign-up'
  const ctaLabel = user ? t('Go to the Console') : t('Get free API key')
  const topModelNames = [
    'GPT-5.1',
    'Claude Opus 4.7',
    'Gemini 3.5 Flash',
    'DeepSeek V4',
    t('More'),
  ]
  const sellingPoints = [
    t('Permanently 20–40% cheaper'),
    t('One API key for everything'),
    t('Zero vendor lock-in'),
    t('Usage analytics & cost control'),
    t('Enterprise-grade privacy'),
    t('One unified invoice for all providers'),
  ]
  const pricingHighlights = [
    {
      icon: DollarSign,
      metric: '$10',
      label: t('minimum website package'),
    },
    {
      icon: Boxes,
      metric: '100+',
      label: t('models available through one balance'),
    },
    {
      icon: Wallet,
      metric: '1',
      label: t('balance across GPT, Claude, Gemini, DeepSeek, and more'),
    },
    {
      icon: Gauge,
      metric: '3',
      label: t('metered token types: input, output, cache-hit'),
    },
    {
      icon: Ban,
      metric: '0',
      label: t('fixed bundle lock-in'),
    },
  ]

  return (
    <section className='mb-8 rounded-3xl border border-violet-500/16 bg-white/62 p-5 shadow-[0_24px_70px_-52px_rgba(91,33,182,0.78)] backdrop-blur-sm sm:p-6 dark:border-violet-300/14 dark:bg-white/[0.035]'>
      <div className='mb-5 max-w-none'>
        <p className='text-muted-foreground mb-2 text-xs font-medium tracking-widest uppercase'>
          {t('Plans and top-up packages')}
        </p>
        <h2 className='text-xl font-bold tracking-tight sm:text-2xl'>
          {t('Transparent pricing for every AI model')}
        </h2>
        <p className='text-muted-foreground mt-3 text-sm leading-7 md:whitespace-nowrap'>
          {t(
            'Start from $10 to try leading models like GPT-5.1, Claude Opus 4.7, Gemini 3.5 Flash, DeepSeek V4, and more with one prepaid balance.'
          )}
        </p>
        <div className='mt-4 flex flex-wrap gap-2'>
          {topModelNames.map((modelName) => (
            <span
              key={modelName}
              className='rounded-full border border-violet-500/15 bg-violet-500/6 px-3 py-1 text-xs font-medium text-violet-800 dark:border-violet-300/15 dark:bg-violet-300/8 dark:text-violet-100'
            >
              {modelName}
            </span>
          ))}
        </div>
      </div>

      <div className='grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]'>
        <article className='rounded-2xl border border-violet-500/14 bg-white/66 p-5 transition-colors duration-300 dark:border-violet-300/12 dark:bg-white/[0.035]'>
          <div>
            <p className='text-muted-foreground text-xs font-medium tracking-widest uppercase'>
              {t('Website package')}
            </p>
            <h3 className='mt-2 text-base font-semibold tracking-tight'>
              {t('Prepaid balance for top AI models')}
            </h3>
          </div>

          <div className='mt-5 flex items-end gap-2'>
            <span className='text-4xl font-bold tracking-tight'>$10</span>
            <span className='text-muted-foreground pb-1 text-sm'>
              {t('starting package')}
              {t('，')}
              {t('Pay as you go with the balance you add.').replace(
                /[.。]$/,
                ''
              )}
            </span>
          </div>

          <div className='mt-5 space-y-3 text-sm'>
            <p className='flex gap-2 leading-6'>
              <CheckCircle2 className='mt-0.5 size-4 shrink-0 text-violet-600 dark:text-violet-200' />
              <span>{t('Successful payment adds prepaid balance.')}</span>
            </p>
            <p className='flex gap-2 leading-6'>
              <CheckCircle2 className='mt-0.5 size-4 shrink-0 text-violet-600 dark:text-violet-200' />
              <span>
                {t(
                  'Usage is charged by model input, output, and cache-hit token prices.'
                )}
              </span>
            </p>
          </div>

          <div className='mt-5 space-y-3 text-sm'>
            {sellingPoints.map((point) => (
              <p key={point} className='flex gap-2 leading-6'>
                <CheckCircle2 className='mt-0.5 size-4 shrink-0 text-violet-600 dark:text-violet-200' />
                <span>{point}</span>
              </p>
            ))}
          </div>

          <Button
            className='mt-6 w-full justify-center sm:w-auto'
            render={<Link to={ctaTarget} />}
          >
            {ctaLabel}
            <ArrowRight className='ml-2 size-4' aria-hidden='true' />
          </Button>
        </article>

        <article className='rounded-2xl border border-violet-500/14 bg-white/66 p-5 dark:border-violet-300/12 dark:bg-white/[0.035]'>
          <div className='flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between'>
            <div>
              <p className='text-muted-foreground text-xs font-medium tracking-widest uppercase'>
                {t('Enterprise teams')}
              </p>
              <h3 className='mt-2 text-base font-semibold tracking-tight'>
                {t(
                  'Contact sales for higher monthly usage and greater discounts.'
                )}
              </h3>
            </div>
            <a
              className='inline-flex h-9 shrink-0 items-center gap-2 rounded-full border border-violet-500/16 bg-violet-500/8 px-3 text-sm font-semibold text-violet-700 transition-colors hover:border-violet-500/25 hover:bg-violet-500/12 hover:text-violet-600 dark:border-violet-300/14 dark:bg-violet-300/8 dark:text-violet-100 dark:hover:bg-violet-300/12'
              href='mailto:support@flatkey.ai'
            >
              <Mail className='size-4' aria-hidden='true' />
              support@flatkey.ai
            </a>
          </div>

          <FlatkeyTallyEmbed className='mt-5 rounded-xl border border-violet-500/12 bg-white/62 p-3 shadow-[0_18px_46px_-36px_rgba(91,33,182,0.5)] dark:border-violet-300/12 dark:bg-white/[0.035]' />
        </article>
      </div>

      <div className='mt-5 border-t border-violet-500/12 pt-5 dark:border-violet-300/12'>
        <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-5'>
          {pricingHighlights.map((highlight) => {
            const Icon = highlight.icon

            return (
              <div
                key={highlight.label}
                className='flex gap-3 rounded-xl border border-violet-500/12 bg-white/58 px-4 py-4 dark:border-violet-300/12 dark:bg-white/[0.035]'
              >
                <span className='mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-violet-500/8 text-violet-700 dark:bg-violet-300/10 dark:text-violet-100'>
                  <Icon className='size-4' aria-hidden='true' />
                </span>
                <div>
                  <p className='text-xl font-bold text-violet-700 dark:text-violet-100'>
                    {highlight.metric}
                  </p>
                  <p className='text-muted-foreground mt-1 text-xs leading-5'>
                    {highlight.label}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
