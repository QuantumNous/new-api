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
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/utils'

export type UsageListEntry = {
  rank: number
  username: string
  /** Pre-formatted display value. */
  value: string
  /** Optional secondary line shown on the right. */
  subtitle?: string
  is_self?: boolean
}

type UsageListProps = {
  entries: UsageListEntry[]
}

/**
 * Ranked list for entries beyond the podium (rank 4+). Compact rows with
 * rank · username · value. The current user's own row is highlighted.
 */
export function UsageList({ entries }: UsageListProps) {
  const { t } = useTranslation()

  if (entries.length === 0) return null

  return (
    <ol className='divide-border/60 divide-y'>
      {entries.map((entry) => (
        <li
          key={`${entry.rank}-${entry.username}`}
          className={cn(
            'flex items-center gap-3 px-2 py-2.5 transition-colors sm:px-3',
            entry.is_self && 'bg-primary/5 rounded-lg'
          )}
        >
          <span
            className={cn(
              'w-7 shrink-0 text-right font-mono text-sm tabular-nums',
              entry.is_self
                ? 'text-foreground font-bold'
                : 'text-muted-foreground/80'
            )}
          >
            {entry.rank}
          </span>
          <span
            className={cn(
              'min-w-0 flex-1 truncate text-sm font-medium',
              entry.is_self ? 'text-foreground' : 'text-foreground/90'
            )}
            title={entry.username}
          >
            {entry.username}
            {entry.is_self && (
              <span className='text-muted-foreground ms-2 text-[11px]'>
                ({t('You')})
              </span>
            )}
          </span>
          {entry.subtitle && (
            <span className='text-muted-foreground/80 hidden text-xs sm:inline'>
              {entry.subtitle}
            </span>
          )}
          <span className='text-foreground shrink-0 font-mono text-sm font-semibold tabular-nums'>
            {entry.value}
          </span>
        </li>
      ))}
    </ol>
  )
}
