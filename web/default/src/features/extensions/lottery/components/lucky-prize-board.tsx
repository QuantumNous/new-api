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
import { Gift, Sparkles, Star } from 'lucide-react'
import {
  forwardRef,
  useImperativeHandle,
  useMemo,
} from 'react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/utils'

import type { MarqueePhase } from '../hooks/use-marquee-spin'
import type { PrizeGridSlot } from '../lib/grid-layout'
import type { LotterySymbol } from '../types'

export type LuckyPrizeBoardHandle = {
  /** no-op kept for API compatibility; parent drives animation via props */
  play: () => void
  stop: (index: number) => void
}

type LuckyPrizeBoardProps = {
  symbols: LotterySymbol[]
  rows: number
  cols: number
  slots: PrizeGridSlot[]
  crazyThursday: boolean
  canDraw: boolean
  drawing: boolean
  /** Active board cell index for marquee highlight. */
  activeIndex: number | null
  blinkOn: boolean
  phase: MarqueePhase
  onRequestStart: () => void
}

function toneVisual(tone: LotterySymbol['tone']) {
  if (tone === 'jackpot') {
    return {
      cell: 'from-[#FFF7D6] via-[#FBBF24] to-[#D97706] text-amber-950',
      icon: <Star className='h-5 w-5 fill-amber-100 text-amber-100 sm:h-6 sm:w-6' />,
      iconBg: 'bg-amber-700/30',
    }
  }
  if (tone === 'win') {
    return {
      cell: 'from-[#FFFBEB] via-[#FDE68A] to-[#F59E0B] text-amber-950',
      icon: <Sparkles className='h-5 w-5 text-amber-800 sm:h-6 sm:w-6' />,
      iconBg: 'bg-amber-900/10',
    }
  }
  if (tone === 'lose') {
    return {
      cell: 'from-[#FFF1F2] via-[#FECDD3] to-[#FB7185] text-rose-950',
      icon: <span className='text-base font-black text-rose-700 sm:text-lg'>−</span>,
      iconBg: 'bg-rose-900/10',
    }
  }
  return {
    cell: 'from-[#FAFAFA] via-[#F4F4F5] to-[#D4D4D8] text-zinc-800',
    icon: <span className='text-sm font-black text-zinc-500 sm:text-base'>∅</span>,
    iconBg: 'bg-zinc-900/10',
  }
}

export const LuckyPrizeBoard = forwardRef<
  LuckyPrizeBoardHandle,
  LuckyPrizeBoardProps
>(function LuckyPrizeBoard(props, ref) {
  const { t } = useTranslation()

  useImperativeHandle(ref, () => ({
    play: () => {},
    stop: () => {},
  }))

  const hasCenter = props.rows >= 3 && props.cols >= 3
  const selected =
    props.activeIndex !== null &&
    (props.phase === 'running' ||
      props.phase === 'blinking' ||
      props.phase === 'done') &&
    (props.phase !== 'blinking' || props.blinkOn)

  const centerLabel = useMemo(() => {
    if (props.drawing || props.phase === 'running') return t('SPINNING')
    if (!props.canDraw) return t('Already spun today')
    return t('SPIN')
  }, [props.canDraw, props.drawing, props.phase, t])

  return (
    <div className='relative mx-auto w-full max-w-3xl'>
      <div className='pointer-events-none absolute -inset-4 rounded-[40px] bg-[radial-gradient(circle_at_50%_0%,rgba(251,146,60,0.4),transparent_55%)] blur-md' />

      <div
        className={cn(
          'relative overflow-hidden rounded-[36px] p-[4px] shadow-2xl',
          props.crazyThursday
            ? 'bg-[linear-gradient(135deg,#FBBF24,#F59E0B,#EA580C,#FBBF24)]'
            : 'bg-[linear-gradient(135deg,#FB7185,#EF4444,#B91C1C,#F97316)]'
        )}
      >
        <div
          className={cn(
            'rounded-[32px] px-4 py-5 sm:px-6 sm:py-6',
            props.crazyThursday
              ? 'bg-[radial-gradient(circle_at_top,#78350F_0%,#1c0a04_60%,#0c0502_100%)]'
              : 'bg-[radial-gradient(circle_at_top,#7F1D1D_0%,#1a0508_60%,#0a0304_100%)]'
          )}
        >
          <div className='mb-4 flex items-center justify-center gap-2'>
            {Array.from({ length: 13 }).map((_, i) => (
              <span
                key={i}
                className={cn(
                  'h-2.5 w-2.5 rounded-full shadow-[0_0_8px_currentColor] sm:h-3 sm:w-3',
                  props.crazyThursday ? 'bg-amber-300' : 'bg-rose-300',
                  (props.drawing || props.phase === 'running') &&
                    'animate-pulse'
                )}
                style={{ animationDelay: `${i * 70}ms` }}
              />
            ))}
          </div>

          <div
            className='relative mx-auto grid gap-2 sm:gap-3'
            style={{
              gridTemplateColumns: `repeat(${props.cols}, minmax(0, 1fr))`,
              gridTemplateRows: `repeat(${props.rows}, minmax(0, 1fr))`,
            }}
          >
            {props.slots.map((slot) => {
              const symbol = props.symbols[slot.prizeIndex]
              if (!symbol) return null
              const visual = toneVisual(symbol.tone)
              const isActive =
                selected && props.activeIndex === slot.cellIndex

              return (
                <div
                  key={`cell-${slot.cellIndex}`}
                  className={cn(
                    'relative aspect-square rounded-2xl p-[3px] transition-transform duration-75',
                    isActive
                      ? 'z-10 scale-[1.08] bg-[linear-gradient(145deg,#FDBA74,#F97316,#FBBF24)] shadow-[0_0_0_4px_rgba(251,146,60,0.95),0_0_32px_rgba(249,115,22,0.9)] ring-2 ring-orange-300'
                      : 'bg-white/20'
                  )}
                  style={{
                    gridRow: slot.row + 1,
                    gridColumn: slot.col + 1,
                  }}
                >
                  <div
                    className={cn(
                      'flex h-full flex-col items-center justify-center rounded-[13px] bg-gradient-to-b px-1.5 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.55)] sm:px-2',
                      visual.cell
                    )}
                  >
                    <div
                      className={cn(
                        'mb-1 flex h-8 w-8 items-center justify-center rounded-full sm:h-9 sm:w-9',
                        visual.iconBg
                      )}
                    >
                      {visual.icon}
                    </div>
                    <span className='line-clamp-2 text-xs font-extrabold leading-tight sm:text-sm'>
                      {symbol.name}
                    </span>
                    <span className='mt-0.5 text-[11px] font-semibold opacity-80 sm:text-xs'>
                      {symbol.label}
                    </span>
                  </div>
                </div>
              )
            })}

            {hasCenter ? (
              <button
                type='button'
                disabled={!props.canDraw || props.drawing}
                onClick={() => {
                  if (!props.canDraw || props.drawing) return
                  props.onRequestStart()
                }}
                className={cn(
                  'relative flex flex-col items-center justify-center rounded-3xl p-[3px] transition enabled:hover:brightness-110 enabled:active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-80',
                  props.crazyThursday
                    ? 'bg-[linear-gradient(160deg,#FDE68A,#F59E0B,#EA580C)]'
                    : 'bg-[linear-gradient(160deg,#FDA4AF,#EF4444,#9F1239)]'
                )}
                style={{
                  gridRow: `2 / ${props.rows}`,
                  gridColumn: `2 / ${props.cols}`,
                }}
              >
                <div className='flex h-full w-full flex-col items-center justify-center rounded-[21px] bg-[radial-gradient(circle_at_30%_20%,#3f1d1d_0%,#1a0a0a_65%,#0d0505_100%)] px-3 text-center shadow-[inset_0_0_28px_rgba(0,0,0,0.45)] sm:px-4'>
                  <div
                    className={cn(
                      'mb-3 flex h-20 w-20 items-center justify-center rounded-3xl text-white sm:h-24 sm:w-24',
                      props.crazyThursday
                        ? 'bg-[linear-gradient(145deg,#FBBF24,#EA580C)]'
                        : 'bg-[linear-gradient(145deg,#FB7185,#DC2626)]',
                      'shadow-[0_8px_22px_rgba(220,38,38,0.45),inset_0_1px_0_rgba(255,255,255,0.35)]',
                      props.phase === 'running' && 'animate-pulse'
                    )}
                  >
                    {props.crazyThursday ? (
                      <Sparkles className='h-10 w-10 sm:h-12 sm:w-12' />
                    ) : (
                      <Gift className='h-10 w-10 sm:h-12 sm:w-12' />
                    )}
                  </div>
                  <div className='bg-gradient-to-b from-orange-100 to-amber-300 bg-clip-text text-lg font-black tracking-wide text-transparent sm:text-xl'>
                    {centerLabel}
                  </div>
                  <div className='mt-1.5 text-xs text-orange-100/70 sm:text-sm'>
                    {props.phase === 'running'
                      ? t('Spinning...')
                      : props.canDraw
                        ? t('Tap the button below to draw')
                        : t('Result')}
                  </div>
                </div>
              </button>
            ) : null}
          </div>

          <p className='mt-4 text-center text-xs tracking-wide text-orange-100/65 sm:text-sm'>
            {props.crazyThursday
              ? t('Crazy Thursday!')
              : t('Lucky Slot Lottery')}
          </p>
        </div>
      </div>
    </div>
  )
})
