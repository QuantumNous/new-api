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
import type { ReactNode } from 'react'

import { IconBadge, type IconBadgeTone } from '@/components/ui/icon-badge'
import { cn } from '@/lib/utils'

export type ErrorPageAction = {
  label: string
  onClick?: () => void
  href?: string
  variant?: 'default' | 'outline'
}

export type ErrorPageProps = {
  code: string
  title: string
  description: ReactNode
  icon: ReactNode
  iconTone?: IconBadgeTone
  actions?: ReactNode
  /** Compact variant for in-page errors (no hero code or icon). */
  minimal?: boolean
  className?: string
}

/**
 * Shared layout for all full-screen error pages (404/403/401/503/500/429).
 * Individual pages only supply code, copy, icon and actions.
 */
export function ErrorPage(props: ErrorPageProps) {
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
        'flex min-h-svh w-full flex-col items-center justify-center gap-4 px-4 py-10 text-center',
        props.className
      )}
    >
      <IconBadge tone={props.iconTone ?? 'neutral'} size='lg'>
        {props.icon}
      </IconBadge>
      <h1 className='text-6xl font-bold tracking-tight tabular-nums sm:text-7xl'>
        {props.code}
      </h1>
      <p className='text-lg font-semibold tracking-tight'>{props.title}</p>
      <div className='text-muted-foreground max-w-md text-sm text-pretty sm:text-base'>
        {props.description}
      </div>
      {props.actions ? (
        <div className='mt-4 flex flex-wrap items-center justify-center gap-3'>
          {props.actions}
        </div>
      ) : null}
    </div>
  )
}
