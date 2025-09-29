import { useCallback, useEffect, useRef, useState } from 'react'

export interface UseCountdownOptions {
  initialSeconds?: number
  autoStart?: boolean
}

export function useCountdown(options: UseCountdownOptions = {}) {
  const { initialSeconds = 30, autoStart = false } = options
  const [secondsLeft, setSecondsLeft] = useState<number>(initialSeconds)
  const [isActive, setIsActive] = useState<boolean>(autoStart)
  const timerRef = useRef<number | null>(null)

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const stop = useCallback(() => {
    clearTimer()
    setIsActive(false)
  }, [clearTimer])

  const start = useCallback(
    (seconds?: number) => {
      const total = seconds ?? initialSeconds
      setSecondsLeft(total)
      setIsActive(true)
      clearTimer()
      timerRef.current = window.setInterval(() => {
        setSecondsLeft((s) => {
          if (s <= 1) {
            clearTimer()
            setIsActive(false)
            return initialSeconds
          }
          return s - 1
        })
      }, 1000)
    },
    [clearTimer, initialSeconds]
  )

  const reset = useCallback(() => {
    stop()
    setSecondsLeft(initialSeconds)
  }, [initialSeconds, stop])

  useEffect(() => {
    return () => clearTimer()
  }, [clearTimer])

  return { secondsLeft, isActive, start, stop, reset }
}
