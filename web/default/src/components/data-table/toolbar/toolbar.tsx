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
import type { Table } from '@tanstack/react-table'
import * as React from 'react'
import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { Input } from '@/components/design-system/input'
import { useDebounce } from '@/hooks'

import { DataTableFacetedFilter } from './faceted-filter'
import { DataTableFilterField, DataTableFilterPanel } from './filter-panel'

type FilterDef = {
  columnId: string
  title: string
  options: {
    label: string
    value: string
    icon?: React.ComponentType<{ className?: string }>
    iconNode?: React.ReactNode
    count?: number
  }[]
  singleSelect?: boolean
}

type SearchDraft = {
  baseValue: string
  value: string
}

export type DataTableToolbarProps<TData> = {
  table: Table<TData>
  /**
   * Placeholder for the default search input. Defaults to `t('Filter...')`.
   */
  searchPlaceholder?: string
  /**
   * Delay committing the default search input. Defaults to immediate updates.
   */
  searchDebounceMs?: number
  /**
   * Column id to filter on. When provided, the search input filters
   * a specific column. When omitted, the search input updates the
   * table's `globalFilter`.
   */
  searchKey?: string
  /**
   * Column-level filter chips (faceted multi-select / single-select).
   */
  filters?: FilterDef[]
  /**
   * Replaces the default search input entirely. Use when the primary
   * "search" is something custom — e.g. a date-time range picker.
   */
  customSearch?: ReactNode
  /**
   * Extra inputs/selects displayed in the primary row alongside the
   * search input and filter chips.
   */
  additionalSearch?: ReactNode
  /**
   * Whether non-table filters (e.g. `additionalSearch` or `expandable`
   * inputs) are currently active. Controls Reset button visibility
   * when no column filters are set.
   */
  hasAdditionalFilters?: boolean
  /**
   * Callback invoked when the user clicks Reset.
   */
  onReset?: () => void
  /**
   * Additional filter inputs hidden behind an Expand/Collapse toggle.
   * Inputs flow inline with the primary row when expanded.
   */
  expandable?: ReactNode
  /**
   * When `expandable` is collapsed, highlights the toggle if any of
   * the expandable inputs currently hold a value.
   */
  hasExpandedActiveFilters?: boolean
  /**
   * Custom action buttons rendered BEFORE the built-in
   * Reset / Search / View buttons.
   */
  preActions?: ReactNode
  /**
   * Explicit "Search" / "Apply" callback. When provided the toolbar
   * shows a primary Search button. Filters are committed only on click
   * (form-mode workflow).
   */
  onSearch?: () => void
  /**
   * Loading state for the explicit Search button.
   */
  searchLoading?: boolean
  /**
   * Hide the View Options (column visibility) dropdown.
   */
  hideViewOptions?: boolean
  /**
   * Optional view-mode toggle (e.g. table vs. card) rendered in the right
   * action cluster, before the View Options dropdown. Typically a
   * {@link DataTableViewModeToggle}. Omitted by default.
   */
  viewToggle?: ReactNode
  /**
   * Content rendered on the LEFT side of the secondary action row. When
   * provided the toolbar splits into two visual rows:
   *   Row 1: search inputs / filter chips …… Expand
   *   Row 2: expanded filters
   *   Row 3: leftActions …… Reset / Search / ViewOptions
   */
  leftActions?: ReactNode
  /**
   * Outer wrapper className override.
   */
  className?: string
}

/**
 * Unified data-table filter panel — Ant Design Pro inspired.
 *
 * Layout (single flex-wrap row):
 * - Filters (search input + additional inputs + filter chips + expandable
 *   inputs) flow horizontally and wrap as needed.
 * - The action cluster (Reset / Search / View / Expand) hugs the right
 *   edge via `ms-auto`. When filters fill a row, the cluster naturally
 *   wraps to the next line — still right-aligned — matching the
 *   collapsed/expanded states from the user's reference design.
 *
 * No background panel, no row separators — relies on whitespace and the
 * adjacent table border for visual hierarchy.
 */
export function DataTableToolbar<TData>(props: DataTableToolbarProps<TData>) {
  const { t } = useTranslation()
  const [isSearchComposing, setIsSearchComposing] = useState(false)

  const filters = props.filters ?? []
  const hasExpandable = props.expandable != null
  const hasSearch = props.onSearch != null

  const isFiltered =
    props.table.getState().columnFilters.length > 0 ||
    !!props.table.getState().globalFilter ||
    !!props.hasAdditionalFilters

  const placeholder = props.searchPlaceholder ?? t('Filter...')
  const currentSearchValue = props.searchKey
    ? ((props.table.getColumn(props.searchKey)?.getFilterValue() as string) ??
      '')
    : ((props.table.getState().globalFilter as string | undefined) ?? '')

  const [searchDraft, setSearchDraft] = useState<SearchDraft | null>(null)
  const activeSearchDraft =
    searchDraft &&
    (isSearchComposing || searchDraft.baseValue === currentSearchValue)
      ? searchDraft
      : null
  const searchValue = activeSearchDraft?.value ?? currentSearchValue
  const searchDebounceMs = Math.max(0, props.searchDebounceMs ?? 0)
  const debouncedSearchValue = useDebounce(searchValue, searchDebounceMs)

  const commitSearchValue = React.useCallback(
    (value: string) => {
      if (value === currentSearchValue) {
        return
      }

      if (props.searchKey) {
        props.table.getColumn(props.searchKey)?.setFilterValue(value)
        return
      }

      props.table.setGlobalFilter(value)
    },
    [currentSearchValue, props.searchKey, props.table]
  )

  React.useEffect(() => {
    if (
      searchDebounceMs <= 0 ||
      isSearchComposing ||
      debouncedSearchValue !== searchValue
    ) {
      return
    }

    commitSearchValue(debouncedSearchValue)
  }, [
    commitSearchValue,
    debouncedSearchValue,
    isSearchComposing,
    searchDebounceMs,
    searchValue,
  ])

  const queueSearchValue = (value: string) => {
    if (searchDebounceMs <= 0) {
      commitSearchValue(value)
    }
  }

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value
    setSearchDraft({ baseValue: currentSearchValue, value })

    if (!isSearchComposing) {
      queueSearchValue(value)
    }
  }

  const handleSearchCompositionStart = () => {
    setIsSearchComposing(true)
  }

  const handleSearchCompositionEnd = (
    event: React.CompositionEvent<HTMLInputElement>
  ) => {
    setIsSearchComposing(false)
    const value = event.currentTarget.value
    setSearchDraft({ baseValue: currentSearchValue, value })
    queueSearchValue(value)
  }

  const searchInput = (
    <Input
      placeholder={placeholder}
      aria-label={placeholder}
      value={searchValue}
      onChange={handleSearchChange}
      onCompositionStart={handleSearchCompositionStart}
      onCompositionEnd={handleSearchCompositionEnd}
      className='w-full'
    />
  )

  const filterChips = filters.map((filter) => {
    const column = props.table.getColumn(filter.columnId)
    if (!column) return null
    return (
      <DataTableFilterField key={filter.columnId}>
        <DataTableFacetedFilter
          column={column}
          title={filter.title}
          options={filter.options}
          singleSelect={filter.singleSelect}
        />
      </DataTableFilterField>
    )
  })

  const handleReset = () => {
    setIsSearchComposing(false)
    setSearchDraft(null)
    props.table.resetColumnFilters()
    props.table.setGlobalFilter('')
    props.onReset?.()
  }

  const primarySearch =
    props.customSearch !== undefined ? props.customSearch : searchInput
  const additionalFilterCount =
    filters.length + (props.additionalSearch != null ? 1 : 0)
  const inlineActions =
    additionalFilterCount <= 3 && !hasExpandable && props.leftActions == null
  const useWidePrimarySearch = !inlineActions && additionalFilterCount <= 3
  const secondaryMobileFilters =
    props.additionalSearch != null ||
    filterChips.some(Boolean) ||
    hasExpandable ? (
      <>
        {props.additionalSearch}
        {filterChips}
        {props.expandable}
      </>
    ) : undefined
  const nonSearchColumnFilterCount = props.table
    .getState()
    .columnFilters.filter((filter) => filter.id !== props.searchKey).length
  const mobileFilterCount =
    nonSearchColumnFilterCount + (props.hasExpandedActiveFilters ? 1 : 0)

  return (
    <DataTableFilterPanel
      table={props.table}
      primaryFilters={
        <>
          <DataTableFilterField wide={useWidePrimarySearch}>
            {primarySearch}
          </DataTableFilterField>
          {props.additionalSearch}
          {filterChips}
        </>
      }
      advancedFilters={props.expandable}
      mobilePinnedFilters={primarySearch}
      mobileFilters={secondaryMobileFilters}
      mobileFilterCount={mobileFilterCount}
      stats={props.leftActions}
      actionStart={props.preActions}
      viewToggle={props.viewToggle}
      hideViewOptions={props.hideViewOptions}
      hasActiveFilters={isFiltered}
      hasAdvancedActiveFilters={props.hasExpandedActiveFilters}
      advancedFilterCount={props.hasExpandedActiveFilters ? 1 : 0}
      searchLoading={props.searchLoading}
      onReset={handleReset}
      onSearch={hasSearch ? props.onSearch : undefined}
      inlineActions={inlineActions}
      className={props.className}
    />
  )
}
