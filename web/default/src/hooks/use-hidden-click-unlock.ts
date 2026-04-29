import { useCallback, useRef, useState } from 'react'

type HiddenClickUnlockOptions = {
  requiredClicks?: number
  disabled?: boolean
  onUnlock?: () => void
}

type HiddenClickUnlockResult = {
  unlocked: boolean
  handleClick: () => void
  reset: () => void
}

/** Unlock hidden UI after a repeated click gesture. */
export function useHiddenClickUnlock(
  options: HiddenClickUnlockOptions = {}
): HiddenClickUnlockResult {
  const disabled = options.disabled ?? false
  const requiredClicks = options.requiredClicks ?? 3
  const onUnlock = options.onUnlock
  const clickCountRef = useRef(0)
  const [unlocked, setUnlocked] = useState(false)

  const reset = useCallback((): void => {
    clickCountRef.current = 0
    setUnlocked(false)
  }, [])

  const handleClick = useCallback((): void => {
    if (disabled || unlocked) return

    const nextClickCount = clickCountRef.current + 1
    clickCountRef.current = nextClickCount

    if (nextClickCount >= requiredClicks) {
      clickCountRef.current = 0
      setUnlocked(true)
      onUnlock?.()
    }
  }, [disabled, onUnlock, requiredClicks, unlocked])

  return {
    unlocked,
    handleClick,
    reset,
  }
}
