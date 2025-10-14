import { useMemo, useCallback, useEffect } from 'react'
import { Link, useSearch, useNavigate } from '@tanstack/react-router'
import { Code } from 'lucide-react'
import { useAuthStore } from '@/stores/auth-store'
import { Button } from '@/components/ui/button'
import { useSidebar } from '@/components/ui/sidebar'
import { Skeleton } from '@/components/ui/skeleton'
import { AppHeader, Main, AuthenticatedLayout } from '@/components/layout'
import { ThemeSwitch } from '@/components/theme-switch'
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

const TAG_SPLIT_REGEX = /[,;|\s]+/

function PricingAuthenticatedContent({
  content,
}: {
  content: React.ReactNode
}) {
  const sidebar = useSidebar()

  // Close sidebar on mount (only run once)
  useEffect(() => {
    try {
      if (sidebar?.setOpen) {
        sidebar.setOpen(false)
      }
    } catch (error) {
      console.error('Error closing sidebar:', error)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <>
      <AppHeader fixed />
      <Main>{content}</Main>
    </>
  )
}

export function Pricing() {
  const search = useSearch({ from: '/pricing/' })
  const navigate = useNavigate({ from: '/pricing' })
  const { auth } = useAuthStore()
  const isAuthenticated = !!auth.user

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
  const view = ((search as any).view as 'table' | 'card') || 'table'

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
      search: {},
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
            .split(TAG_SPLIT_REGEX)
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

  const content = (
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
              if (newView === 'table') {
                navigate({
                  search: (prev: any) => {
                    const { view, ...rest } = prev
                    return rest
                  },
                })
              } else {
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
  )

  if (isAuthenticated) {
    return (
      <AuthenticatedLayout>
        <PricingAuthenticatedContent content={content} />
      </AuthenticatedLayout>
    )
  }

  return (
    <div className='min-h-screen'>
      <header className='bg-background/95 supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50 w-full border-b backdrop-blur'>
        <div className='container flex h-14 items-center justify-between'>
          <Link to='/' className='flex items-center space-x-2'>
            <Code className='h-6 w-6' />
            <span className='text-xl font-bold'>New API</span>
          </Link>
          <div className='flex items-center space-x-4'>
            <ThemeSwitch />
            <Button variant='ghost' asChild>
              <Link to='/sign-in'>登录</Link>
            </Button>
            <Button asChild>
              <Link to='/sign-up'>注册</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className='container px-4 py-6 md:px-4'>{content}</main>
    </div>
  )
}
