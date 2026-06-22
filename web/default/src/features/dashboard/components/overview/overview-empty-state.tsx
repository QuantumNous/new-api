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
import { type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface OverviewEmptyStateProps {
  icon: LucideIcon
  title: string
  description?: string
  action?: React.ReactNode
  compact?: boolean
  dense?: boolean
  className?: string
}

export function OverviewEmptyState(props: OverviewEmptyStateProps) {
  const Icon = props.icon

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center',
        props.dense
          ? 'gap-1 px-2 py-2.5'
          : props.compact
            ? 'gap-1.5 px-3 py-4'
            : 'gap-2.5 px-5 py-8',
        props.className
      )}
    >
      <span
        className={cn(
          'flex items-center justify-center rounded-full bg-[#F3F4F6]',
          props.dense ? 'size-8' : 'size-10'
        )}
      >
        <Icon
          className={cn('text-[#9CA3AF]', props.dense ? 'size-4' : 'size-5')}
          aria-hidden='true'
        />
      </span>
      <div className={cn('max-w-xs', props.dense && 'max-w-[14rem]')}>
        <p
          className={cn(
            'font-medium text-[#374151]',
            props.dense ? 'text-[12px] leading-tight' : 'text-[13px]'
          )}
        >
          {props.title}
        </p>
        {props.description ? (
          <p
            className={cn(
              'text-[#9CA3AF]',
              props.dense
                ? 'mt-0.5 line-clamp-2 text-[11px] leading-snug'
                : 'mt-1 text-[12px] leading-relaxed'
            )}
          >
            {props.description}
          </p>
        ) : null}
      </div>
      {props.action ? (
        <div className={props.dense ? 'mt-0.5' : 'mt-1'}>{props.action}</div>
      ) : null}
    </div>
  )
}
