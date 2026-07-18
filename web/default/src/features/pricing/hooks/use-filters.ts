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
import { useMemo, useCallback, useState, useEffect, useRef } from 'react'
import { useSearch, useNavigate } from '@tanstack/react-router'
import {
  FILTER_ALL,
  SORT_OPTIONS,
  QUOTA_TYPES,
  ENDPOINT_TYPES,
  DEFAULT_TOKEN_UNIT,
  VIEW_MODES,
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
  view?: ViewMode
  rechargePrice?: boolean
  /** Prefer live probe/relay badges; hide cold-start mock fill. */
  liveMetricsOnly?: boolean
}

function normalizeViewMode(value: unknown): ViewMode {
  if (value === VIEW_MODES.TABLE) {
    return VIEW_MODES.TABLE
  }
  return VIEW_MODES.CARD
}

export function useFilters(models: PricingModel[]) {
  const search = useSearch({ from: '/pricing/' })
  const navigate = useNavigate({ from: '/pricing/' })
  const [filterState, setFilterState] = useState<FilterState>(() => ({
    search: search.search,
    sort: search.sort,
    vendor: search.vendor,
    group: search.group,
    quotaType: search.quotaType,
    endpointType: search.endpointType,
    tag: search.tag,
    tokenUnit: search.tokenUnit,
    view: search.view,
    rechargePrice: search.rechargePrice,
    // Default live-only so cold-start mock SLAs are not shown as real metrics.
    liveMetricsOnly:
      typeof (search as { liveMetricsOnly?: boolean }).liveMetricsOnly ===
      'boolean'
        ? (search as { liveMetricsOnly?: boolean }).liveMetricsOnly
        : true,
  }))

  // Keep URL shareable/refreshable (debounced for search typing).
  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (syncTimer.current) clearTimeout(syncTimer.current)
    syncTimer.current = setTimeout(() => {
      const next: Record<string, unknown> = {
        search: filterState.search || undefined,
        sort:
          filterState.sort && filterState.sort !== SORT_OPTIONS.NAME
            ? filterState.sort
            : undefined,
        vendor:
          filterState.vendor && filterState.vendor !== FILTER_ALL
            ? filterState.vendor
            : undefined,
        group:
          filterState.group && filterState.group !== FILTER_ALL
            ? filterState.group
            : undefined,
        quotaType:
          filterState.quotaType && filterState.quotaType !== QUOTA_TYPES.ALL
            ? filterState.quotaType
            : undefined,
        endpointType:
          filterState.endpointType &&
          filterState.endpointType !== ENDPOINT_TYPES.ALL
            ? filterState.endpointType
            : undefined,
        tag:
          filterState.tag && filterState.tag !== FILTER_ALL
            ? filterState.tag
            : undefined,
        tokenUnit:
          filterState.tokenUnit && filterState.tokenUnit !== DEFAULT_TOKEN_UNIT
            ? filterState.tokenUnit
            : undefined,
        view:
          filterState.view && filterState.view !== VIEW_MODES.CARD
            ? filterState.view
            : undefined,
        rechargePrice: filterState.rechargePrice || undefined,
        // Only put liveMetricsOnly in URL when non-default (false).
        liveMetricsOnly:
          filterState.liveMetricsOnly === false ? false : undefined,
      }
      void navigate({
        search: (prev) => {
          const cleaned = { ...prev } as Record<string, unknown>
          for (const k of Object.keys(next)) {
            if (next[k] === undefined) delete cleaned[k]
            else cleaned[k] = next[k]
          }
          // drop keys that should clear
          for (const k of [
            'search',
            'sort',
            'vendor',
            'group',
            'quotaType',
            'endpointType',
            'tag',
            'tokenUnit',
            'view',
            'rechargePrice',
            'liveMetricsOnly',
          ]) {
            if (!(k in next) || next[k] === undefined) delete cleaned[k]
            else cleaned[k] = next[k]
          }
          return cleaned as typeof prev
        },
        replace: true,
      })
    }, 200)
    return () => {
      if (syncTimer.current) clearTimeout(syncTimer.current)
    }
  }, [filterState, navigate])

  const searchInput = filterState.search || ''
  const sortBy = filterState.sort || SORT_OPTIONS.NAME
  const vendorFilter = filterState.vendor || FILTER_ALL
  const groupFilter = filterState.group || FILTER_ALL
  const quotaTypeFilter = filterState.quotaType || QUOTA_TYPES.ALL
  const endpointTypeFilter = filterState.endpointType || ENDPOINT_TYPES.ALL
  const tagFilter = filterState.tag || FILTER_ALL
  const tokenUnit: TokenUnit =
    filterState.tokenUnit === 'K' ? 'K' : DEFAULT_TOKEN_UNIT
  const viewMode = normalizeViewMode(filterState.view)
  const showRechargePrice = filterState.rechargePrice === true
  const liveMetricsOnly = filterState.liveMetricsOnly === true

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
      updateFilters({ sort: v === SORT_OPTIONS.NAME ? undefined : v }),
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
  const setViewMode = useCallback(
    (v: ViewMode) =>
      updateFilters({ view: v === VIEW_MODES.CARD ? undefined : v }),
    [updateFilters]
  )
  const setShowRechargePrice = useCallback(
    (v: boolean) => updateFilters({ rechargePrice: v || undefined }),
    [updateFilters]
  )
  const setLiveMetricsOnly = useCallback(
    (v: boolean) => updateFilters({ liveMetricsOnly: v }),
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
    viewMode,
    showRechargePrice,
    liveMetricsOnly,
    setSearchInput,
    setSortBy,
    setVendorFilter,
    setGroupFilter,
    setQuotaTypeFilter,
    setEndpointTypeFilter,
    setTagFilter,
    setTokenUnit,
    setViewMode,
    setShowRechargePrice,
    setLiveMetricsOnly,
    filteredModels,
    hasActiveFilters,
    activeFilterCount,
    availableTags,
    clearFilters,
    clearSearch,
  }
}
