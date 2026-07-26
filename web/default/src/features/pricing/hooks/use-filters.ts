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
import { useSearch } from '@tanstack/react-router'
import { useMemo, useCallback, useState } from 'react'

import {
  FILTER_ALL,
  SORT_OPTIONS,
  QUOTA_TYPES,
  ENDPOINT_TYPES,
  DEFAULT_TOKEN_UNIT,
  DEFAULT_PRICING_CURRENCY,
  PRICING_CURRENCIES,
  VIEW_MODES,
  type PricingCurrency,
  type ViewMode,
} from '../constants'
import { filterAndSortModels, extractAllTags } from '../lib/filters'
import type { PricingModel, TokenUnit } from '../types'

type FilterState = {
  search?: string
  sort?: string
  vendor?: string
  group?: string
  quotaType?: string
  endpointType?: string
  tag?: string
  tokenUnit?: TokenUnit
  currency?: PricingCurrency
  view?: ViewMode
}

function normalizeViewMode(value: unknown): ViewMode {
  if (value === VIEW_MODES.TABLE) {
    return VIEW_MODES.TABLE
  }
  return VIEW_MODES.CARD
}

export function useFilters(models: PricingModel[]) {
  const search = useSearch({ from: '/pricing/' })
  const [filterState, setFilterState] = useState<FilterState>(() => ({
    search: search.search,
    sort: search.sort,
    vendor: search.vendor,
    group: search.group,
    quotaType: search.quotaType,
    endpointType: search.endpointType,
    tag: search.tag,
    tokenUnit: search.tokenUnit,
    currency: search.currency,
    view: search.view,
  }))

  const searchInput = filterState.search || ''
  const sortBy = filterState.sort || SORT_OPTIONS.RECOMMENDED
  const vendorFilter = filterState.vendor || FILTER_ALL
  const groupFilter = filterState.group || FILTER_ALL
  const quotaTypeFilter = filterState.quotaType || QUOTA_TYPES.ALL
  const endpointTypeFilter = filterState.endpointType || ENDPOINT_TYPES.ALL
  const tagFilter = filterState.tag || FILTER_ALL
  const tokenUnit: TokenUnit =
    filterState.tokenUnit === 'K' ? 'K' : DEFAULT_TOKEN_UNIT
  const displayCurrency: PricingCurrency =
    filterState.currency === PRICING_CURRENCIES.USD
      ? PRICING_CURRENCIES.USD
      : DEFAULT_PRICING_CURRENCY
  const viewMode = normalizeViewMode(filterState.view)

  const updateFilters = useCallback((updates: Record<string, unknown>) => {
    setFilterState((prev) => {
      const next: Record<string, unknown> = { ...prev, ...updates }
      for (const key of Object.keys(next)) {
        if (next[key] === undefined || next[key] === null) {
          delete next[key]
        }
      }
      return next as FilterState
    })
  }, [])

  const setSearchInput = useCallback(
    (v: string) => updateFilters({ search: v || undefined }),
    [updateFilters]
  )
  const setSortBy = useCallback(
    (v: string) =>
      updateFilters({
        sort: v === SORT_OPTIONS.RECOMMENDED ? undefined : v,
      }),
    [updateFilters]
  )
  const setVendorFilter = useCallback(
    (v: string) => updateFilters({ vendor: v === FILTER_ALL ? undefined : v }),
    [updateFilters]
  )
  const setGroupFilter = useCallback(
    (v: string) => updateFilters({ group: v === FILTER_ALL ? undefined : v }),
    [updateFilters]
  )
  const setQuotaTypeFilter = useCallback(
    (v: string) =>
      updateFilters({ quotaType: v === QUOTA_TYPES.ALL ? undefined : v }),
    [updateFilters]
  )
  const setEndpointTypeFilter = useCallback(
    (v: string) =>
      updateFilters({
        endpointType: v === ENDPOINT_TYPES.ALL ? undefined : v,
      }),
    [updateFilters]
  )
  const setTagFilter = useCallback(
    (v: string) => updateFilters({ tag: v === FILTER_ALL ? undefined : v }),
    [updateFilters]
  )
  const setTokenUnit = useCallback(
    (v: TokenUnit) =>
      updateFilters({ tokenUnit: v === DEFAULT_TOKEN_UNIT ? undefined : v }),
    [updateFilters]
  )
  const setDisplayCurrency = useCallback(
    (value: PricingCurrency) =>
      updateFilters({
        currency: value === DEFAULT_PRICING_CURRENCY ? undefined : value,
      }),
    [updateFilters]
  )
  const setViewMode = useCallback(
    (v: ViewMode) =>
      updateFilters({ view: v === VIEW_MODES.CARD ? undefined : v }),
    [updateFilters]
  )

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
    updateFilters({
      vendor: undefined,
      group: undefined,
      quotaType: undefined,
      endpointType: undefined,
      tag: undefined,
    })
  }, [updateFilters])

  const clearSearch = useCallback(() => {
    updateFilters({ search: undefined })
  }, [updateFilters])

  return {
    searchInput,
    sortBy,
    vendorFilter,
    groupFilter,
    quotaTypeFilter,
    endpointTypeFilter,
    tagFilter,
    tokenUnit,
    displayCurrency,
    viewMode,
    setSearchInput,
    setSortBy,
    setVendorFilter,
    setGroupFilter,
    setQuotaTypeFilter,
    setEndpointTypeFilter,
    setTagFilter,
    setTokenUnit,
    setDisplayCurrency,
    setViewMode,
    filteredModels,
    hasActiveFilters,
    activeFilterCount,
    availableTags,
    clearFilters,
    clearSearch,
  }
}
