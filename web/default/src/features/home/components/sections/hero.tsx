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
import {
  ArrowRight,
  BookOpen,
  Cable,
  Gauge,
  Network,
  ShieldCheck,
  WalletCards,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useStatus } from '@/hooks/use-status'
import { Button } from '@/components/ui/button'
import { HeroTerminalDemo } from '../hero-terminal-demo'

interface HeroProps {
  className?: string
  isAuthenticated?: boolean
}

const MoreIcon = () => (
  <svg
    className='text-muted-foreground/60 group-hover:text-foreground size-6 shrink-0 transition-colors'
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
  const { status } = useStatus()
  const docsUrl =
    (status?.docs_link as string | undefined) || 'https://docs.newapi.pro'

  const renderDocsButton = () => {
    const isExternal = docsUrl.startsWith('http')
    const buttonClassName =
      'group border-border/50 hover:border-border hover:bg-muted/50 inline-flex h-11 items-center gap-1.5 rounded-lg px-5 text-sm font-medium'

    if (isExternal) {
      return (
        <Button
          variant='outline'
          className={buttonClassName}
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
        className={buttonClassName}
        render={<Link to={docsUrl} />}
      >
        <BookOpen className='text-muted-foreground/80 group-hover:text-foreground size-4 transition-colors duration-200' />
        <span>{t('Docs')}</span>
      </Button>
    )
  }

  return (
    <section className='operator-backplane relative z-10 overflow-hidden px-4 pt-22 pb-14 sm:px-6 md:pt-30 md:pb-20 lg:pt-34 lg:pb-24'>
      <div
        aria-hidden
        className='marketing-mesh absolute inset-x-0 top-0 -z-10 h-[560px] opacity-70 dark:opacity-55'
      />
      <div
        aria-hidden
        className='to-background pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-36 bg-linear-to-b from-transparent'
      />

      <div className='mx-auto grid max-w-6xl grid-cols-1 items-start gap-10 lg:grid-cols-12 lg:gap-8'>
        <div className='flex flex-col items-start text-left lg:col-span-6'>
          <div className='surface-terminal route-node operator-scanline mb-5 inline-flex items-center gap-2 overflow-hidden rounded-md border px-3 py-1.5 font-mono text-[11px] font-semibold tracking-[0.12em] text-[var(--terminal-foreground)] uppercase'>
            <span className='size-1.5 rounded-full bg-[var(--brand-signal)]' />
            <span>{t('Gateway live control')}</span>
          </div>

          <h1 className='max-w-2xl text-[clamp(2.35rem,4.7vw,3.8rem)] leading-[1.05] font-bold tracking-tight'>
            {t('Command the model traffic layer')}
            <br />
            <span className='text-gradient-brand'>
              {t('before it becomes chaos')}
            </span>
          </h1>

          <p className='text-muted-foreground/85 mt-5 max-w-xl text-base leading-relaxed md:text-[15px]'>
            {t(
              'A gateway console for teams running many providers at once: route health, spend drift, quota runway, and fallback behavior stay visible in the same operational surface.'
            )}
          </p>

          <div className='text-muted-foreground mt-6 flex flex-wrap items-center gap-2 font-mono text-[11px]'>
            {['openai', 'claude', 'gemini', 'bedrock'].map(
              (provider, index) => (
                <div key={provider} className='flex items-center gap-2'>
                  <span className='surface-console rounded-md border px-2 py-1'>
                    {provider}
                  </span>
                  {index < 3 && (
                    <Cable className='size-3 text-[var(--brand-route)]' />
                  )}
                </div>
              )
            )}
          </div>

          <div className='mt-8 flex flex-wrap items-center gap-3'>
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

          <div className='mt-8 grid w-full max-w-xl gap-2 sm:grid-cols-3'>
            {[
              {
                icon: Network,
                label: t('Route health'),
                value: t('Failover graph'),
              },
              {
                icon: WalletCards,
                label: t('Spend drift'),
                value: t('Ledger aware'),
              },
              {
                icon: Gauge,
                label: t('Latency budget'),
                value: t('SLO visible'),
              },
            ].map((item) => (
              <div
                key={item.label}
                className='surface-route rounded-lg border p-3'
              >
                <div className='flex items-center gap-2'>
                  <item.icon className='size-4 text-[var(--brand-route)]' />
                  <span className='operator-metric-label'>{item.label}</span>
                </div>
                <div className='mt-2 text-sm font-semibold'>{item.value}</div>
              </div>
            ))}
          </div>

          <div className='mt-8 w-full max-w-xl'>
            <div className='mb-4 flex flex-col gap-1'>
              <span className='text-muted-foreground/50 text-[10px] font-bold tracking-[0.15em] uppercase'>
                {t('Supported Applications')}
              </span>
              <p className='text-muted-foreground/60 text-xs leading-relaxed'>
                {t(
                  'Supports one-click configuration and perfectly adapts to NewAPI multi-protocol configuration.'
                )}
              </p>
            </div>
            <div className='flex flex-wrap items-center gap-3'>
              <a
                href='https://cherry-ai.com'
                target='_blank'
                rel='noopener noreferrer'
                className='surface-console interactive-lift group text-foreground/80 hover:text-foreground flex items-center gap-3 rounded-full border px-5 py-2.5 text-sm font-medium'
              >
                <CherryStudio.Color size={24} className='shrink-0' />
                <span>Cherry Studio</span>
              </a>

              <a
                href='https://ccswitch.io'
                target='_blank'
                rel='noopener noreferrer'
                className='surface-console interactive-lift group text-foreground/80 hover:text-foreground flex items-center gap-3 rounded-full border px-5 py-2.5 text-sm font-medium'
              >
                <span className='flex size-6 shrink-0 items-center justify-center rounded-md bg-blue-500/10 text-[10px] font-bold text-blue-600 dark:bg-blue-400/10 dark:text-blue-400'>
                  CC
                </span>
                <span>CC Switch</span>
              </a>

              <div className='surface-console text-foreground/55 flex cursor-default items-center gap-2.5 rounded-full border px-5 py-2.5 text-sm font-medium'>
                <MoreIcon />
                <span>{t('More Apps')}</span>
              </div>
            </div>
          </div>
        </div>

        <div className='relative flex w-full justify-center lg:col-span-6'>
          <div
            aria-hidden
            className='text-muted-foreground absolute -top-8 right-5 hidden items-center gap-2 text-[10px] font-semibold tracking-[0.16em] uppercase lg:flex'
          >
            <ShieldCheck className='size-3.5 text-[var(--brand-signal)]' />
            {t('Policy guarded')}
          </div>
          <HeroTerminalDemo className='mt-8 w-full lg:mt-0' />
        </div>
      </div>
    </section>
  )
}
