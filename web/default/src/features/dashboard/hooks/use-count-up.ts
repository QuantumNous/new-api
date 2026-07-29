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
import { useEffect, useRef, useState } from 'react'

interface CountUpOptions {
  duration?: number
  delay?: number
}

/**
 * Animate a numeric value from its previous state to the next target.
 * Respects prefers-reduced-motion and treats non-finite targets as 0.
 */
export function useCountUp(target: number, options?: CountUpOptions): number {
  const reduceMotion = useReducedMotion()
  const [display, setDisplay] = useState(0)
  const previousRef = useRef(0)
  const duration = options?.duration ?? 0.8
  const delay = options?.delay ?? 0

  useEffect(() => {
    const next = Number.isFinite(target) ? target : 0
    if (reduceMotion) {
      previousRef.current = next
      setDisplay(next)
      return
    }

    const controls = animate(previousRef.current, next, {
      duration,
      delay,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (latest) => setDisplay(latest),
    })
    previousRef.current = next

    return () => controls.stop()
  }, [target, duration, delay, reduceMotion])

  return display
}
