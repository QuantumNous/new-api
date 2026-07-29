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
import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

import { FadeIn } from '@/components/page-transition'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { cn } from '@/lib/utils'

interface EmptyStateProps {
  icon?: LucideIcon
  title: string
  description?: ReactNode
  action?: ReactNode
  /** Drop the dashed frame when the caller already provides a container. */
  bordered?: boolean
  className?: string
}

/**
 * The one empty-state layout for the app — the counterpart to `ErrorState`.
 * Features should reach for this instead of hand-rolling a dashed box, so the
 * icon, copy scale, spacing and fade-in stay identical everywhere.
 */
export function EmptyState(props: EmptyStateProps) {
  const Icon = props.icon
  // Mirror size classes onto FadeIn so `h-full` / `flex-1` parent chains still
  // work; keep the dashed frame + padding on Empty (rounded border lives there).
  const sizeClassName = cn('w-full', props.className)

  return (
    <FadeIn className={sizeClassName}>
      <Empty
        className={cn(
          'min-h-[220px] h-full',
          props.bordered !== false && 'border border-dashed',
          props.className
        )}
      >
        <EmptyHeader>
          {Icon && (
            <EmptyMedia variant='icon'>
              <Icon className='size-4' />
            </EmptyMedia>
          )}
          <EmptyTitle>{props.title}</EmptyTitle>
          {props.description != null && (
            <EmptyDescription>{props.description}</EmptyDescription>
          )}
        </EmptyHeader>
        {/* Truthiness, not a null check: callers commonly pass a conditional
         * like `hasFilters && <Button/>`, and an empty EmptyContent would still
         * add its gap below the copy. */}
        {props.action ? <EmptyContent>{props.action}</EmptyContent> : null}
      </Empty>
    </FadeIn>
  )
}
