import { useState, useCallback } from 'react'
import { FILTER_SECTIONS } from '../constants'

// ----------------------------------------------------------------------------
// UI State Hook
// ----------------------------------------------------------------------------

/**
 * Manages UI state for pricing page (section collapse, filter expansion, etc.)
 */
export function useUIState() {
  const [showMobileFilters, setShowMobileFilters] = useState(false)
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    [FILTER_SECTIONS.PRICING_TYPE]: true,
    [FILTER_SECTIONS.ENDPOINT_TYPE]: true,
    [FILTER_SECTIONS.VENDOR]: true,
    [FILTER_SECTIONS.GROUP]: true,
    [FILTER_SECTIONS.TAG]: true,
  })
  const [expandedFilters, setExpandedFilters] = useState({
    vendor: false,
    group: false,
    tag: false,
  })

  const toggleSection = useCallback((section: string) => {
    setOpenSections((prev) => ({ ...prev, [section]: !prev[section] }))
  }, [])

  const toggleExpandFilter = useCallback(
    (filterType: 'vendor' | 'group' | 'tag') => {
      setExpandedFilters((prev) => ({
        ...prev,
        [filterType]: !prev[filterType],
      }))
    },
    []
  )

  const toggleMobileFilters = useCallback(() => {
    setShowMobileFilters((prev) => !prev)
  }, [])

  const closeMobileFilters = useCallback(() => {
    setShowMobileFilters(false)
  }, [])

  return {
    showMobileFilters,
    openSections,
    expandedFilters,
    toggleSection,
    toggleExpandFilter,
    toggleMobileFilters,
    closeMobileFilters,
  }
}
