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
import { useCallback, useRef, useState } from 'react'

export type MarqueePhase = 'idle' | 'running' | 'blinking' | 'done'

type UseMarqueeSpinOptions = {
  cellCount: number
}

type StopResolver = {
  resolve: () => void
  reject: (err: Error) => void
}

/**
 * Marquee controller:
 * - start(): begin racing the orange highlight immediately
 * - stopAt(i): decelerate and land on board cell i, then blink
 */
export function useMarqueeSpin(options: UseMarqueeSpinOptions) {
  const [phase, setPhase] = useState<MarqueePhase>('idle')
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const [blinkOn, setBlinkOn] = useState(true)

  const timersRef = useRef<number[]>([])
  const runningRef = useRef(false)
  const stoppingRef = useRef(false)
  const activeIndexRef = useRef(0)
  const cellCountRef = useRef(Math.max(1, options.cellCount))
  const stopResolverRef = useRef<StopResolver | null>(null)
  const remainingStepsRef = useRef<number | null>(null)

  cellCountRef.current = Math.max(1, options.cellCount)

  const clearTimers = useCallback(() => {
    for (const id of timersRef.current) window.clearTimeout(id)
    timersRef.current = []
  }, [])

  const reset = useCallback(() => {
    clearTimers()
    runningRef.current = false
    stoppingRef.current = false
    remainingStepsRef.current = null
    if (stopResolverRef.current) {
      stopResolverRef.current.resolve()
      stopResolverRef.current = null
    }
    setPhase('idle')
    setActiveIndex(null)
    setBlinkOn(true)
  }, [clearTimers])

  const schedule = useCallback((fn: () => void, ms: number) => {
    const id = window.setTimeout(fn, ms)
    timersRef.current.push(id)
  }, [])

  const blinkThenFinish = useCallback(() => {
    setPhase('blinking')
    let blinkCount = 0
    const blink = () => {
      if (!runningRef.current) {
        stopResolverRef.current?.resolve()
        stopResolverRef.current = null
        return
      }
      blinkCount += 1
      setBlinkOn((v) => !v)
      if (blinkCount >= 8) {
        setBlinkOn(true)
        setPhase('done')
        runningRef.current = false
        stoppingRef.current = false
        stopResolverRef.current?.resolve()
        stopResolverRef.current = null
        return
      }
      schedule(blink, 140)
    }
    schedule(blink, 120)
  }, [schedule])

  const tick = useCallback(() => {
    if (!runningRef.current) return

    const count = cellCountRef.current
    const next = (activeIndexRef.current + 1) % count
    activeIndexRef.current = next
    setActiveIndex(next)

    // Landing phase: count down remaining steps with easing
    if (stoppingRef.current && remainingStepsRef.current !== null) {
      remainingStepsRef.current -= 1
      if (remainingStepsRef.current <= 0) {
        blinkThenFinish()
        return
      }
      const left = remainingStepsRef.current
      const total = Math.max(left, 1)
      // Ease-out: slower as we approach the end
      const t = 1 - left / (left + 8)
      const delay = 45 + t * t * 280
      schedule(tick, delay)
      return
    }

    // Free-run: snappy start speed with slight jitter
    const delay = 22 + Math.random() * 12
    schedule(tick, delay)
  }, [blinkThenFinish, schedule])

  const start = useCallback(() => {
    clearTimers()
    if (stopResolverRef.current) {
      stopResolverRef.current.resolve()
      stopResolverRef.current = null
    }
    runningRef.current = true
    stoppingRef.current = false
    remainingStepsRef.current = null
    setPhase('running')
    setBlinkOn(true)
    // Kick off from a random cell so it feels alive immediately
    const count = cellCountRef.current
    const startAt = Math.floor(Math.random() * count)
    activeIndexRef.current = startAt
    setActiveIndex(startAt)
    schedule(tick, 16)
  }, [clearTimers, schedule, tick])

  const stopAt = useCallback(
    (targetIndex: number) => {
      const count = cellCountRef.current
      const safeIndex = ((targetIndex % count) + count) % count

      if (!runningRef.current) {
        // Not spinning (e.g. reduced path) — jump + blink
        runningRef.current = true
        activeIndexRef.current = safeIndex
        setActiveIndex(safeIndex)
        setPhase('running')
        return new Promise<void>((resolve, reject) => {
          stopResolverRef.current = { resolve, reject }
          stoppingRef.current = true
          // At least 1.5 laps then land
          const laps = 2
          const cur = activeIndexRef.current
          const dist = laps * count + ((safeIndex - cur + count) % count)
          remainingStepsRef.current = Math.max(count, dist)
          schedule(tick, 40)
        })
      }

      return new Promise<void>((resolve, reject) => {
        stopResolverRef.current = { resolve, reject }
        stoppingRef.current = true
        const cur = activeIndexRef.current
        // Extra laps after stop signal so deceleration is visible
        const laps = 2 + Math.floor(Math.random() * 2)
        const dist = laps * count + ((safeIndex - cur + count) % count)
        remainingStepsRef.current = Math.max(count + 4, dist)
      })
    },
    [schedule, tick]
  )

  /** Convenience: start + stopAt in one call (waits for API beforehand). */
  const spinTo = useCallback(
    async (targetIndex: number) => {
      start()
      // Brief free-spin so the ring is clearly moving before we aim
      await new Promise<void>((r) => schedule(r, 600))
      await stopAt(targetIndex)
    },
    [schedule, start, stopAt]
  )

  return {
    phase,
    activeIndex,
    blinkOn,
    spinning: phase === 'running' || phase === 'blinking',
    start,
    stopAt,
    spinTo,
    reset,
  }
}
