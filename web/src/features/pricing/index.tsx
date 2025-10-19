import { useMemo, useCallback } from 'react'
import { useSearch, useNavigate } from '@tanstack/react-router'
import { Skeleton } from '@/components/ui/skeleton'
import { PublicLayout } from '@/components/layout'
import { PricingCardView } from './components/pricing-card-view'
import { PricingFilterDrawer } from './components/pricing-filter-drawer'
import { PricingSidebar } from './components/pricing-sidebar'
import { PricingTable } from './components/pricing-table'
import { PricingViewToggle } from './components/pricing-view-toggle'
import { usePricingData } from './hooks/use-pricing-data'

type PricingFilters = {
  vendor: string
  group: string
  endpoint: string
  tag: string
  quota: 'all' | '0' | '1'
}

export function Pricing() {
  const search = useSearch({ from: '/pricing/' })
  const navigate = useNavigate({ from: '/pricing' })

  const {
    models,
    vendors,
    groupRatio,
    usableGroup,
    endpointMap,
    isLoading,
    priceRate,
    usdExchangeRate,
  } = usePricingData()

  const filters: PricingFilters = {
    vendor: search.vendor || 'all',
    group: search.group || 'all',
    endpoint: search.endpoint || 'all',
    tag: search.tag || 'all',
    quota: (search.quota as PricingFilters['quota']) || 'all',
  }

  const currency = (search.currency as 'USD' | 'CNY') || 'USD'
  const tokenUnit = (search.tokenUnit as 'M' | 'K') || 'M'
  const showWithRecharge = search.showRecharge === 'true'
  const view = ((search as any).view as 'table' | 'card') || 'card'

  // Force card view on mobile
  const isMobileView = typeof window !== 'undefined' && window.innerWidth < 768
  const effectiveView = isMobileView ? 'card' : view

  const updateSearch = useCallback(
    (updates: Partial<typeof search>) => {
      navigate({
        search: (prev) => ({ ...prev, ...updates }),
      })
    },
    [navigate]
  )

  const handleFilterChange = useCallback(
    <K extends keyof PricingFilters>(key: K, value: PricingFilters[K]) => {
      if (value === 'all') {
        navigate({
          search: (prev) => {
            const { [key]: _, ...rest } = prev
            return rest
          },
        })
      } else {
        updateSearch({ [key]: value })
      }
    },
    [navigate, updateSearch]
  )

  const handleReset = useCallback(() => {
    navigate({
      search: (prev: any) => {
        // Preserve view mode and display settings when resetting filters
        const { view, currency, tokenUnit, showRecharge } = prev
        const preserved: any = {}
        if (view) preserved.view = view
        if (currency) preserved.currency = currency
        if (tokenUnit) preserved.tokenUnit = tokenUnit
        if (showRecharge) preserved.showRecharge = showRecharge
        return preserved
      },
    })
  }, [navigate])

  const getFilteredModels = useCallback(
    (overrides?: Partial<PricingFilters>) => {
      if (!models || models.length === 0) return []

      const activeFilters = { ...filters, ...overrides }

      return models.filter((model) => {
        if (!model) return false

        if (activeFilters.vendor !== 'all') {
          if (activeFilters.vendor === 'unknown') {
            if (model.vendor_name) return false
          } else {
            if (model.vendor_name !== activeFilters.vendor) return false
          }
        }

        if (activeFilters.tag !== 'all') {
          if (!model.tags) return false
          const modelTags = model.tags
            .toLowerCase()
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean)
          if (!modelTags.includes(activeFilters.tag.toLowerCase())) return false
        }

        if (activeFilters.group !== 'all') {
          const groups = Array.isArray(model.enable_groups)
            ? model.enable_groups
            : []
          if (!groups.includes(activeFilters.group)) return false
        }

        if (activeFilters.endpoint !== 'all') {
          const endpoints = Array.isArray(model.supported_endpoint_types)
            ? model.supported_endpoint_types
            : []
          if (!endpoints.includes(activeFilters.endpoint)) return false
        }

        if (activeFilters.quota !== 'all') {
          const quotaValue = parseInt(activeFilters.quota)
          if (model.quota_type !== quotaValue) return false
        }

        return true
      })
    },
    [filters, models]
  )

  const filteredModels = useMemo(() => getFilteredModels(), [getFilteredModels])

  const filterProps = {
    filters,
    onFilterChange: handleFilterChange,
    onReset: handleReset,
    getFilteredModels,
    models: models || [],
    vendors: vendors || [],
    usableGroup: usableGroup || {},
    groupRatio: groupRatio || {},
    endpointMap: endpointMap || {},
    isLoading,
    currency,
    onCurrencyChange: (value: 'USD' | 'CNY') => {
      if (value === 'USD') {
        navigate({
          search: (prev) => {
            const { currency, ...rest } = prev
            return rest
          },
        })
      } else {
        updateSearch({ currency: value })
      }
    },
    tokenUnit,
    onTokenUnitChange: (value: 'M' | 'K') => {
      if (value === 'M') {
        navigate({
          search: (prev) => {
            const { tokenUnit, ...rest } = prev
            return rest
          },
        })
      } else {
        updateSearch({ tokenUnit: value })
      }
    },
    showWithRecharge,
    onShowWithRechargeChange: (value: boolean) => {
      if (!value) {
        navigate({
          search: (prev) => {
            const { showRecharge, ...rest } = prev
            return rest
          },
        })
      } else {
        updateSearch({ showRecharge: 'true' })
      }
    },
  }

  return (
    <PublicLayout>
      <div className='flex gap-6'>
        <div className='hidden w-72 shrink-0 md:block'>
          {!isLoading && models.length > 0 ? (
            <PricingSidebar {...filterProps} />
          ) : (
            <div className='space-y-4'>
              <Skeleton className='h-12 w-full' />
              <Skeleton className='h-12 w-full' />
              <Skeleton className='h-12 w-full' />
            </div>
          )}
        </div>

        <div className='min-w-0 flex-1 space-y-4'>
          <div className='flex items-center justify-between gap-4'>
            <div>
              <h2 className='text-2xl font-bold tracking-tight'>Pricing</h2>
              <p className='text-muted-foreground text-sm'>
                View pricing for all available models ({filteredModels.length}{' '}
                models)
              </p>
            </div>
            <PricingViewToggle
              view={view}
              onViewChange={(newView) => {
                if (newView === 'card') {
                  // Card is default, remove view param
                  navigate({
                    search: (prev: any) => {
                      const { view, ...rest } = prev
                      return rest
                    },
                  })
                } else {
                  // Table view, set explicitly
                  updateSearch({ view: newView } as any)
                }
              }}
            />
          </div>

          {isLoading ? (
            <div className='space-y-4'>
              <Skeleton className='h-12 w-full' />
              <Skeleton className='h-[400px] w-full' />
            </div>
          ) : effectiveView === 'card' ? (
            <PricingCardView
              models={filteredModels}
              currency={currency}
              tokenUnit={tokenUnit}
              showWithRecharge={showWithRecharge}
              priceRate={priceRate}
              usdExchangeRate={usdExchangeRate}
              filterButton={
                !isLoading && models.length > 0 ? (
                  <PricingFilterDrawer {...filterProps} />
                ) : null
              }
            />
          ) : (
            <PricingTable
              models={filteredModels}
              currency={currency}
              tokenUnit={tokenUnit}
              showWithRecharge={showWithRecharge}
              priceRate={priceRate}
              usdExchangeRate={usdExchangeRate}
            />
          )}
        </div>
      </div>
    </PublicLayout>
  )
}
