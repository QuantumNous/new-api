import { useState, useMemo, useCallback } from 'react'
import {
  FILTER_ALL,
  SORT_OPTIONS,
  QUOTA_TYPES,
  ENDPOINT_TYPES,
} from '../constants'
import { filterAndSortModels, extractAllTags } from '../lib/filters'
import type { PricingModel } from '../types'

// ----------------------------------------------------------------------------
// Filter Hook
// ----------------------------------------------------------------------------

export interface UseFiltersOptions {
  models: PricingModel[]
  initialSearch?: string
  initialSort?: string
  initialVendor?: string
  initialGroup?: string
  initialQuotaType?: string
  initialEndpointType?: string
  initialTag?: string
}

export function useFilters({
  models,
  initialSearch = '',
  initialSort = SORT_OPTIONS.NAME,
  initialVendor = FILTER_ALL,
  initialGroup = FILTER_ALL,
  initialQuotaType = QUOTA_TYPES.ALL,
  initialEndpointType = ENDPOINT_TYPES.ALL,
  initialTag = FILTER_ALL,
}: UseFiltersOptions) {
  const [searchInput, setSearchInput] = useState(initialSearch)
  const [sortBy, setSortBy] = useState<string>(initialSort)
  const [vendorFilter, setVendorFilter] = useState<string>(initialVendor)
  const [groupFilter, setGroupFilter] = useState<string>(initialGroup)
  const [quotaTypeFilter, setQuotaTypeFilter] =
    useState<string>(initialQuotaType)
  const [endpointTypeFilter, setEndpointTypeFilter] =
    useState<string>(initialEndpointType)
  const [tagFilter, setTagFilter] = useState<string>(initialTag)

  const availableTags = useMemo(() => {
    if (!models || models.length === 0) return []
    return extractAllTags(models)
  }, [models])

  const filteredModels = useMemo(() => {
    if (!models || models.length === 0) return []

    return filterAndSortModels(models, {
      search: searchInput,
      vendor: vendorFilter,
      group: groupFilter,
      quotaType: quotaTypeFilter,
      endpointType: endpointTypeFilter,
      tag: tagFilter,
      sortBy,
    })
  }, [
    models,
    searchInput,
    vendorFilter,
    groupFilter,
    quotaTypeFilter,
    endpointTypeFilter,
    tagFilter,
    sortBy,
  ])

  const hasActiveFilters = useMemo(
    () =>
      vendorFilter !== FILTER_ALL ||
      groupFilter !== FILTER_ALL ||
      quotaTypeFilter !== QUOTA_TYPES.ALL ||
      endpointTypeFilter !== ENDPOINT_TYPES.ALL ||
      tagFilter !== FILTER_ALL,
    [vendorFilter, groupFilter, quotaTypeFilter, endpointTypeFilter, tagFilter]
  )

  const activeFilterCount = useMemo(
    () =>
      (vendorFilter !== FILTER_ALL ? 1 : 0) +
      (groupFilter !== FILTER_ALL ? 1 : 0) +
      (quotaTypeFilter !== QUOTA_TYPES.ALL ? 1 : 0) +
      (endpointTypeFilter !== ENDPOINT_TYPES.ALL ? 1 : 0) +
      (tagFilter !== FILTER_ALL ? 1 : 0),
    [vendorFilter, groupFilter, quotaTypeFilter, endpointTypeFilter, tagFilter]
  )

  const clearFilters = useCallback(() => {
    setVendorFilter(FILTER_ALL)
    setGroupFilter(FILTER_ALL)
    setQuotaTypeFilter(QUOTA_TYPES.ALL)
    setEndpointTypeFilter(ENDPOINT_TYPES.ALL)
    setTagFilter(FILTER_ALL)
  }, [])

  const clearSearch = useCallback(() => {
    setSearchInput('')
  }, [])

  return {
    // State
    searchInput,
    sortBy,
    vendorFilter,
    groupFilter,
    quotaTypeFilter,
    endpointTypeFilter,
    tagFilter,
    // Setters
    setSearchInput,
    setSortBy,
    setVendorFilter,
    setGroupFilter,
    setQuotaTypeFilter,
    setEndpointTypeFilter,
    setTagFilter,
    // Computed
    filteredModels,
    hasActiveFilters,
    activeFilterCount,
    availableTags,
    // Actions
    clearFilters,
    clearSearch,
  }
}
