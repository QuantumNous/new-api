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
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { useStatus } from '@/hooks/use-status'
import { useSystemConfig } from '@/hooks/use-system-config'
import { cn } from '@/lib/utils'

export type ErrorPageProps = {
  code: string
  title: string
  description: ReactNode
  icon: ReactNode
  iconTone?: 'neutral' | 'destructive' | 'warning' | 'info' | 'success'
  actions?: ReactNode
  /** Compact variant for in-page errors (no hero chrome). */
  minimal?: boolean
  className?: string
}

const ICON_TONE_CLASS: Record<
  NonNullable<ErrorPageProps['iconTone']>,
  string
> = {
  neutral: 'bg-muted text-muted-foreground ring-border/60',
  destructive:
    'bg-destructive/10 text-destructive ring-destructive/20 dark:bg-destructive/15',
  warning:
    'bg-amber-500/10 text-amber-700 ring-amber-500/20 dark:text-amber-300',
  info: 'bg-sky-500/10 text-sky-700 ring-sky-500/20 dark:text-sky-300',
  success:
    'bg-emerald-500/10 text-emerald-700 ring-emerald-500/20 dark:text-emerald-300',
}

/**
 * Shared full-screen error layout with BoxAI brand chrome.
 * Individual pages only supply code, copy, icon and actions.
 */
export function ErrorPage(props: ErrorPageProps) {
  const { t } = useTranslation()
  const { status } = useStatus()
  const { logo } = useSystemConfig()
  const brandName = status?.system_name || 'BoxAI'
  const iconTone = props.iconTone ?? 'neutral'

  if (props.minimal) {
    return (
      <div
        className={cn(
          'flex min-h-[40vh] w-full flex-col items-center justify-center gap-2 px-4 text-center',
          props.className
        )}
      >
        <p className='font-medium'>{props.title}</p>
        <div className='text-muted-foreground max-w-md text-sm'>
          {props.description}
        </div>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'bg-background relative flex min-h-svh w-full flex-col overflow-hidden',
        props.className
      )}
    >
      {/* Soft brand atmosphere — same language as Model Hub / marketing pages */}
      <div
        aria-hidden
        className='pointer-events-none absolute inset-x-0 top-0 h-[520px] opacity-30 dark:opacity-[0.14]'
        style={{
          background: [
            'radial-gradient(ellipse 55% 45% at 18% 12%, oklch(0.72 0.18 250 / 70%) 0%, transparent 70%)',
            'radial-gradient(ellipse 45% 40% at 82% 8%, oklch(0.65 0.14 200 / 55%) 0%, transparent 70%)',
            'radial-gradient(ellipse 40% 35% at 50% 55%, oklch(0.70 0.10 280 / 35%) 0%, transparent 70%)',
          ].join(', '),
          maskImage: 'linear-gradient(to bottom, black 35%, transparent 100%)',
          WebkitMaskImage:
            'linear-gradient(to bottom, black 35%, transparent 100%)',
        }}
      />

      <header className='relative z-10 flex items-center justify-center px-4 pt-8 sm:pt-10'>
        <Link
          to='/'
          className='text-foreground/90 hover:text-foreground border-border/60 bg-background/70 inline-flex items-center gap-2.5 rounded-full border px-3 py-1.5 text-sm font-medium shadow-sm backdrop-blur-md transition-colors'
          aria-label={t('Back to Home')}
        >
          <span className='bg-background ring-border/50 flex size-7 items-center justify-center overflow-hidden rounded-full ring-1'>
            <img
              src={logo || '/logo.png'}
              alt=''
              className='size-full object-cover'
            />
          </span>
          <span className='pr-0.5 tracking-tight'>{brandName}</span>
        </Link>
      </header>

      <main className='relative z-10 flex flex-1 flex-col items-center justify-center px-4 py-12 sm:py-16'>
        <div className='w-full max-w-lg'>
          <div className='border-border/60 bg-card/80 rounded-2xl border p-8 text-center shadow-sm backdrop-blur-sm sm:p-10'>
            <div
              className={cn(
                'mx-auto mb-6 flex size-14 items-center justify-center rounded-2xl ring-1 [&_svg]:size-7',
                ICON_TONE_CLASS[iconTone]
              )}
            >
              {props.icon}
            </div>

            <p className='text-muted-foreground mb-3 font-mono text-xs font-semibold tracking-[0.22em] uppercase'>
              {props.code}
            </p>

            <h1 className='text-foreground text-2xl font-semibold tracking-tight text-balance sm:text-3xl'>
              {props.title}
            </h1>

            <div className='text-muted-foreground mx-auto mt-3 max-w-md text-sm leading-relaxed text-pretty sm:text-[15px]'>
              {props.description}
            </div>

            {props.actions ? (
              <div className='mt-8 flex flex-wrap items-center justify-center gap-3'>
                {props.actions}
              </div>
            ) : null}
          </div>

          <p className='text-muted-foreground/70 mt-6 text-center text-xs tracking-wide'>
            {brandName}
          </p>
        </div>
      </main>
    </div>
  )
}
