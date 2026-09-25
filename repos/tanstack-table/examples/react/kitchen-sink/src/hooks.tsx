import React from 'react'

export function useSkipper() {
  const shouldSkipRef = React.useRef<boolean | null>(true)
  const shouldSkip = shouldSkipRef.current

  // Wrap a function with this to skip a pagination reset temporarily
  const skip = React.useCallback(() => {
    shouldSkipRef.current = false
  }, [])

  React.useEffect(() => {
    shouldSkipRef.current = true
  })

  const result = React.useMemo(
    () => [Boolean(shouldSkip), skip] as const,
    [shouldSkip, skip]
  )

  return result
}
