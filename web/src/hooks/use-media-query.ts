import { useEffect, useState } from 'react'

/**
 * React hook for responsive media queries
 * @param query - CSS media query string (e.g., "(max-width: 640px)")
 * @returns boolean indicating if the query matches
 */
export function useMediaQuery(query: string): boolean {
  const getMatches = (query: string): boolean => {
    // Check if window is available (not SSR)
    if (typeof window !== 'undefined') {
      return window.matchMedia(query).matches
    }
    return false
  }

  const [matches, setMatches] = useState<boolean>(() => getMatches(query))

  useEffect(() => {
    // Return early if window is not available
    if (typeof window === 'undefined') {
      return
    }

    const media = window.matchMedia(query)

    // Update state if initial value is different
    const handleChange = () => setMatches(media.matches)

    // Set initial value
    handleChange()

    // Listen for changes
    media.addEventListener('change', handleChange)

    return () => media.removeEventListener('change', handleChange)
  }, [query])

  return matches
}
