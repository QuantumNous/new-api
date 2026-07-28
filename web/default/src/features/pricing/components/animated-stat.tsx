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
import { animate, useReducedMotion } from 'motion/react'
import { useEffect, useState } from 'react'

import { cn } from '@/lib/utils'

type AnimatedStatProps = {
  label: string
  value: number
  className?: string
  delayMs?: number
}

/**
 * Compact metric chip with a one-shot count-up when the value becomes available.
 * Respects prefers-reduced-motion.
 */
export function AnimatedStat(props: AnimatedStatProps) {
  const reduceMotion = useReducedMotion()
  const [display, setDisplay] = useState(0)

  useEffect(() => {
    const target = Math.max(0, Math.floor(props.value))
    if (reduceMotion || target === 0) {
      setDisplay(target)
      return
    }

    const controls = animate(0, target, {
      duration: 0.9,
      delay: (props.delayMs ?? 0) / 1000,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (latest) => {
        setDisplay(Math.round(latest))
      },
    })

    return () => controls.stop()
  }, [props.value, props.delayMs, reduceMotion])

  return (
    <div
      className={cn(
        'bg-muted/40 ring-border/60 inline-flex items-baseline gap-2 rounded-full px-3 py-1.5 ring-1',
        props.className
      )}
    >
      <span className='text-muted-foreground/80 text-[10px] font-medium tracking-[0.14em] uppercase'>
        {props.label}
      </span>
      <span
        className='text-foreground font-mono text-sm font-semibold tabular-nums sm:text-base'
        aria-label={`${props.label}: ${props.value}`}
      >
        {display.toLocaleString()}
      </span>
    </div>
  )
}
