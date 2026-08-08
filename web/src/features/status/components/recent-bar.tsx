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
import { cn } from '@/lib/utils'

import type { StatusCardRecent, StatusLevel } from '../types'

type RecentBarProps = {
  recent: StatusCardRecent[]
  limit: number
}

const levelClasses: Record<StatusLevel, string> = {
  ok: 'bg-emerald-500/80 dark:bg-emerald-500/70',
  degraded: 'bg-amber-400/80 dark:bg-amber-500/70',
  fail: 'bg-red-500/80 dark:bg-red-500/70',
}

export function RecentBar({ recent, limit }: RecentBarProps) {
  const total = Math.max(1, limit)
  const slots = Array.from({ length: total }, (_, i) => recent[i])

  return (
    <div className='flex w-full items-center gap-[2px]'>
      {slots.map((slot, idx) => (
        <div
          key={idx}
          className={cn(
            'h-6 flex-1 rounded-[2px] transition-opacity',
            slot ? levelClasses[slot.level] : 'bg-muted-foreground/15'
          )}
          title={slot ? slot.level : ''}
        />
      ))}
    </div>
  )
}
