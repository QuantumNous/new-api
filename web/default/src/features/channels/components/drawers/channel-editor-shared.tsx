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
import { AlertCircle, CheckCircle2, Circle, Server } from 'lucide-react'
import type { ReactNode } from 'react'

import { IconBadge, type IconBadgeTone } from '@/components/ui/icon-badge'
import { getLobeIcon } from '@/lib/lobe-icon'
import { cn } from '@/lib/utils'

import { CHANNEL_TYPE_OPTIONS } from '../../constants'
import { getChannelTypeIcon } from '../../lib'
import type {
  ChannelEditorNavItem,
  ChannelEditorSectionStatus,
} from './channel-editor-utils'

export function CardHeading(props: {
  title: string
  icon?: ReactNode
  iconTone?: IconBadgeTone
}) {
  return (
    <div className='flex items-center gap-3'>
      {props.icon && (
        <IconBadge tone={props.iconTone} size='md'>
          {props.icon}
        </IconBadge>
      )}
      <h3 className='text-sm font-semibold tracking-tight'>{props.title}</h3>
    </div>
  )
}

export function SubHeading(props: {
  title: string
  icon?: ReactNode
  iconTone?: IconBadgeTone
}) {
  return (
    <div className='flex items-center gap-2'>
      {props.icon && (
        <IconBadge tone={props.iconTone} size='xs'>
          {props.icon}
        </IconBadge>
      )}
      <h4 className='text-muted-foreground text-xs font-medium tracking-wide uppercase'>
        {props.title}
      </h4>
    </div>
  )
}

export function ChannelTypeLogo(props: {
  type: number
  size?: number
  className?: string
}) {
  const isKnownType = CHANNEL_TYPE_OPTIONS.some(
    (option) => option.value === props.type
  )

  if (!isKnownType) {
    return (
      <Server
        className={cn('text-muted-foreground shrink-0', props.className)}
        style={{
          width: props.size ?? 16,
          height: props.size ?? 16,
        }}
        aria-hidden='true'
      />
    )
  }

  return (
    <span className={cn('inline-flex shrink-0', props.className)}>
      {getLobeIcon(`${getChannelTypeIcon(props.type)}.Color`, props.size ?? 16)}
    </span>
  )
}

function getSectionStatusIcon(status: ChannelEditorSectionStatus): ReactNode {
  if (status === 'error') {
    return <AlertCircle className='h-3.5 w-3.5' aria-hidden='true' />
  }
  if (status === 'complete' || status === 'configured') {
    return <CheckCircle2 className='h-3.5 w-3.5' aria-hidden='true' />
  }
  return <Circle className='h-3.5 w-3.5' aria-hidden='true' />
}

export function ChannelEditorNav(props: {
  providerLogo: ReactNode
  providerLabel: string
  statusLabel: string
  progressLabel: string
  navigationLabel: string
  items: ChannelEditorNavItem[]
  activeItemId?: string
  expandedItemId?: string
  onNavigate: (targetId: string) => void
}) {
  return (
    <aside className='hidden self-start lg:sticky lg:top-4 lg:z-20 lg:block'>
      <div className='flex max-h-[calc(100dvh-12rem)] flex-col gap-3 overflow-y-auto overscroll-contain pr-1'>
        <div className='border-border/60 bg-muted/20 rounded-lg border p-3'>
          <div className='flex min-w-0 items-center gap-2'>
            <span className='bg-background flex size-8 shrink-0 items-center justify-center rounded-md border'>
              {props.providerLogo}
            </span>
            <div className='min-w-0'>
              <p className='truncate text-sm font-medium'>
                {props.providerLabel}
              </p>
              <p className='text-muted-foreground truncate text-xs'>
                {props.statusLabel} · {props.progressLabel}
              </p>
            </div>
          </div>
        </div>

        <nav
          className='border-border/60 bg-background rounded-lg border p-1'
          aria-label={props.navigationLabel}
        >
          {props.items.map((item) => {
            const isError = item.status === 'error'
            const isDone =
              item.status === 'complete' || item.status === 'configured'
            const isConfigured = Boolean(item.configured)
            const isActive = props.activeItemId === item.id
            const isExpanded = props.expandedItemId === item.id
            return (
              <div key={item.id}>
                <button
                  type='button'
                  className={cn(
                    'hover:bg-muted/60 flex w-full items-start gap-2 rounded-md px-2 py-2 text-left transition-colors',
                    isActive && 'bg-muted/70',
                    isConfigured && !isError && 'text-primary',
                    isError && 'text-destructive hover:bg-destructive/10'
                  )}
                  onClick={() => props.onNavigate(item.id)}
                  aria-current={isActive ? 'true' : undefined}
                >
                  <span
                    className={cn(
                      'bg-muted text-muted-foreground mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md',
                      isConfigured && !isError && 'bg-primary/10 text-primary',
                      isError && 'bg-destructive/10 text-destructive',
                      isDone && !isError && 'text-primary'
                    )}
                  >
                    {item.icon}
                  </span>
                  <span className='min-w-0 flex-1'>
                    <span className='block truncate text-sm font-medium'>
                      {item.title}
                    </span>
                    {item.description && (
                      <span className='text-muted-foreground block truncate text-xs'>
                        {item.description}
                      </span>
                    )}
                  </span>
                  <span
                    className={cn(
                      'text-muted-foreground mt-1 shrink-0',
                      isError && 'text-destructive',
                      isDone && !isError && 'text-primary',
                      isConfigured && !isError && 'pt-1.5'
                    )}
                    aria-label={item.statusLabel}
                  >
                    {isConfigured && !isError && !isDone ? (
                      <span
                        className='bg-success block size-2 rounded-full'
                        aria-hidden='true'
                      />
                    ) : (
                      getSectionStatusIcon(item.status)
                    )}
                  </span>
                </button>
                {item.children && isExpanded && (
                  <div className='border-border/60 ml-5 flex flex-col gap-0.5 border-l py-1 pl-3'>
                    {item.children.map((child) => (
                      <button
                        key={child.id}
                        type='button'
                        className={cn(
                          'text-muted-foreground hover:bg-muted/50 hover:text-foreground flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-xs transition-colors',
                          child.configured && 'text-primary'
                        )}
                        onClick={() => props.onNavigate(child.id)}
                      >
                        <span className='min-w-0 flex-1 truncate'>
                          {child.title}
                        </span>
                        {child.configured && (
                          <span
                            className='bg-success size-1.5 shrink-0 rounded-full'
                            aria-hidden='true'
                          />
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </nav>
      </div>
    </aside>
  )
}
