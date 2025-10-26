import { useCallback, useMemo } from 'react'
import { useSearch, useNavigate } from '@tanstack/react-router'
import { Filter } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
} from './components'
import {
  SORT_LABELS,
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
    initialSearch: search.search,
  })

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
        {/* Header */}
        <header className='animate-appear mb-4 space-y-0.5 sm:mb-6 sm:space-y-1'>
          <h2 className='text-xl font-bold tracking-tight sm:text-2xl'>
            Models
          </h2>
          <p className='text-muted-foreground text-xs sm:text-sm'>
            Browse and compare {models?.length || 0} AI models
          </p>
        </header>

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
            {/* Search and Controls Bar */}
            <div className='mb-4 space-y-3 sm:mb-6 sm:space-y-4'>
              {/* Search Bar */}
              <SearchBar
                value={searchInput}
                onChange={setSearchInput}
                onClear={clearSearch}
              />

              {/* Controls Bar */}
              <div className='flex items-center justify-between gap-3 sm:gap-4'>
                {/* Results Count & Filter Button (Mobile) */}
                <div className='flex items-center gap-2 sm:gap-3'>
                  <p className='text-muted-foreground text-xs sm:text-sm'>
                    {filteredModels.length}{' '}
                    {filteredModels.length === 1 ? 'model' : 'models'}
                  </p>
                  {/* Mobile Filter Toggle */}
                  <Button
                    variant='outline'
                    size='sm'
                    onClick={toggleMobileFilters}
                    className='gap-2 lg:hidden'
                  >
                    <Filter className='h-4 w-4' />
                    Filters
                    {activeFilterCount > 0 && (
                      <StatusBadge
                        label={String(activeFilterCount)}
                        variant='neutral'
                        size='sm'
                        rounded='full'
                        copyable={false}
                        className='ml-0.5'
                      />
                    )}
                  </Button>
                </div>

                {/* Sort Dropdown */}
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger size='sm' className='w-[180px]'>
                    <SelectValue placeholder='Sort by' />
                  </SelectTrigger>
                  <SelectContent align='end'>
                    {Object.entries(SORT_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

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
