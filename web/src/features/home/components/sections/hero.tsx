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
import { useCallback, useState } from 'react'
import { Link } from '@tanstack/react-router'
import {
  ArrowRight,
  BookOpen,
  Check,
  Copy,
  Handshake,
  Layers,
  Network,
  Sparkles,
  Variable,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { useStatus } from '@/hooks/use-status'

import { StarField } from '../star-field'
import { HeroTerminalDemo } from '../hero-terminal-demo'

interface HeroProps {
  className?: string
  isAuthenticated?: boolean
}

export function Hero(props: HeroProps) {
  const { t } = useTranslation()
  const { status } = useStatus()
  const [copied, setCopied] = useState(false)
  const docsUrl =
    (status?.docs_link as string | undefined) || 'https://docs.newapi.pro'
  const baseUrl =
    (status as Record<string, unknown>)?.server_address as string | undefined ||
    (typeof window !== 'undefined' ? window.location.origin : '')

  const handleCopyUrl = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(baseUrl)
      setCopied(true)
      toast.success(t('Base URL copied'), { duration: 2000 })
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error(t('Failed to copy'))
    }
  }, [baseUrl, t])

  const systemName = (status?.system_name as string) || '随星AI'

  const renderDocsButton = () => {
    const isExternal = docsUrl.startsWith('http')
    if (isExternal) {
      return (
        <Button
          variant='outline'
          className='group border-border/50 hover:border-border hover:bg-muted/50 inline-flex h-11 items-center gap-1.5 rounded-lg px-5 text-sm font-medium'
          render={
            <a href={docsUrl} target='_blank' rel='noopener noreferrer' />
          }
        >
          <BookOpen className='text-muted-foreground/80 group-hover:text-foreground size-4 transition-colors duration-200' />
          <span>{t('Docs')}</span>
        </Button>
      )
    }
    return (
      <Button
        variant='outline'
        className='group border-border/50 hover:border-border hover:bg-muted/50 inline-flex h-11 items-center gap-1.5 rounded-lg px-5 text-sm font-medium'
        render={<Link to={docsUrl} />}
      >
        <BookOpen className='text-muted-foreground/80 group-hover:text-foreground size-4 transition-colors duration-200' />
        <span>{t('Docs')}</span>
      </Button>
    )
  }

  return (
    <section className='relative z-10 overflow-hidden px-6 pt-24 pb-20 md:pt-32 md:pb-28 lg:pt-36 lg:pb-32'>
      {/* Star field background */}
      <StarField />

      {/* Gradient mesh orbs */}
      <div
        aria-hidden
        className='pointer-events-none absolute inset-0 -z-10 opacity-25 dark:opacity-[0.15]'
        style={{
          background: [
            'radial-gradient(ellipse 55% 45% at 15% 20%, oklch(0.62 0.18 260 / 70%) 0%, transparent 65%)',
            'radial-gradient(ellipse 45% 40% at 80% 10%, oklch(0.55 0.15 220 / 60%) 0%, transparent 65%)',
            'radial-gradient(ellipse 35% 30% at 50% 75%, oklch(0.65 0.12 180 / 50%) 0%, transparent 65%)',
            'radial-gradient(ellipse 25% 30% at 70% 60%, oklch(0.58 0.14 290 / 40%) 0%, transparent 65%)',
          ].join(', '),
        }}
      />

      {/* Subtle grid overlay */}
      <div
        aria-hidden
        className='absolute inset-0 -z-10 [mask-image:radial-gradient(ellipse_60%_50%_at_50%_30%,black_20%,transparent_100%)]'
        style={{
          backgroundImage: [
            'linear-gradient(to_right, oklch(0.5 0.05 260 / 0.04) 1px, transparent 1px)',
            'linear-gradient(to_bottom, oklch(0.5 0.05 260 / 0.04) 1px, transparent 1px)',
          ].join(', '),
          backgroundSize: '4rem 4rem',
        }}
      />

      <div className='mx-auto grid max-w-6xl grid-cols-1 items-center gap-12 lg:grid-cols-12 lg:gap-8'>
        {/* Left Column: Brand copy */}
        <div className='flex flex-col items-start text-left lg:col-span-6'>
          {/* Brand pill */}
          <div
            className='landing-animate-fade-up mb-5 inline-flex items-center gap-1.5 rounded-full border border-amber-500/20 bg-amber-500/5 px-3 py-1.5 text-xs font-medium text-amber-600 opacity-0 shadow-xs dark:border-amber-400/20 dark:bg-amber-400/5 dark:text-amber-400'
            style={{ animationDelay: '0ms' }}
          >
            <Sparkles className='size-3' />
            <span>{t('Multi-Model API Gateway & Compute Engine')}</span>
          </div>

          {/* Main title */}
          <h1
            className='landing-animate-fade-up text-[clamp(2.25rem,5vw,3.5rem)] leading-[1.1] font-bold tracking-tight'
            style={{ animationDelay: '60ms' }}
          >
            <span className='bg-gradient-to-r from-cyan-400 via-blue-400 to-violet-500 bg-clip-text text-transparent'>
              {systemName}
            </span>
            <span className='text-muted-foreground/30 mx-2 select-none font-light'>
              ·
            </span>
            <span className='bg-gradient-to-r from-amber-400 via-orange-400 to-rose-500 bg-clip-text text-transparent'>
              {t('Computing Engine')}
            </span>
            <br />
            <span className='text-foreground/80 text-[clamp(1rem,2vw,1.5rem)] font-normal'>
              {t('Unified AI API Gateway & Compute Aggregation Platform')}
            </span>
          </h1>

          <p
            className='landing-animate-fade-up text-muted-foreground/80 mt-6 max-w-xl text-lg leading-relaxed opacity-0 md:text-base'
            style={{ animationDelay: '120ms' }}
          >
            {t(
              'An enterprise AI compute platform — not just an API relay. Unified access, expression-based pricing, multi-level wholesale distribution, and full revenue settlement. Deploy your private compute gateway for wholesale, SaaS embedding, and team collaboration.'
            )}
          </p>

          {/* CTA buttons */}
          <div
            className='landing-animate-fade-up mt-8 flex flex-wrap items-center gap-3 opacity-0'
            style={{ animationDelay: '180ms' }}
          >
            {props.isAuthenticated ? (
              <>
                <Button
                  className='group h-11 rounded-lg px-5 text-sm font-medium'
                  render={<Link to='/dashboard' />}
                >
                  {t('Go to Dashboard')}
                  <ArrowRight className='ml-1.5 size-4 transition-transform duration-200 group-hover:translate-x-0.5' />
                </Button>
                {renderDocsButton()}
              </>
            ) : (
              <>
                <Button
                  className='group h-11 rounded-lg px-5 text-sm font-medium'
                  render={<Link to='/sign-up' />}
                >
                  {t('Get Started')}
                  <ArrowRight className='ml-1.5 size-4 transition-transform duration-200 group-hover:translate-x-0.5' />
                </Button>
                <Button
                  variant='outline'
                  className='border-border/50 hover:border-border hover:bg-muted/50 h-11 rounded-lg px-5 text-sm font-medium'
                  render={<Link to='/pricing' />}
                >
                  {t('View Pricing')}
                </Button>
                {renderDocsButton()}
              </>
            )}
          </div>

          {/* Quick feature pills */}
          <div
            className='landing-animate-fade-up mt-10 flex flex-wrap items-center gap-2 opacity-0'
            style={{ animationDelay: '240ms' }}
          >
            {[
              { icon: Layers, text: t('100+ Models') },
              { icon: Network, text: t('40+ Providers') },
              { icon: Variable, text: t('Expression Billing') },
              { icon: Handshake, text: t('Revenue Split') },
            ].map((item) => (
              <div
                key={item.text}
                className='border-border/30 bg-muted/10 text-muted-foreground hover:border-border/50 hover:bg-muted/20 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors duration-200'
              >
                <item.icon className='size-3' />
                <span>{item.text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column: Terminal demo */}
        <HeroTerminalDemo className='landing-animate-fade-up flex w-full justify-center opacity-0 lg:col-span-6' />
      </div>

      {/* Base URL card (below grid) */}
      <div
        className='landing-animate-fade-up mx-auto mt-10 max-w-md opacity-0'
        style={{ animationDelay: '400ms' }}
      >
        <div className='flex items-center gap-2 rounded-xl border border-border/50 bg-white p-3 shadow-sm backdrop-blur-sm transition-all duration-300 hover:border-cyan-400/40 hover:shadow-md dark:bg-white/95'>
          <div className='min-w-0 flex-1'>
            <p className='text-muted-foreground/60 mb-0.5 text-xs font-medium tracking-wider uppercase'>
              Base URL
            </p>
            <p className='text-foreground truncate text-base font-mono font-medium tracking-tight'>
              {baseUrl}
            </p>
          </div>
          <button
            type='button'
            onClick={handleCopyUrl}
            className='flex size-9 shrink-0 items-center justify-center rounded-lg border border-border/40 bg-white text-muted-foreground transition-all duration-200 hover:border-cyan-500/30 hover:bg-cyan-500/10 hover:text-cyan-500 dark:bg-white/90'
            title={t('Copy Base URL')}
          >
            {copied ? (
              <Check className='size-4 text-emerald-500' />
            ) : (
              <Copy className='size-4' />
            )}
          </button>
        </div>
      </div>
    </section>
  )
}
