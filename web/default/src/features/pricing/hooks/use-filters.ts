import { useMemo, useCallback } from 'react'
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

type PricingNavigatePath = '/pricing'

function firstString(value: unknown): string | undefined {
  if (typeof value === 'string') return value
  if (Array.isArray(value) && typeof value[0] === 'string') return value[0]
  return undefined
}

export function useFilters(
  models: PricingModel[],
  routeTo: PricingNavigatePath = '/pricing'
) {
  const search = useSearch({ strict: false })
  const navigate = useNavigate()

  const searchInput = firstString(search.search) || ''
  const sortBy = firstString(search.sort) || SORT_OPTIONS.NAME
  const vendorFilter = firstString(search.vendor) || FILTER_ALL
  const groupFilter = firstString(search.group) || FILTER_ALL
  const quotaTypeFilter = firstString(search.quotaType) || QUOTA_TYPES.ALL
  const endpointTypeFilter =
    firstString(search.endpointType) || ENDPOINT_TYPES.ALL
  const tagFilter = firstString(search.tag) || FILTER_ALL
  const tokenUnit: TokenUnit =
    firstString(search.tokenUnit) === 'K' ? 'K' : DEFAULT_TOKEN_UNIT
  const viewMode: ViewMode =
    firstString(search.view) === 'table' ? VIEW_MODES.TABLE : VIEW_MODES.LIST
  const showRechargePrice = search.rechargePrice === true

  const updateSearch = useCallback(
    (updates: Record<string, unknown>) => {
      navigate({
        to: routeTo,
        search: () => {
          const next = {
            search: searchInput || undefined,
            sort: sortBy === SORT_OPTIONS.NAME ? undefined : sortBy,
            vendor: vendorFilter === FILTER_ALL ? undefined : vendorFilter,
            group: groupFilter === FILTER_ALL ? undefined : groupFilter,
            quotaType:
              quotaTypeFilter === QUOTA_TYPES.ALL ? undefined : quotaTypeFilter,
            endpointType:
              endpointTypeFilter === ENDPOINT_TYPES.ALL
                ? undefined
                : endpointTypeFilter,
            tag: tagFilter === FILTER_ALL ? undefined : tagFilter,
            tokenUnit: tokenUnit === DEFAULT_TOKEN_UNIT ? undefined : tokenUnit,
            view: viewMode === VIEW_MODES.LIST ? undefined : viewMode,
            rechargePrice: showRechargePrice || undefined,
            ...updates,
          }
          Object.keys(next).forEach((key) => {
            const typedKey = key as keyof typeof next
            if (next[typedKey] === undefined || next[typedKey] === null) {
              delete next[typedKey]
            }
          })
          return next
        },
        replace: true,
      })
    },
    [
      endpointTypeFilter,
      groupFilter,
      navigate,
      quotaTypeFilter,
      routeTo,
      searchInput,
      showRechargePrice,
      sortBy,
      tagFilter,
      tokenUnit,
      vendorFilter,
      viewMode,
    ]
  )

  const setSearchInput = useCallback(
    (v: string) => updateSearch({ search: v || undefined }),
    [updateSearch]
  )
  const setSortBy = useCallback(
    (v: string) =>
      updateSearch({ sort: v === SORT_OPTIONS.NAME ? undefined : v }),
    [updateSearch]
  )
  const setVendorFilter = useCallback(
    (v: string) => updateSearch({ vendor: v === FILTER_ALL ? undefined : v }),
    [updateSearch]
  )
  const setGroupFilter = useCallback(
    (v: string) => updateSearch({ group: v === FILTER_ALL ? undefined : v }),
    [updateSearch]
  )
  const setQuotaTypeFilter = useCallback(
    (v: string) =>
      updateSearch({ quotaType: v === QUOTA_TYPES.ALL ? undefined : v }),
    [updateSearch]
  )
  const setEndpointTypeFilter = useCallback(
    (v: string) =>
      updateSearch({
        endpointType: v === ENDPOINT_TYPES.ALL ? undefined : v,
      }),
    [updateSearch]
  )
  const setTagFilter = useCallback(
    (v: string) => updateSearch({ tag: v === FILTER_ALL ? undefined : v }),
    [updateSearch]
  )
  const setTokenUnit = useCallback(
    (v: TokenUnit) =>
      updateSearch({ tokenUnit: v === DEFAULT_TOKEN_UNIT ? undefined : v }),
    [updateSearch]
  )
  const setViewMode = useCallback(
    (v: ViewMode) =>
      updateSearch({ view: v === VIEW_MODES.LIST ? undefined : v }),
    [updateSearch]
  )
  const setShowRechargePrice = useCallback(
    (v: boolean) => updateSearch({ rechargePrice: v || undefined }),
    [updateSearch]
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
    updateSearch({
      vendor: undefined,
      group: undefined,
      quotaType: undefined,
      endpointType: undefined,
      tag: undefined,
    })
  }, [updateSearch])

  const clearSearch = useCallback(() => {
    updateSearch({ search: undefined })
  }, [updateSearch])

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
    filteredModels,
    hasActiveFilters,
    activeFilterCount,
    availableTags,
    clearFilters,
    clearSearch,
  }
}
