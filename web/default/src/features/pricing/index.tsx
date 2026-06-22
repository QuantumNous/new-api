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
import {
  BadgeDollarSign,
  Code2,
  FileText,
  Gauge,
  Languages,
  MessageSquareText,
  ShieldCheck,
  WalletCards,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { PublicLayout } from '@/components/layout'
import { PageTransition } from '@/components/page-transition'
import {
  LoadingSkeleton,
  EmptyState,
  SearchBar,
  PricingTable,
  PricingSidebar,
  PricingToolbar,
  ModelCardGrid,
  ModelDetailsDrawer,
} from './components'
import { EXCLUDED_GROUPS, VIEW_MODES } from './constants'
import { useFilters } from './hooks/use-filters'
import { usePricingData } from './hooks/use-pricing-data'

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
        (g) => !EXCLUDED_GROUPS.includes(g)
      ),
    [usableGroup]
  )

  const handleClearAll = useCallback(() => {
    clearFilters()
    clearSearch()
  }, [clearFilters, clearSearch])

  const quickUseCases = [
    {
      icon: MessageSquareText,
      label: t('Writing / chat'),
      models: 'Claude Sonnet · GPT-4o',
    },
    {
      icon: Languages,
      label: t('Translation'),
      models: 'DeepSeek V3 · Gemini Flash',
    },
    {
      icon: Code2,
      label: t('Math / code'),
      models: 'o4-mini · DeepSeek R1',
    },
    {
      icon: FileText,
      label: t('Long docs'),
      models: 'Gemini 2 Pro · Claude Opus · Kimi K2',
    },
  ]

  const renderPricingContent = () => {
    if (filteredModels.length === 0) {
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
          models={filteredModels}
          onModelClick={handleModelClick}
          priceRate={priceRate}
          usdExchangeRate={usdExchangeRate}
          tokenUnit={tokenUnit}
          showRechargePrice={showRechargePrice}
        />
      )
    }

    return (
      <PricingTable
        models={filteredModels}
        priceRate={priceRate}
        usdExchangeRate={usdExchangeRate}
        tokenUnit={tokenUnit}
        showRechargePrice={showRechargePrice}
        onModelClick={handleModelClick}
      />
    )
  }

  if (isLoading) {
    return (
      <PublicLayout showMainContainer={false}>
        <div className='mx-auto w-full max-w-[1800px] px-3 pt-16 pb-8 sm:px-6 sm:pt-20 sm:pb-10 xl:px-8'>
          <LoadingSkeleton viewMode={viewMode} />
        </div>
      </PublicLayout>
    )
  }

  return (
    <PublicLayout showMainContainer={false}>
      <div className='bg-background relative min-h-dvh'>
        <div className='pointer-events-none absolute inset-x-0 top-0 h-px bg-border' />
        <PageTransition className='relative mx-auto w-full max-w-[1800px] px-3 pt-16 pb-8 sm:px-6 sm:pt-20 sm:pb-10 xl:px-8'>
          <header className='mb-5 pt-5 sm:mb-8 sm:pt-8'>
            <div className='grid gap-4 lg:grid-cols-[minmax(0,1fr)_420px] lg:items-stretch'>
              <div className='border-border/80 bg-card/80 flex min-h-[300px] flex-col justify-between rounded-xl border px-5 py-5 shadow-[0_12px_34px_rgba(28,28,28,0.06)] sm:px-7 sm:py-7'>
                <div>
                  <div className='mb-4 inline-flex items-center gap-2 rounded-full border border-blue-500/15 bg-blue-500/8 px-3 py-1 text-xs font-semibold text-blue-600 dark:text-blue-300'>
                    <BadgeDollarSign className='size-3.5' />
                    {t('Models Directory')}
                  </div>
                  <h1 className='max-w-4xl text-[clamp(2rem,4.8vw,3.5rem)] leading-[1.08] font-semibold'>
                    {t('Pricing')}
                  </h1>
                  <p className='text-muted-foreground mt-4 max-w-2xl text-sm leading-6 sm:text-base'>
                    {t(
                      'Discover curated AI models, compare pricing and capabilities, and choose the right model for every scenario.'
                    )}
                  </p>
                </div>

                <div className='mt-6 grid gap-2 sm:grid-cols-3'>
                  <div className='rounded-lg border bg-background/70 px-3 py-3'>
                    <div className='text-muted-foreground flex items-center gap-2 text-xs font-medium'>
                      <Gauge className='size-3.5 text-blue-600' />
                      {t('Enabled models')}
                    </div>
                    <div className='mt-2 text-2xl font-semibold tabular-nums'>
                      {(models?.length || 0).toLocaleString()}
                    </div>
                  </div>
                  <div className='rounded-lg border bg-background/70 px-3 py-3'>
                    <div className='text-muted-foreground flex items-center gap-2 text-xs font-medium'>
                      <WalletCards className='size-3.5 text-blue-600' />
                      {t('Price view')}
                    </div>
                    <div className='mt-2 text-sm font-semibold'>
                      {showRechargePrice ? t('Recharge') : t('Standard')}
                    </div>
                  </div>
                  <div className='rounded-lg border bg-background/70 px-3 py-3'>
                    <div className='text-muted-foreground flex items-center gap-2 text-xs font-medium'>
                      <ShieldCheck className='size-3.5 text-blue-600' />
                      {t('Compare by')}
                    </div>
                    <div className='mt-2 text-sm font-semibold'>
                      {tokenUnit === 'M' ? '/1M' : '/1K'}
                    </div>
                  </div>
                </div>
              </div>

              <div className='border-border/80 bg-card/80 rounded-xl border px-4 py-4 shadow-[0_12px_34px_rgba(28,28,28,0.06)] sm:px-5 sm:py-5'>
                <div className='mb-3'>
                  <h2 className='text-base font-semibold'>
                    {t('Not sure which model?')}
                  </h2>
                  <p className='text-muted-foreground mt-1 text-xs leading-5'>
                    {t(
                      'Start with a common task, then open a model to inspect the full price breakdown.'
                    )}
                  </p>
                </div>
                <div className='grid gap-2'>
                  {quickUseCases.map((item) => {
                    const Icon = item.icon
                    return (
                      <div
                        key={item.label}
                        className='rounded-lg border bg-background/70 p-3'
                      >
                        <div className='flex items-start gap-3'>
                          <div className='mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-blue-500/10 text-blue-600'>
                            <Icon className='size-4' />
                          </div>
                          <div className='min-w-0'>
                            <div className='text-sm font-semibold'>
                              {item.label}
                            </div>
                            <div className='text-muted-foreground mt-0.5 truncate text-xs'>
                              {item.models}
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            <SearchBar
              value={searchInput}
              onChange={setSearchInput}
              onClear={clearSearch}
              placeholder={t(
                'Search model name, provider, endpoint, or tag...'
              )}
              className='mt-4 max-w-3xl sm:mt-5'
            />
          </header>

          <div className='grid gap-4 xl:grid-cols-[330px_minmax(0,1fr)]'>
            <PricingSidebar
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
              onClearFilters={clearFilters}
              className='hover-scrollbar sticky top-4 hidden max-h-[calc(100dvh-2rem)] self-start overflow-y-auto xl:block'
            />

            <main className='min-w-0 space-y-4'>
              <PricingToolbar
                filteredCount={filteredModels.length}
                totalCount={models?.length}
                sortBy={sortBy}
                onSortChange={setSortBy}
                tokenUnit={tokenUnit}
                onTokenUnitChange={setTokenUnit}
                showRechargePrice={showRechargePrice}
                onRechargePriceChange={setShowRechargePrice}
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
          </div>

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
              usdExchangeRate={usdExchangeRate ?? 1}
              tokenUnit={tokenUnit}
              showRechargePrice={showRechargePrice}
            />
          )}
        </PageTransition>
      </div>
    </PublicLayout>
  )
}
