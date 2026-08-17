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
import { ArrowRight, AlertTriangle, DollarSign } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'

interface HeroProps {
  className?: string
  isAuthenticated?: boolean
}

export function Hero(props: HeroProps) {
  const { t } = useTranslation()

  return (
    <section className='relative z-10 flex min-h-svh flex-col items-center justify-center overflow-hidden px-6 py-16 text-center'>
      {/* Radial gradient background */}
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
      {/* Grid pattern */}
      <div
        aria-hidden
        className='absolute inset-0 -z-10 bg-[linear-gradient(to_right,color-mix(in_oklch,var(--landing-primary)_22%,transparent)_1px,transparent_1px),linear-gradient(to_bottom,color-mix(in_oklch,var(--landing-primary)_22%,transparent)_1px,transparent_1px)] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_30%,black_20%,transparent_100%)] bg-[size:4rem_4rem] opacity-[0.1]'
      />

      {/* Top Pill Badge */}
      <div
        className='landing-animate-fade-up border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400 mb-5 inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-medium opacity-0 shadow-xs'
        style={{ animationDelay: '0ms' }}
      >
        <span className='relative flex size-1.5'>
          <span className='bg-amber-500 absolute inline-flex h-full w-full animate-ping rounded-full opacity-75' />
          <span className='bg-amber-600 dark:bg-amber-400 relative inline-flex size-1.5 rounded-full' />
        </span>
        <DollarSign className='size-3 mr-0.5' />
        <span>{t('Affordable AI API Gateway • Use With Care')}</span>
      </div>

      <h1
        className='landing-animate-fade-up text-[clamp(2.25rem,5vw,3.75rem)] leading-[1.15] font-bold tracking-tight'
        style={{ animationDelay: '60ms' }}
      >
        {t('Low-Cost AI API Gateway for')}
        <br />
        <span className='from-landing-primary via-landing-accent to-landing-accent-hot bg-gradient-to-r bg-clip-text text-transparent'>
          {t('Development & Testing')}
        </span>
      </h1>
      <p
        className='landing-animate-fade-up text-muted-foreground/80 mx-auto mt-5 max-w-xl text-base leading-relaxed opacity-0'
        style={{ animationDelay: '120ms' }}
      >
        {t(
          'Access a wide selection of AI models at low cost for personal use, testing, and side projects.'
        )}
      </p>

      {/* Security & Caution Notice Box */}
      <div
        className='landing-animate-fade-up border-amber-500/30 bg-amber-500/5 dark:bg-amber-950/20 text-left mx-auto mt-6 max-w-2xl rounded-xl border p-4.5 opacity-0 backdrop-blur-xs'
        style={{ animationDelay: '150ms' }}
      >
        <div className='flex items-start gap-3'>
          <AlertTriangle className='text-amber-500 mt-0.5 size-5 shrink-0' />
          <div className='space-y-1 text-xs sm:text-sm text-muted-foreground'>
            <p className='font-semibold text-foreground flex items-center gap-1.5'>
              {t('Important Notice & Usage Advisory')}
            </p>
            <p className='leading-relaxed'>
              {t(
                'We provide a low-cost API proxy routing service. Please use this service carefully. For production apps, client projects, or applications with high security and privacy requirements, we strongly recommend purchasing official accounts directly from original providers (OpenAI, Anthropic, Google, etc.).'
              )}
            </p>
          </div>
        </div>
      </div>

      <div
        className='landing-animate-fade-up mt-8 flex flex-wrap items-center justify-center gap-3 opacity-0'
        style={{ animationDelay: '180ms' }}
      >
        {props.isAuthenticated ? (
          <Button
            className='group bg-landing-primary text-landing-on-primary hover:bg-landing-primary-strong h-11 rounded-lg px-6 text-sm font-medium shadow-[0_8px_30px_-10px_var(--landing-primary)]'
            render={<Link to='/dashboard' />}
          >
            {t('Go to Dashboard')}
            <ArrowRight className='ml-1.5 size-4 transition-transform duration-200 group-hover:translate-x-0.5' />
          </Button>
        ) : (
          <>
            <Button
              className='group bg-landing-primary text-landing-on-primary hover:bg-landing-primary-strong h-11 rounded-lg px-6 text-sm font-medium shadow-[0_8px_30px_-10px_var(--landing-primary)]'
              render={<Link to='/sign-up' />}
            >
              {t('Get Started')}
              <ArrowRight className='ml-1.5 size-4 transition-transform duration-200 group-hover:translate-x-0.5' />
            </Button>
            <Button
              variant='outline'
              className='border-landing-primary/30 hover:border-landing-primary/60 hover:bg-landing-primary/10 h-11 rounded-lg px-6 text-sm font-medium'
              render={<Link to='/pricing' />}
            >
              {t('View Pricing')}
            </Button>
          </>
        )}
      </div>
    </section>
  )
}
