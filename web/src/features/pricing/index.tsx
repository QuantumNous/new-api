import { useCallback, useMemo, useEffect } from 'react'
import { useSearch, useNavigate } from '@tanstack/react-router'
import { Filter } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PublicLayout } from '@/components/layout'
import { StatusBadge } from '@/components/status-badge'
import {
  LoadingSkeleton,
  EmptyState,
  SearchBar,
  ActiveFilterTags,
  MobileFilters,
  DesktopSidebar,
  VirtualModelList,
  SortDropdown,
} from './components'
import {
  SORT_OPTIONS,
  QUOTA_TYPES,
  ENDPOINT_TYPES,
  FILTER_ALL,
  EXCLUDED_GROUPS,
} from './constants'
import { useFilters } from './hooks/use-filters'
import { usePricingData } from './hooks/use-pricing-data'
import { useUIState } from './hooks/use-ui-state'

// ----------------------------------------------------------------------------
// Pricing Page Component
// ----------------------------------------------------------------------------

export function Pricing() {
  const search = useSearch({ from: '/pricing/' })
  const navigate = useNavigate({ from: '/pricing' })
  const {
    models,
    vendors,
    usableGroup,
    isLoading,
    priceRate,
    usdExchangeRate,
  } = usePricingData()

  const {
    searchInput,
    sortBy,
    vendorFilter,
    groupFilter,
    quotaTypeFilter,
    endpointTypeFilter,
    tagFilter,
    setSearchInput,
    setSortBy,
    setVendorFilter,
    setGroupFilter,
    setQuotaTypeFilter,
    setEndpointTypeFilter,
    setTagFilter,
    filteredModels,
    hasActiveFilters,
    activeFilterCount,
    availableTags,
    clearFilters,
    clearSearch,
  } = useFilters({
    models: models || [],
    initialSearch: search.search || '',
    initialSort: search.sort || SORT_OPTIONS.NAME,
    initialVendor: search.vendor || FILTER_ALL,
    initialGroup: search.group || FILTER_ALL,
    initialQuotaType: search.quotaType || QUOTA_TYPES.ALL,
    initialEndpointType: search.endpointType || ENDPOINT_TYPES.ALL,
    initialTag: search.tag || FILTER_ALL,
  })

  // Sync filters to URL
  useEffect(() => {
    const params: Record<string, string> = {}

    if (searchInput) params.search = searchInput
    if (sortBy !== SORT_OPTIONS.NAME) params.sort = sortBy
    if (vendorFilter !== FILTER_ALL) params.vendor = vendorFilter
    if (groupFilter !== FILTER_ALL) params.group = groupFilter
    if (quotaTypeFilter !== QUOTA_TYPES.ALL) params.quotaType = quotaTypeFilter
    if (endpointTypeFilter !== ENDPOINT_TYPES.ALL)
      params.endpointType = endpointTypeFilter
    if (tagFilter !== FILTER_ALL) params.tag = tagFilter

    navigate({
      to: '/pricing',
      search: params,
      replace: true,
    })
  }, [
    searchInput,
    sortBy,
    vendorFilter,
    groupFilter,
    quotaTypeFilter,
    endpointTypeFilter,
    tagFilter,
    navigate,
  ])

  const {
    showMobileFilters,
    openSections,
    expandedFilters,
    toggleSection,
    toggleExpandFilter,
    toggleMobileFilters,
    closeMobileFilters,
  } = useUIState()

  const handleModelClick = useCallback(
    (modelName: string) => {
      navigate({
        to: '/pricing/$modelId',
        params: { modelId: modelName },
        search: (prev) => prev,
      })
    },
    [navigate]
  )

  const availableGroups = useMemo(
    () =>
      Object.keys(usableGroup || {}).filter(
        (g) => !EXCLUDED_GROUPS.includes(g)
      ),
    [usableGroup]
  )

  if (isLoading) {
    return (
      <PublicLayout>
        <div className='mx-auto max-w-7xl px-4 sm:px-6'>
          <LoadingSkeleton />
        </div>
      </PublicLayout>
    )
  }

  return (
    <PublicLayout>
      <div className='mx-auto max-w-7xl px-4 sm:px-6'>
        {/* Main Layout */}
        <div className='flex gap-8'>
          {/* Sidebar Filters - Desktop */}
          <DesktopSidebar
            quotaTypeFilter={quotaTypeFilter}
            endpointTypeFilter={endpointTypeFilter}
            vendorFilter={vendorFilter}
            groupFilter={groupFilter}
            tagFilter={tagFilter}
            onQuotaTypeChange={setQuotaTypeFilter}
            onEndpointTypeChange={setEndpointTypeFilter}
            onVendorChange={setVendorFilter}
            onGroupChange={setGroupFilter}
            onTagChange={setTagFilter}
            vendors={vendors || []}
            groups={availableGroups}
            tags={availableTags}
            openSections={openSections}
            onToggleSection={toggleSection}
            expandedFilters={expandedFilters}
            onToggleExpandFilter={toggleExpandFilter}
            hasActiveFilters={hasActiveFilters}
            onClearFilters={clearFilters}
          />

          {/* Main Content */}
          <main className='animate-appear animation-delay-100 min-w-0 flex-1'>
            {/* Header */}
            <header className='animate-appear mb-4 sm:mb-6'>
              <div className='mb-3 flex items-start justify-between gap-4 sm:mb-0'>
                <div className='space-y-0.5 sm:space-y-1'>
                  <h2 className='text-xl font-bold tracking-tight sm:text-2xl'>
                    Models
                  </h2>
                  <p className='text-muted-foreground text-xs sm:text-sm'>
                    Browse and compare {models?.length || 0} AI models
                  </p>
                </div>

                {/* Sort Dropdown - Mobile (Top Right) */}
                <div className='shrink-0 sm:hidden'>
                  <SortDropdown value={sortBy} onValueChange={setSortBy} />
                </div>
              </div>
            </header>

            {/* Top Bar - Results Count & Reset Filters */}
            <div className='mb-3 flex items-center justify-between gap-4 sm:mb-4'>
              <p className='text-muted-foreground text-sm font-medium'>
                {filteredModels.length}{' '}
                {filteredModels.length === 1 ? 'model' : 'models'}
              </p>
              {hasActiveFilters && (
                <Button
                  variant='ghost'
                  size='sm'
                  onClick={clearFilters}
                  className='text-muted-foreground hover:text-foreground -mr-2 h-auto p-0 text-sm font-normal'
                >
                  Reset Filters
                </Button>
              )}
            </div>

            {/* Search and Controls Bar */}
            <div className='mb-5 space-y-4 sm:mb-6'>
              {/* Search and Sort Row */}
              <div className='flex items-center gap-3'>
                {/* Search Bar - Takes most space */}
                <div className='flex-1'>
                  <SearchBar
                    value={searchInput}
                    onChange={setSearchInput}
                    onClear={clearSearch}
                  />
                </div>

                {/* Sort Dropdown - Desktop */}
                <div className='hidden shrink-0 sm:block'>
                  <SortDropdown value={sortBy} onValueChange={setSortBy} />
                </div>

                {/* Mobile Filter Button */}
                <Button
                  variant='outline'
                  onClick={toggleMobileFilters}
                  className='shrink-0 gap-2 sm:hidden'
                >
                  <Filter className='h-4 w-4' />
                  <span className='sm:inline'>Filters</span>
                  {activeFilterCount > 0 && (
                    <StatusBadge
                      label={String(activeFilterCount)}
                      variant='neutral'
                      size='sm'
                      rounded='full'
                      copyable={false}
                    />
                  )}
                </Button>
              </div>

              {/* Active Filter Tags (Desktop) */}
              <ActiveFilterTags
                vendorFilter={vendorFilter}
                groupFilter={groupFilter}
                quotaTypeFilter={quotaTypeFilter}
                endpointTypeFilter={endpointTypeFilter}
                tagFilter={tagFilter}
                onRemoveVendor={() => setVendorFilter(FILTER_ALL)}
                onRemoveGroup={() => setGroupFilter(FILTER_ALL)}
                onRemoveQuotaType={() => setQuotaTypeFilter(QUOTA_TYPES.ALL)}
                onRemoveEndpointType={() =>
                  setEndpointTypeFilter(ENDPOINT_TYPES.ALL)
                }
                onRemoveTag={() => setTagFilter(FILTER_ALL)}
              />

              {/* Mobile Filters */}
              <MobileFilters
                show={showMobileFilters}
                onClose={closeMobileFilters}
                quotaTypeFilter={quotaTypeFilter}
                endpointTypeFilter={endpointTypeFilter}
                vendorFilter={vendorFilter}
                groupFilter={groupFilter}
                tagFilter={tagFilter}
                onQuotaTypeChange={setQuotaTypeFilter}
                onEndpointTypeChange={setEndpointTypeFilter}
                onVendorChange={setVendorFilter}
                onGroupChange={setGroupFilter}
                onTagChange={setTagFilter}
                vendors={vendors || []}
                groups={availableGroups}
                tags={availableTags}
                hasActiveFilters={hasActiveFilters}
                onClearFilters={clearFilters}
                openSections={openSections}
                onToggleSection={toggleSection}
                expandedFilters={expandedFilters}
                onToggleExpandFilter={toggleExpandFilter}
              />
            </div>

            {/* Model List */}
            {filteredModels.length > 0 ? (
              <VirtualModelList
                models={filteredModels}
                onModelClick={handleModelClick}
                priceRate={priceRate}
                usdExchangeRate={usdExchangeRate}
              />
            ) : (
              <EmptyState
                searchQuery={searchInput}
                hasActiveFilters={hasActiveFilters}
                onClearFilters={clearFilters}
              />
            )}
          </main>
        </div>
      </div>
    </PublicLayout>
  )
}
