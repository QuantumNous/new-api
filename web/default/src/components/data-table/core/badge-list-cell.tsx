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
import * as React from 'react'

import { StatusBadgeList } from '@/components/status-badge'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

import { BadgeListCellDisplayContext } from './badge-list-cell-context'

interface BadgeListCellProps {
  items: React.ReactNode[]
  max?: number
  tooltipClassName?: string
}

/**
 * Badge collection that stays compact in table cells and can expose every
 * item when rendered inside a detail-oriented card.
 */
export function BadgeListCell({
  items,
  max = 2,
  tooltipClassName,
}: BadgeListCellProps) {
  const display = React.useContext(BadgeListCellDisplayContext)

  if (items.length === 0) {
    return <span className='text-muted-foreground text-xs'>-</span>
  }

  if (display === 'full') {
    return (
      <StatusBadgeList
        items={items}
        max={items.length}
        renderItem={(item) => item}
        className='flex-wrap overflow-visible'
      />
    )
  }

  const showTooltip = items.length > max

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger render={<div className='max-w-full' />}>
          <StatusBadgeList
            items={items}
            max={max}
            renderItem={(item) => item}
          />
        </TooltipTrigger>
        {showTooltip && (
          <TooltipContent
            side='top'
            className={
              tooltipClassName ??
              'border-border bg-popover max-h-48 max-w-[320px] overflow-y-auto p-2'
            }
          >
            <div className='flex flex-wrap gap-1'>{items}</div>
          </TooltipContent>
        )}
      </Tooltip>
    </TooltipProvider>
  )
}
