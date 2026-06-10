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
import { CherryStudio } from '@lobehub/icons'
import { ArrowRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { buildAttributionHref } from '@/lib/analytics/attribution'
import { trackAdsFunnelEvent } from '@/lib/analytics/gtag'
import { HeroTerminalDemo } from '../hero-terminal-demo'

interface HeroProps {
  className?: string
  isAuthenticated?: boolean
}

// Stylized three-dots indicator representing "More"
const MoreIcon = () => (
  <svg
    className='text-muted-foreground/60 group-hover:text-foreground size-5 shrink-0 transition-colors'
    viewBox='0 0 24 24'
    fill='none'
    xmlns='http://www.w3.org/2000/svg'
  >
    <circle cx='6' cy='12' r='2' fill='currentColor' />
    <circle cx='12' cy='12' r='2' fill='currentColor' />
    <circle cx='18' cy='12' r='2' fill='currentColor' />
  </svg>
)

export function Hero(props: HeroProps) {
  const { t } = useTranslation()
  const signUpHref = buildAttributionHref('/sign-up')
  const trackCtaClick = () => {
    trackAdsFunnelEvent('flatkey_signup_cta_click', {
      placement: 'hero',
    })
  }

  return (
    <section className='relative z-10 overflow-hidden px-6 pt-24 pb-16 md:pt-32 md:pb-24 lg:pt-36 lg:pb-28'>
      {/* Radial gradient background */}
      <div
        aria-hidden
        className='pointer-events-none absolute inset-0 -z-10 opacity-40 dark:opacity-55'
        style={{
          background: [
            'radial-gradient(ellipse 70% 48% at 18% 8%, rgba(167,139,250,0.34) 0%, transparent 68%)',
            'radial-gradient(ellipse 64% 42% at 82% 8%, rgba(217,70,239,0.22) 0%, transparent 70%)',
            'linear-gradient(180deg, rgba(124,58,237,0.08), transparent 48%)',
          ].join(', '),
        }}
      />
      {/* Grid pattern */}
      <div
        aria-hidden
        className='absolute inset-0 -z-10 bg-[linear-gradient(to_right,rgba(124,58,237,0.16)_1px,transparent_1px),linear-gradient(to_bottom,rgba(124,58,237,0.14)_1px,transparent_1px)] [mask-image:radial-gradient(ellipse_64%_52%_at_50%_28%,black_20%,transparent_100%)] bg-[size:4rem_4rem] opacity-35 dark:opacity-45'
      />

      <div className='mx-auto grid max-w-6xl grid-cols-1 items-start gap-12 lg:grid-cols-12 lg:gap-8'>
        {/* Left Column: Title, description, action buttons and application support */}
        <div className='flex flex-col items-start text-left lg:col-span-6'>
          {/* Top Pill Badge */}
          <div
            className='landing-animate-fade-up mb-5 inline-flex items-center gap-1.5 rounded-full border border-violet-500/25 bg-violet-500/10 px-3 py-1.5 text-[11px] font-medium text-violet-700 opacity-0 shadow-[0_12px_34px_-22px_rgba(124,58,237,0.75)] dark:border-violet-300/25 dark:bg-violet-300/10 dark:text-violet-200'
            style={{ animationDelay: '0ms' }}
          >
            <span className='relative flex size-1.5'>
              <span className='absolute inline-flex h-full w-full animate-ping rounded-full bg-violet-400 opacity-75' />
              <span className='relative inline-flex size-1.5 rounded-full bg-violet-500 dark:bg-violet-300' />
            </span>
            <span>{t('Multi-model compatible, enterprise-ready')}</span>
          </div>

          <h1
            className='landing-animate-fade-up text-[clamp(2.25rem,4.5vw,3.25rem)] leading-[1.15] font-bold tracking-tight'
            style={{ animationDelay: '60ms' }}
          >
            {t('Every model.')}
            <br />
            <span className='bg-gradient-to-r from-violet-500 via-fuchsia-500 to-indigo-500 bg-clip-text text-transparent dark:from-violet-200 dark:via-fuchsia-300 dark:to-indigo-300'>
              {t('One key. Flat rate.')}
            </span>
          </h1>
          <p
            className='landing-animate-fade-up text-muted-foreground/80 mt-5 max-w-xl text-base leading-relaxed opacity-0 md:text-[15px]'
            style={{ animationDelay: '120ms' }}
          >
            {t(
              'Access Claude, GPT, Gemini, DeepSeek, Qwen, Seedance 2.0, GPT Image, and more with one API key. No need to manage separate provider accounts. Clear pricing, unified billing, and one dashboard for keys, usage, and routing.'
            )}
          </p>

          <div
            className='landing-animate-fade-up mt-8 flex flex-wrap items-center gap-3 opacity-0'
            style={{ animationDelay: '180ms' }}
          >
            {props.isAuthenticated ? (
              <>
                <Button
                  className='group h-11 rounded-lg bg-violet-600 px-5 text-sm font-medium text-white shadow-[0_16px_34px_-18px_rgba(124,58,237,0.85)] hover:bg-violet-500'
                  render={<Link to='/dashboard' />}
                >
                  {t('Go to Dashboard')}
                  <ArrowRight className='ml-1.5 size-4 transition-transform duration-200 group-hover:translate-x-0.5' />
                </Button>
              </>
            ) : (
              <>
                <Button
                  className='group h-11 rounded-lg bg-violet-600 px-5 text-sm font-medium text-white shadow-[0_16px_34px_-18px_rgba(124,58,237,0.85)] hover:bg-violet-500'
                  render={<a href={signUpHref} onClick={trackCtaClick} />}
                >
                  {t('Get a key')}
                  <ArrowRight className='ml-1.5 size-4 transition-transform duration-200 group-hover:translate-x-0.5' />
                </Button>
                <Button
                  variant='outline'
                  className='h-11 rounded-lg border-violet-500/20 bg-white/65 px-5 text-sm font-medium hover:border-violet-500/35 hover:bg-violet-500/10 dark:bg-white/[0.04] dark:hover:bg-violet-300/10'
                  render={<Link to='/pricing' />}
                >
                  {t('View Pricing')}
                </Button>
              </>
            )}
          </div>

          {/* Supported Apps (参考图二样式，进行卡片化和信息扩充设计，增加视觉高度) */}
          <div
            className='landing-animate-fade-up mt-10 w-full max-w-xl opacity-0'
            style={{ animationDelay: '240ms' }}
          >
            <div className='mb-4 flex flex-col gap-1'>
              <span className='text-muted-foreground/50 text-[10px] font-bold tracking-[0.15em] uppercase'>
                {t('Works with your current tools')}
              </span>
              <p className='text-muted-foreground/60 text-xs leading-relaxed'>
                {t(
                  'Supports one-click configuration and perfectly adapts to NewAPI multi-protocol configuration.'
                )}
              </p>
            </div>
            <div className='flex flex-wrap items-center gap-3'>
              {/* Cherry Studio */}
              <div
                className='group flex cursor-default items-center gap-2.5 rounded-full border border-violet-500/15 bg-white/65 px-4 py-2 text-[13px] font-medium text-foreground/80 shadow-[0_12px_38px_-28px_rgba(124,58,237,0.7)] backdrop-blur-xs transition-all duration-300 hover:border-violet-500/30 hover:bg-violet-500/10 hover:text-foreground dark:bg-white/[0.04] dark:hover:bg-violet-300/10'
              >
                <CherryStudio.Color size={20} className='shrink-0' />
                <span>Cherry Studio</span>
              </div>

              {/* CC Switch */}
              <div
                className='group flex cursor-default items-center gap-2.5 rounded-full border border-violet-500/15 bg-white/65 px-4 py-2 text-[13px] font-medium text-foreground/80 shadow-[0_12px_38px_-28px_rgba(124,58,237,0.7)] backdrop-blur-xs transition-all duration-300 hover:border-violet-500/30 hover:bg-violet-500/10 hover:text-foreground dark:bg-white/[0.04] dark:hover:bg-violet-300/10'
              >
                <img
                  src='https://ccswitch.io/favicon.png'
                  alt='CC Switch'
                  className='size-5 shrink-0 rounded-md object-contain'
                  onError={(e) => {
                    // Fallback to a styled text avatar if the remote favicon fails to load in sandbox or local environments
                    e.currentTarget.style.display = 'none'
                    const fallback = e.currentTarget.nextSibling as HTMLElement
                    if (fallback) fallback.style.display = 'flex'
                  }}
                />
                <span
                  style={{ display: 'none' }}
                  className='size-5 shrink-0 items-center justify-center rounded-md bg-blue-500/10 text-[9px] font-bold text-blue-600 dark:bg-blue-400/10 dark:text-blue-400'
                >
                  CC
                </span>
                <span>CC Switch</span>
              </div>

              {/* "更多" */}
              <div className='group flex cursor-default items-center gap-2 rounded-full border border-violet-500/15 bg-white/65 px-4 py-2 text-[13px] font-medium text-foreground/55 shadow-[0_12px_38px_-28px_rgba(124,58,237,0.7)] backdrop-blur-xs transition-all duration-300 hover:border-violet-500/30 hover:bg-violet-500/10 hover:text-foreground dark:bg-white/[0.04] dark:hover:bg-violet-300/10'>
                <MoreIcon />
                <span>{t('More Apps')}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Hero Terminal API Demo */}
        <div
          className='landing-animate-fade-up flex w-full justify-center opacity-0 lg:col-span-6'
          style={{ animationDelay: '320ms' }}
        >
          <HeroTerminalDemo className='mt-8 lg:mt-0' />
        </div>
      </div>
    </section>
  )
}
