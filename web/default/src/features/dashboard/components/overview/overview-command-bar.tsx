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
import { FileText, KeyRound, Play, type LucideIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { IconBadge, type IconBadgeTone } from '@/components/ui/icon-badge'
import { Skeleton } from '@/components/ui/skeleton'
import { formatNumber } from '@/lib/format'
import { cn } from '@/lib/utils'

import { useCountUp } from '../../hooks/use-count-up'

export interface CommandBarSignal {
  key: string
  label: string
  /** Text fallback when numericValue is not provided. */
  value?: string
  numericValue?: number
  icon: LucideIcon
  tone: IconBadgeTone
  loading?: boolean
}

interface OverviewCommandBarProps {
  online: boolean
  statusLoading: boolean
  signals: CommandBarSignal[]
}

function StatusPill(props: { online: boolean; loading: boolean }) {
  const { t } = useTranslation()

  let statusLabel = t('No data')
  if (props.loading) {
    statusLabel = t('Loading...')
  } else if (props.online) {
    statusLabel = t('All systems operational')
  }

  return (
    <div className='bg-muted/50 flex shrink-0 items-center gap-2 rounded-full px-2.5 py-1'>
      <span className='relative flex size-2'>
        {props.online && (
          <span
            className='bg-success absolute inline-flex size-full animate-ping rounded-full opacity-60'
            aria-hidden='true'
          />
        )}
        <span
          className={cn(
            'relative inline-flex size-2 rounded-full',
            props.online ? 'bg-success' : 'bg-muted-foreground/45'
          )}
          aria-hidden='true'
        />
      </span>
      <span className='text-xs font-medium'>{statusLabel}</span>
    </div>
  )
}

function SignalValue(props: { signal: CommandBarSignal }) {
  const animated = useCountUp(props.signal.numericValue ?? 0)

  if (props.signal.loading) {
    return <Skeleton className='h-4 w-10' />
  }
  if (props.signal.numericValue != null) {
    return (
      <span className='font-mono text-sm font-semibold tabular-nums'>
        {formatNumber(Math.round(animated))}
      </span>
    )
  }
  return (
    <span
      className='max-w-36 truncate font-mono text-sm font-semibold sm:max-w-48'
      title={props.signal.value}
    >
      {props.signal.value}
    </span>
  )
}

export function OverviewCommandBar(props: OverviewCommandBarProps) {
  const { t } = useTranslation()

  return (
    <section className='bg-card relative overflow-hidden rounded-2xl border shadow-xs'>
      <div
        className='pointer-events-none absolute -top-16 right-[8%] size-44 rounded-full bg-[color-mix(in_oklch,var(--overview-accent-1)_10%,transparent)] blur-3xl'
        aria-hidden='true'
      />
      <div
        className='pointer-events-none absolute -bottom-20 left-[35%] size-48 rounded-full bg-[color-mix(in_oklch,var(--overview-accent-3)_8%,transparent)] blur-3xl'
        aria-hidden='true'
      />

      <div className='relative flex flex-wrap items-center gap-x-4 gap-y-2.5 px-4 py-3 sm:px-5'>
        <StatusPill online={props.online} loading={props.statusLoading} />

        <div
          className='bg-border hidden h-4 w-px sm:block'
          aria-hidden='true'
        />

        <div className='flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-1.5 max-sm:order-3 max-sm:basis-full'>
          {props.signals.map((signal) => {
            const Icon = signal.icon
            return (
              <div
                key={signal.key}
                className='flex min-w-0 items-center gap-1.5'
              >
                <IconBadge tone={signal.tone} size='xs'>
                  <Icon />
                </IconBadge>
                <SignalValue signal={signal} />
                <span className='text-muted-foreground truncate text-xs'>
                  {signal.label}
                </span>
              </div>
            )
          })}
        </div>

        <div className='ml-auto flex shrink-0 items-center gap-1.5 max-sm:order-2 sm:gap-2'>
          <Button size='sm' render={<Link to='/playground' />}>
            <Play data-icon='inline-start' />
            {t('Playground')}
          </Button>
          <Button variant='outline' size='sm' render={<Link to='/keys' />}>
            <KeyRound data-icon='inline-start' />
            {t('API Keys')}
          </Button>
          <Button
            variant='ghost'
            size='sm'
            className='max-sm:hidden'
            render={<Link to='/usage-logs' />}
          >
            <FileText data-icon='inline-start' />
            {t('Usage Logs')}
          </Button>
        </div>
      </div>
    </section>
  )
}
