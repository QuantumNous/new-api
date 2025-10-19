import { useMemo } from 'react'
import { getLobeIcon } from '@/lib/lobe-icon'
import { cn } from '@/lib/utils'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { PricingModel, PricingVendor } from '../api'
import { PricingControls } from './pricing-controls'

type PricingFilters = {
  vendor: string
  group: string
  endpoint: string
  tag: string
  quota: 'all' | '0' | '1'
}

type FilterOption = {
  value: string
  label: string
  count: number
  disabled?: boolean
  icon?: React.ReactNode
  description?: string
  badge?: string
}

type PricingSidebarProps = {
  filters: PricingFilters
  onFilterChange: <K extends keyof PricingFilters>(
    key: K,
    value: PricingFilters[K]
  ) => void
  onReset: () => void
  getFilteredModels: (overrides?: Partial<PricingFilters>) => PricingModel[]
  models: PricingModel[]
  vendors: PricingVendor[]
  usableGroup: Record<string, { desc: string; ratio: number }>
  groupRatio: Record<string, number>
  endpointMap: Record<string, string>
  isLoading?: boolean
  currency: 'USD' | 'CNY'
  onCurrencyChange: (value: 'USD' | 'CNY') => void
  tokenUnit: 'M' | 'K'
  onTokenUnitChange: (value: 'M' | 'K') => void
  showWithRecharge: boolean
  onShowWithRechargeChange: (value: boolean) => void
}

function FilterOptions({
  options,
  activeValue,
  onSelect,
}: {
  options: FilterOption[]
  activeValue: string
  onSelect: (value: string) => void
}) {
  return (
    <div className='grid gap-2'>
      {options.map((option) => {
        const isActive = option.value === activeValue
        return (
          <Button
            key={option.value}
            type='button'
            size='sm'
            variant={isActive ? 'default' : 'outline'}
            className={cn(
              'justify-between text-left',
              option.disabled && 'pointer-events-none opacity-50'
            )}
            onClick={() => onSelect(option.value)}
          >
            <span className='flex min-w-0 items-center gap-2'>
              {option.icon}
              <span className='truncate'>{option.label}</span>
            </span>
            <span className='text-muted-foreground flex items-center gap-2 text-xs'>
              {option.badge && (
                <Badge
                  variant='outline'
                  className='font-mono text-[10px] uppercase'
                >
                  {option.badge}
                </Badge>
              )}
              <span>{option.count}</span>
            </span>
          </Button>
        )
      })}
    </div>
  )
}

function extractTags(models: PricingModel[]) {
  const tagMap = new Map<string, string>()
  models.forEach((model) => {
    if (!model.tags) return
    model.tags
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean)
      .forEach((tag) => {
        const key = tag.toLowerCase()
        if (!tagMap.has(key)) {
          tagMap.set(key, tag)
        }
      })
  })
  return Array.from(tagMap.entries())
    .map(([key, label]) => ({ key, label }))
    .sort((a, b) => a.label.localeCompare(b.label))
}

function formatGroupBadge(value: string, groupRatio: Record<string, number>) {
  if (value === 'all') return 'ALL'
  const ratio = groupRatio[value]
  if (!ratio) return 'x1'
  return `x${ratio}`
}

export function PricingSidebar({
  filters,
  onFilterChange,
  onReset,
  getFilteredModels,
  models,
  vendors,
  usableGroup,
  groupRatio,
  endpointMap,
  isLoading,
  currency,
  onCurrencyChange,
  tokenUnit,
  onTokenUnitChange,
  showWithRecharge,
  onShowWithRechargeChange,
}: PricingSidebarProps) {
  const { vendor, group, endpoint, tag, quota } = filters

  const vendorOptions = useMemo(() => {
    if (!models || models.length === 0 || !vendors || vendors.length === 0) {
      return [
        {
          value: 'all',
          label: 'All Vendors',
          count: 0,
          icon: getLobeIcon('Layers', 18),
          disabled: true,
        },
      ]
    }

    const counts = new Map<string, number>()
    const hasUnknown = models.some((model) => !model.vendor_name)

    const allCounts = vendors.map((item) => {
      const value = item.name
      const filtered = getFilteredModels({ vendor: value })
      counts.set(value, filtered.length)
      return {
        value,
        label: item.name,
        count: filtered.length,
        icon: getLobeIcon(item.icon || 'Layers', 18),
        disabled: filtered.length === 0,
      }
    })

    if (hasUnknown) {
      const unknownCount = getFilteredModels({ vendor: 'unknown' }).length
      counts.set('unknown', unknownCount)
      allCounts.push({
        value: 'unknown',
        label: 'Unknown Vendor',
        count: unknownCount,
        icon: getLobeIcon('HelpCircle', 18),
        disabled: unknownCount === 0,
      })
    }

    const totalCount = getFilteredModels({ vendor: 'all' }).length

    return [
      {
        value: 'all',
        label: 'All Vendors',
        count: totalCount,
        icon: getLobeIcon('Layers', 18),
        disabled: totalCount === 0,
      },
      ...allCounts.sort((a, b) => a.label.localeCompare(b.label)),
    ]
  }, [getFilteredModels, models, vendors])

  const tagOptions = useMemo(() => {
    if (!models || models.length === 0) {
      return [
        {
          value: 'all',
          label: 'All Tags',
          count: 0,
          disabled: true,
        },
      ]
    }

    const tags = extractTags(models)

    const items = tags.map((item) => {
      const count = getFilteredModels({ tag: item.key }).length
      return {
        value: item.key,
        label: item.label,
        count,
        disabled: count === 0,
      }
    })

    const totalCount = getFilteredModels({ tag: 'all' }).length

    return [
      {
        value: 'all',
        label: 'All Tags',
        count: totalCount,
        disabled: totalCount === 0,
      },
      ...items,
    ]
  }, [getFilteredModels, models])

  const groupOptions = useMemo(() => {
    if (!usableGroup || Object.keys(usableGroup).length === 0) {
      return [
        {
          value: 'all',
          label: 'All Groups',
          count: 0,
          badge: 'ALL',
          disabled: true,
        },
      ]
    }

    const groupKeys = ['all', ...Object.keys(usableGroup).filter(Boolean)]

    return groupKeys.map((key) => {
      const count = getFilteredModels({ group: key }).length
      return {
        value: key,
        label: key === 'all' ? 'All Groups' : key,
        count,
        badge: formatGroupBadge(key, groupRatio),
        disabled: count === 0,
      }
    })
  }, [getFilteredModels, groupRatio, usableGroup])

  const endpointOptions = useMemo(() => {
    if (!models || models.length === 0) {
      return [
        {
          value: 'all',
          label: 'All Endpoints',
          count: 0,
          disabled: true,
        },
      ]
    }

    const allEndpoints = new Set<string>()
    models.forEach((model) => {
      const types = Array.isArray(model.supported_endpoint_types)
        ? model.supported_endpoint_types
        : []
      types.forEach((type) => {
        allEndpoints.add(type)
      })
    })

    const entries = Array.from(allEndpoints).sort((a, b) => a.localeCompare(b))

    const totalCount = getFilteredModels({ endpoint: 'all' }).length

    return [
      {
        value: 'all',
        label: 'All Endpoints',
        count: totalCount,
        disabled: totalCount === 0,
      },
      ...entries.map((key) => {
        const count = getFilteredModels({ endpoint: key }).length
        const raw: any = (endpointMap as any)[key]
        const label: string =
          typeof raw === 'string'
            ? raw
            : raw && typeof raw === 'object'
              ? [raw.method, raw.path].filter(Boolean).join(' ') || key
              : String(raw ?? key)
        return {
          value: key,
          label,
          count,
          disabled: count === 0,
        }
      }),
    ]
  }, [endpointMap, getFilteredModels, models])

  const quotaOptions = useMemo(() => {
    const totalCount = getFilteredModels({ quota: 'all' }).length
    const perTokenCount = getFilteredModels({ quota: '0' }).length
    const perRequestCount = getFilteredModels({ quota: '1' }).length

    return [
      {
        value: 'all',
        label: 'All Types',
        count: totalCount,
        disabled: totalCount === 0,
      },
      {
        value: '0',
        label: 'Pay Per Token',
        count: perTokenCount,
        disabled: perTokenCount === 0,
      },
      {
        value: '1',
        label: 'Pay Per Request',
        count: perRequestCount,
        disabled: perRequestCount === 0,
      },
    ]
  }, [getFilteredModels])

  const accordionItems = [
    {
      key: 'display',
      title: 'Display Settings',
      content: (
        <PricingControls
          currency={currency}
          onCurrencyChange={onCurrencyChange}
          tokenUnit={tokenUnit}
          onTokenUnitChange={onTokenUnitChange}
          showWithRecharge={showWithRecharge}
          onShowWithRechargeChange={onShowWithRechargeChange}
          orientation='vertical'
        />
      ),
    },
    {
      key: 'group',
      title: 'Group',
      content: (
        <FilterOptions
          options={groupOptions}
          activeValue={group}
          onSelect={(value) =>
            onFilterChange('group', value as PricingFilters['group'])
          }
        />
      ),
    },
    {
      key: 'vendor',
      title: 'Vendor',
      content: (
        <FilterOptions
          options={vendorOptions}
          activeValue={vendor}
          onSelect={(value) =>
            onFilterChange('vendor', value as PricingFilters['vendor'])
          }
        />
      ),
    },
    {
      key: 'tag',
      title: 'Tag',
      content: (
        <FilterOptions
          options={tagOptions}
          activeValue={tag}
          onSelect={(value) =>
            onFilterChange('tag', value as PricingFilters['tag'])
          }
        />
      ),
    },
    {
      key: 'quota',
      title: 'Quota Type',
      content: (
        <FilterOptions
          options={quotaOptions}
          activeValue={quota}
          onSelect={(value) =>
            onFilterChange('quota', value as PricingFilters['quota'])
          }
        />
      ),
    },
    {
      key: 'endpoint',
      title: 'Endpoint Type',
      content: (
        <FilterOptions
          options={endpointOptions}
          activeValue={endpoint}
          onSelect={(value) =>
            onFilterChange('endpoint', value as PricingFilters['endpoint'])
          }
        />
      ),
    },
  ]

  const defaultOpen = ['display', 'group']

  return (
    <aside className='space-y-4'>
      <div className='flex items-center justify-between'>
        <h2 className='text-lg font-semibold'>Filters</h2>
        <Button variant='ghost' size='sm' onClick={onReset}>
          Reset
        </Button>
      </div>

      <Accordion type='multiple' defaultValue={defaultOpen}>
        {accordionItems.map((item) => (
          <AccordionItem key={item.key} value={item.key}>
            <AccordionTrigger>
              <span className='flex items-center gap-2'>
                {item.title}
                {isLoading && <Badge variant='outline'>Loading</Badge>}
              </span>
            </AccordionTrigger>
            <AccordionContent>{item.content}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </aside>
  )
}
