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
import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { PublicLayout } from '@/components/layout'
import { PageTransition } from '@/components/page-transition'

import {
  LoadingSkeleton,
  EmptyState,
  PricingTable,
  PricingToolbar,
  ModelCardGrid,
  ModelDetailsDrawer,
} from './components'
import {
  EXCLUDED_GROUPS,
  FILTER_ALL,
  PRICING_CURRENCIES,
  VIEW_MODES,
} from './constants'
import { useFilters } from './hooks/use-filters'
import { usePricingData } from './hooks/use-pricing-data'
import { expandModelsByGroup } from './lib/model-helpers'

export function Pricing() {
  const { t } = useTranslation()
  const [selectedModelName, setSelectedModelName] = useState<string | null>(
    null
  )

  const {
    models,
    vendors,
    groupRatio,
    usableGroup,
    endpointMap,
    autoGroups,
    isLoading,
    priceRate,
    billingUSDToCNYRate,
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
  } = useFilters(models || [])
  const showPricesInCny = displayCurrency === PRICING_CURRENCIES.CNY

  const handleModelClick = useCallback((modelName: string) => {
    setSelectedModelName(modelName)
  }, [])

  const selectedModel = useMemo(
    () =>
      selectedModelName
        ? (models || []).find(
            (model) => model.model_name === selectedModelName
          ) || null
        : null,
    [models, selectedModelName]
  )

  const availableGroups = useMemo(
    () =>
      Object.keys(usableGroup || {}).filter(
        (group) => group !== FILTER_ALL && !EXCLUDED_GROUPS.includes(group)
      ),
    [usableGroup]
  )

  const displayModels = useMemo(
    () =>
      expandModelsByGroup(
        filteredModels,
        groupFilter,
        availableGroups,
        groupRatio || {}
      ),
    [availableGroups, filteredModels, groupFilter, groupRatio]
  )

  const handleClearAll = useCallback(() => {
    clearFilters()
    clearSearch()
  }, [clearFilters, clearSearch])

  const renderPricingContent = () => {
    if (displayModels.length === 0) {
      return (
        <EmptyState
          searchQuery={searchInput}
          hasActiveFilters={hasActiveFilters}
          onClearFilters={handleClearAll}
        />
      )
    }

    if (viewMode === VIEW_MODES.CARD) {
      return (
        <ModelCardGrid
          models={displayModels}
          onModelClick={handleModelClick}
          priceRate={priceRate}
          usdExchangeRate={billingUSDToCNYRate}
          tokenUnit={tokenUnit}
          showRechargePrice={showPricesInCny}
        />
      )
    }

    return (
      <PricingTable
        models={displayModels}
        priceRate={priceRate}
        usdExchangeRate={billingUSDToCNYRate}
        tokenUnit={tokenUnit}
        showRechargePrice={showPricesInCny}
        onModelClick={handleModelClick}
      />
    )
  }

  if (isLoading) {
    return (
      <PublicLayout showMainContainer={false}>
        <div className='mx-auto w-full max-w-[1280px] px-4 pt-20 pb-10 sm:px-6 sm:pt-24 lg:px-8'>
          <LoadingSkeleton viewMode={viewMode} />
        </div>
      </PublicLayout>
    )
  }

  return (
    <PublicLayout showMainContainer={false}>
      <PageTransition className='mx-auto w-full max-w-[1280px] px-4 pt-20 pb-10 sm:px-6 sm:pt-24 lg:px-8'>
        <header className='mb-8 pt-5 sm:mb-10 sm:pt-8'>
          <h1 className='text-3xl leading-tight font-bold sm:text-4xl'>
            {t('Model Square')}
          </h1>
          <p className='text-muted-foreground mt-3 max-w-2xl text-sm leading-6 sm:text-base'>
            {t(
              'Discover curated AI models, compare pricing and capabilities, and choose the right model for every scenario.'
            )}
          </p>
          <p className='text-muted-foreground/70 mt-2 text-sm'>
            {t('This site currently has {{count}} models enabled', {
              count: models?.length || 0,
            })}
          </p>
        </header>

        <main className='flex min-w-0 flex-col gap-5'>
          <PricingToolbar
            searchInput={searchInput}
            onSearchChange={setSearchInput}
            onClearSearch={clearSearch}
            filteredCount={filteredModels.length}
            totalCount={models?.length}
            sortBy={sortBy}
            onSortChange={setSortBy}
            tokenUnit={tokenUnit}
            onTokenUnitChange={setTokenUnit}
            displayCurrency={displayCurrency}
            onCurrencyChange={setDisplayCurrency}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
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
            groupRatios={groupRatio}
            tags={availableTags}
            models={models || []}
            hasActiveFilters={hasActiveFilters}
            activeFilterCount={activeFilterCount}
            onClearFilters={clearFilters}
          />

          {renderPricingContent()}
        </main>

        {selectedModel && (
          <ModelDetailsDrawer
            open={Boolean(selectedModel)}
            onOpenChange={(open) => {
              if (!open) setSelectedModelName(null)
            }}
            model={selectedModel}
            groupRatio={groupRatio || {}}
            usableGroup={usableGroup || {}}
            endpointMap={
              (endpointMap as Record<
                string,
                { path?: string; method?: string }
              >) || {}
            }
            autoGroups={autoGroups || []}
            priceRate={priceRate ?? 1}
            usdExchangeRate={billingUSDToCNYRate ?? 1}
            tokenUnit={tokenUnit}
            showRechargePrice={showPricesInCny}
          />
        )}
      </PageTransition>
    </PublicLayout>
  )
}
