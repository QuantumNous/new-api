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

export type PodiumEntry = {
  rank: number
  username: string
  /** Pre-formatted display value (e.g. quota or reward). */
  value: string
  /** Optional secondary line shown under the value. */
  subtitle?: string
  is_self?: boolean
}

type PodiumProps = {
  entries: PodiumEntry[]
}

// Visual order is silver (2nd, left, medium), gold (1st, center, tallest),
// bronze (3rd, right, short) — the classic Olympics arrangement.
const PODIUM_ORDER = [2, 1, 3] as const

const PLACE_STYLES: Record<
  number,
  {
    container: string
    block: string
    medal: string
    medalLabel: string
    height: string
    glow: string
  }
> = {
  1: {
    container: 'order-2',
    block: 'from-amber-400/90 to-amber-600/90 text-amber-950',
    medal: 'from-amber-300 to-amber-500 text-amber-900',
    medalLabel: 'bg-amber-500/20 text-amber-200 ring-amber-400/40',
    height: 'h-36 sm:h-44',
    glow: 'shadow-[0_0_60px_-15px_oklch(0.78_0.16_75_/_0.6)]',
  },
  2: {
    container: 'order-1',
    block: 'from-slate-300/90 to-slate-500/90 text-slate-900',
    medal: 'from-slate-200 to-slate-400 text-slate-700',
    medalLabel: 'bg-slate-400/20 text-slate-200 ring-slate-300/40',
    height: 'h-24 sm:h-32',
    glow: 'shadow-[0_0_45px_-18px_oklch(0.72_0.02_270_/_0.5)]',
  },
  3: {
    container: 'order-3',
    block: 'from-orange-400/90 to-orange-700/90 text-orange-50',
    medal: 'from-orange-300 to-orange-600 text-orange-900',
    medalLabel: 'bg-orange-500/20 text-orange-200 ring-orange-400/40',
    height: 'h-16 sm:h-24',
    glow: 'shadow-[0_0_40px_-18px_oklch(0.65_0.13_50_/_0.5)]',
  },
}

/**
 * Top-3 podium. Renders the three highest-ranked entries as ascending
 * blocks (silver / gold / bronze). Falls back to a compact empty state
 * when there is no data.
 */
export function Podium({ entries }: PodiumProps) {
  const { t } = useTranslation()

  if (entries.length === 0) {
    return (
      <div className='border-border/60 text-muted-foreground rounded-2xl border border-dashed px-6 py-12 text-center text-sm'>
        {t('No leaderboard data yet — be the first to claim a spot.')}
      </div>
    )
  }

  const byRank = new Map<number, PodiumEntry>()
  for (const entry of entries) {
    byRank.set(entry.rank, entry)
  }

  return (
    <div className='flex items-end justify-center gap-3 sm:gap-5'>
      {PODIUM_ORDER.map((rank) => {
        const entry = byRank.get(rank)
        const style = PLACE_STYLES[rank]
        if (!entry) {
          // Keep the layout stable even if a place is missing.
          return (
            <div
              key={rank}
              className={cn(style.container, 'flex w-1/3 max-w-[220px] flex-col')}
            >
              <div className='h-16 sm:h-20' />
              <div
                className={cn(
                  'bg-card/40 border-border/40 rounded-t-xl border border-b-0',
                  style.height
                )}
              />
            </div>
          )
        }

        return (
          <div
            key={rank}
            className={cn(
              style.container,
              'flex w-1/3 max-w-[220px] flex-col items-center'
            )}
          >
            {/* Avatar / medal + name */}
            <div className='flex flex-col items-center gap-2 pb-2'>
              <div
                className={cn(
                  'flex size-12 items-center justify-center rounded-full bg-gradient-to-br text-lg font-bold shadow-lg sm:size-14 sm:text-xl',
                  style.medal
                )}
                aria-hidden
              >
                {rank === 1 ? '1' : rank}
              </div>
              <div className='text-center'>
                <p
                  className={cn(
                    'max-w-[180px] truncate text-sm font-semibold sm:text-base',
                    entry.is_self && 'text-foreground'
                  )}
                  title={entry.username}
                >
                  {entry.username || t('Anonymous')}
                </p>
                <p className='text-foreground font-mono text-sm font-bold tabular-nums sm:text-base'>
                  {entry.value}
                </p>
                {entry.subtitle && (
                  <p className='text-muted-foreground text-[11px]'>
                    {entry.subtitle}
                  </p>
                )}
              </div>
            </div>

            {/* Podium block */}
            <div
              className={cn(
                'bg-gradient-to-b relative w-full rounded-t-xl',
                style.block,
                style.height,
                style.glow
              )}
            >
              <span
                className={cn(
                  'absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-2 py-0.5 text-[11px] font-bold ring-1',
                  style.medalLabel
                )}
              >
                {rank === 1
                  ? t('1st')
                  : rank === 2
                    ? t('2nd')
                    : t('3rd')}
              </span>
              <div className='flex h-full items-center justify-center'>
                <span className='font-mono text-2xl font-black opacity-30 sm:text-4xl'>
                  {rank}
                </span>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
