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
import { GripVertical, MousePointer2 } from 'lucide-react'
import { motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { DataTableViewMode } from '@/components/data-table'
import { Badge } from '@/components/ui/badge'
import { useMediaQuery } from '@/hooks/use-media-query'
import { toIntlLocale } from '@/i18n/languages'
import { formatNumber } from '@/lib/format'
import { cn } from '@/lib/utils'

const frames = [
  { at: 0, phase: 'ready', lifted: false },
  { at: 700, phase: 'lift', lifted: true },
  { at: 1500, phase: 'target', lifted: true },
  { at: 3000, phase: 'done', lifted: false },
] as const

export function ChannelPriorityDemo(props: {
  viewMode: DataTableViewMode
  mode: 'same' | 'insert'
  playing: boolean
  onComplete: () => void
}) {
  const { t, i18n } = useTranslation()
  const reduced = useMediaQuery('(prefers-reduced-motion: reduce)')
  const [frame, setFrame] = useState(0)
  const elapsed = useRef(0)
  const current = frames[reduced ? frames.length - 1 : frame]
  const same = props.mode === 'same'
  const reached = current.phase === 'target' || current.phase === 'done'
  const between = !same && reached
  const result = same ? 80 : 90
  const card = props.viewMode === 'card'
  const reorder = between && (card || current.phase === 'done')
  const order = reorder ? ['A', 'C', 'B'] : ['A', 'B', 'C']
  let pointerY = 150
  if (reached) pointerY = same ? 92 : 66
  const locale = toIntlLocale(i18n.resolvedLanguage || i18n.language)
  let instruction = t('Drag the handle to move a channel.')
  if (current.phase === 'target') {
    instruction = same
      ? t('Release to join priority {{priority}}', {
          priority: formatNumber(result, locale),
        })
      : t('Release to insert a new priority tier')
  } else if (current.phase === 'done') {
    instruction = t('New priority: {{priority}}', {
      priority: formatNumber(result, locale),
    })
  }

  useEffect(() => {
    if (reduced || !props.playing) return
    const started = performance.now()
    const timers = frames
      .map((item, index) => ({ ...item, index }))
      .filter((item) => item.at > elapsed.current)
      .map((item) =>
        window.setTimeout(() => setFrame(item.index), item.at - elapsed.current)
      )
    // Keep the completed result visible before starting the next named demo.
    timers.push(window.setTimeout(props.onComplete, 5200 - elapsed.current))
    return () => {
      elapsed.current += performance.now() - started
      timers.forEach(window.clearTimeout)
    }
  }, [props.playing, props.onComplete, reduced])

  return (
    <div>
      <div
        className={cn(
          'mb-3 grid gap-1.5 rounded-lg border p-3',
          same
            ? 'border-primary/30 bg-primary/5'
            : 'border-amber-500/40 bg-amber-500/5'
        )}
      >
        <p className='text-sm font-medium'>
          {same
            ? t('Drop in the center to use the same priority.')
            : t('Drop at an edge to create a different priority.')}
        </p>
        <p className='text-muted-foreground text-xs tabular-nums'>
          {t('Priority')} {formatNumber(0, locale)} →{' '}
          {formatNumber(result, locale)}
        </p>
      </div>
      <ol
        aria-label={card ? t('Card view') : t('Table view')}
        className={cn(
          'bg-muted/30 relative m-0 list-none overflow-hidden rounded-xl border p-0',
          card ? 'h-60' : 'h-52'
        )}
      >
        {!card && current.lifted && (
          <>
            <li
              aria-hidden
              role='presentation'
              className='absolute inset-x-3 top-35 h-13 rounded-lg border border-dashed opacity-30'
            />
            <motion.li
              aria-hidden
              role='presentation'
              animate={{ y: pointerY }}
              transition={{ duration: reduced ? 0 : 0.6 }}
              className='absolute top-3 left-6 z-30'
            >
              <MousePointer2 className='fill-primary text-primary-foreground size-5 drop-shadow' />
            </motion.li>
          </>
        )}
        {between && (
          <li
            aria-hidden
            role='presentation'
            className={cn(
              'absolute z-20 rounded-full bg-amber-500',
              card
                ? 'top-3 left-1/2 h-24 w-0.5'
                : 'inset-x-3 top-[4.5rem] h-0.5'
            )}
          />
        )}
        {order.map((name, index) => {
          const lifted = name === 'C' && current.lifted
          const peer = same && reached && name !== 'A'
          const target = name === 'B' && current.phase !== 'done'
          let priority = name === 'A' ? 100 : 80
          if (name === 'C') priority = reached ? result : 0
          let y = index * 64
          if (lifted && !card) y = reached ? 20 : 96
          let x: number | string = lifted ? 6 : 0
          if (card) {
            let column = index % 2
            y = Math.floor(index / 2) * 108
            if (lifted && same && reached) {
              column = 1
              y = 24
            }
            x = `calc(${column * 100}% + ${column * 12 + (lifted ? 4 : 0)}px)`
          }
          let layout = 'right-3 h-13 items-center gap-2 px-3'
          if (card) {
            layout =
              'h-24 w-[calc(50%-1.125rem)] flex-col items-start justify-between p-3'
          } else if (lifted) {
            layout = 'right-6 left-auto h-9 w-[60%] items-center gap-2 px-2'
          }
          return (
            <motion.li
              key={name}
              initial={false}
              animate={{ y, x, scale: lifted ? 1.015 : 1 }}
              transition={{
                duration: reduced ? 0 : 0.6,
                ease: [0.22, 1, 0.36, 1],
              }}
              className={cn(
                'bg-background absolute top-3 left-3 flex min-w-0 rounded-lg border',
                layout,
                peer && 'border-primary bg-primary/5',
                target && same && 'border-primary',
                target && !same && 'border-amber-500',
                lifted && 'bg-background z-10 shadow-lg',
                lifted && same && 'border-primary',
                name === 'C' &&
                  !same &&
                  (lifted || reached) &&
                  'border-amber-500'
              )}
            >
              {target && (
                <span
                  aria-hidden
                  className={cn(
                    'pointer-events-none absolute',
                    same
                      ? 'border-primary/60 bg-primary/10'
                      : 'border-amber-500/60 bg-amber-500/10',
                    card &&
                      same &&
                      'inset-y-0 inset-x-6 border-x border-dashed',
                    card &&
                      !same &&
                      'inset-y-0 left-0 w-6 border-r border-dashed',
                    !card &&
                      same &&
                      'inset-x-0 inset-y-2 border-y border-dashed',
                    !card &&
                      !same &&
                      'inset-x-0 top-0 h-2 border-b border-dashed'
                  )}
                />
              )}
              <div className='relative flex min-w-0 items-center gap-2'>
                <span
                  className='text-muted-foreground relative shrink-0'
                  aria-hidden
                >
                  <GripVertical
                    className={cn('size-4', lifted && 'text-primary')}
                  />
                </span>
                <span className='min-w-0 truncate text-sm font-medium'>
                  {t('Channel {{name}}', { name })}
                </span>
              </div>
              <Badge
                variant='outline'
                className={cn(
                  'relative shrink-0 tabular-nums',
                  !card && 'ml-auto',
                  peer && 'border-primary/30 text-primary'
                )}
              >
                {t('Priority')} {formatNumber(priority, locale)}
              </Badge>
              {lifted && card && (
                <MousePointer2
                  aria-hidden
                  className={cn(
                    'fill-primary text-primary-foreground absolute top-1/2 size-5 drop-shadow',
                    same && reached ? 'left-1/2' : '-left-2'
                  )}
                />
              )}
            </motion.li>
          )
        })}
      </ol>
      <p
        role='status'
        className='text-muted-foreground mt-3 min-h-5 text-sm leading-5'
      >
        {instruction}
      </p>
    </div>
  )
}
