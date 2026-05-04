import { useState, useEffect, useRef } from 'react'

/**
 * Ensures a loading skeleton is shown for at least `minimumTime` ms
 * to prevent flickering when data loads too quickly.
 */
export function useMinimumLoadingTime(
  loading: boolean,
  minimumTime = 1000
): boolean {
  const [showSkeleton, setShowSkeleton] = useState(loading)
  // eslint-disable-next-line react-hooks/purity
  const loadingStartRef = useRef(Date.now())

  useEffect(() => {
    if (loading) {
      loadingStartRef.current = Date.now()
      setShowSkeleton(true)
    } else {
      const elapsed = Date.now() - loadingStartRef.current
      const remaining = Math.max(0, minimumTime - elapsed)

      if (remaining === 0) {
        setShowSkeleton(false)
      } else {
        const timer = setTimeout(() => setShowSkeleton(false), remaining)
        return () => clearTimeout(timer)
      }
    }
  }, [loading, minimumTime])

  return showSkeleton
}
