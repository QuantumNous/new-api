import { useCallback, useMemo } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useMediaQuery } from '@/hooks'
import { useTranslation } from 'react-i18next'
import { PublicLayout } from '@/components/layout'
import { PageTransition } from '@/components/page-transition'
import {
  LoadingSkeleton,
  EmptyState,
  SearchBar,
  FilterBar,
  VirtualModelList,
  PricingTable,
} from './components'
import { EXCLUDED_GROUPS, VIEW_MODES } from './constants'
import { useFilters } from './hooks/use-filters'
import { usePricingData } from './hooks/use-pricing-data'

export function Pricing() {
  const { t } = useTranslation()
  const navigate = useNavigate({ from: '/pricing/' })
  const isMobile = useMediaQuery('(max-width: 640px)')

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
  } = useFilters(models || [])

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

  const handleClearAll = useCallback(() => {
    clearFilters()
    clearSearch()
  }, [clearFilters, clearSearch])

  if (isLoading) {
    return (
      <PublicLayout>
        <div className='mx-auto max-w-6xl px-4 sm:px-6'>
          <LoadingSkeleton viewMode={viewMode} />
        </div>
      </PublicLayout>
    )
  }

  return (
    <PublicLayout>
      <PageTransition className='mx-auto max-w-6xl px-4 sm:px-6'>
        <header className='mb-6 sm:mb-8'>
          <h1 className='text-2xl font-bold tracking-tight sm:text-3xl'>
            {t('Model Pricing')}
          </h1>
          <p className='text-muted-foreground mt-1 text-sm'>
            {t('Browse and compare')} {models?.length || 0} {t('models')}
          </p>
        </header>

        <div className='space-y-4'>
          <SearchBar
            value={searchInput}
            onChange={setSearchInput}
            onClear={clearSearch}
          />

          <FilterBar
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
            sortBy={sortBy}
            onSortChange={setSortBy}
            tokenUnit={tokenUnit}
            onTokenUnitChange={setTokenUnit}
            showRechargePrice={showRechargePrice}
            onRechargePriceChange={setShowRechargePrice}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            hasActiveFilters={hasActiveFilters}
            activeFilterCount={activeFilterCount}
            onClearFilters={clearFilters}
            filteredCount={filteredModels.length}
            totalCount={models?.length}
          />

          {filteredModels.length > 0 ? (
            isMobile || viewMode === VIEW_MODES.LIST ? (
              <VirtualModelList
                models={filteredModels}
                onModelClick={handleModelClick}
                priceRate={priceRate}
                usdExchangeRate={usdExchangeRate}
                tokenUnit={tokenUnit}
                showRechargePrice={showRechargePrice}
              />
            ) : (
              <PricingTable
                models={filteredModels}
                priceRate={priceRate}
                usdExchangeRate={usdExchangeRate}
                tokenUnit={tokenUnit}
                showRechargePrice={showRechargePrice}
              />
            )
          ) : (
            <EmptyState
              searchQuery={searchInput}
              hasActiveFilters={hasActiveFilters}
              onClearFilters={handleClearAll}
            />
          )}
        </div>
      </PageTransition>
    </PublicLayout>
  )
}
