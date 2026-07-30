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
import {
  ArrowUpDown,
  Check,
  Filter,
  Grid2X2,
  Table2,
  X,
} from 'lucide-react'
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  sideDrawerContentClassName,
  sideDrawerFormClassName,
  sideDrawerHeaderClassName,
} from '@/components/drawer-layout'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

import {
  VIEW_MODES,
  getSortLabels,
  type SortOption,
  type ViewMode,
} from '../constants'
import type {
  IntegrationProfile,
  PricingModel,
  PricingVendor,
  TokenUnit,
} from '../types'
import { PricingSidebar } from './pricing-sidebar'
import { SearchBar } from './search-bar'
import { VendorPills } from './vendor-pills'

type SegmentOption = {
  value: string
  label?: string
  icon?: React.ComponentType<{ className?: string }>
  tooltip?: string
}

export interface PricingToolbarProps {
  filteredCount: number
  totalCount?: number
  searchValue: string
  onSearchChange: (value: string) => void
  onSearchClear: () => void
  sortBy: string
  onSortChange: (value: string) => void
  tokenUnit: TokenUnit
  onTokenUnitChange: (value: TokenUnit) => void
  showRechargePrice: boolean
  onRechargePriceChange: (value: boolean) => void
  viewMode: ViewMode
  onViewModeChange: (value: ViewMode) => void
  quotaTypeFilter: string
  endpointTypeFilter: string
  vendorFilter: string
  groupFilter: string
  tagFilter: string
  onQuotaTypeChange: (value: string) => void
  onEndpointTypeChange: (value: string) => void
  onVendorChange: (value: string) => void
  onGroupChange: (value: string) => void
  onTagChange: (value: string) => void
  vendors: PricingVendor[]
  groups: string[]
  groupRatios?: Record<string, number>
  tags: string[]
  models: PricingModel[]
  integrationProfiles: IntegrationProfile[]
  hasActiveFilters: boolean
  activeFilterCount: number
  onClearFilters: () => void
}

function SegmentedControl(props: {
  options: SegmentOption[]
  value: string
  onChange: (value: string) => void
  ariaLabel: string
}) {
  return (
    <div
      role='group'
      aria-label={props.ariaLabel}
      className='bg-muted/60 inline-flex h-8 items-center rounded-lg border p-0.5'
    >
      {props.options.map((option) => {
        const Icon = option.icon
        const isActive = option.value === props.value
        const button = (
          <button
            key={option.value}
            type='button'
            onClick={() => props.onChange(option.value)}
            aria-pressed={isActive}
            className={cn(
              'inline-flex h-full items-center justify-center rounded-md text-xs font-medium transition-ui',
              Icon && !option.label ? 'w-7' : 'gap-1.5 px-3',
              isActive
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {Icon && <Icon className='size-3.5' />}
            {option.label}
          </button>
        )

        if (!option.tooltip) {
          return button
        }

        return (
          <Tooltip key={option.value}>
            <TooltipTrigger render={button} />
            <TooltipContent side='bottom' className='text-xs'>
              {option.tooltip}
            </TooltipContent>
          </Tooltip>
        )
      })}
    </div>
  )
}

export function PricingToolbar(props: PricingToolbarProps) {
  const { t } = useTranslation()
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)
  const sortLabels = getSortLabels(t)
  const activeFilters = [
    props.vendorFilter !== 'all' && {
      label: `${t('Vendor')}: ${props.vendorFilter}`,
      clear: () => props.onVendorChange('all'),
    },
    props.groupFilter !== 'all' && {
      label: `${t('Group')}: ${props.groupFilter}`,
      clear: () => props.onGroupChange('all'),
    },
    props.tagFilter !== 'all' && {
      label: `${t('Tag')}: ${props.tagFilter}`,
      clear: () => props.onTagChange('all'),
    },
    props.quotaTypeFilter !== 'all' && {
      label: `${t('Billing type')}: ${props.quotaTypeFilter}`,
      clear: () => props.onQuotaTypeChange('all'),
    },
    props.endpointTypeFilter !== 'all' && {
      label: `${t('Protocol')}: ${props.endpointTypeFilter}`,
      clear: () => props.onEndpointTypeChange('all'),
    },
  ].filter(Boolean) as Array<{ label: string; clear: () => void }>

  const handleViewModeChange = useCallback(
    (value: string) => props.onViewModeChange(value as ViewMode),
    [props]
  )

  const vendorsWithModels = props.vendors.filter((vendor) =>
    props.models.some((model) => model.vendor_name === vendor.name)
  )
  const showResultRow =
    activeFilters.length > 0 || props.searchValue.trim().length > 0

  return (
    <div className='flex flex-col gap-3'>
      <div className='flex flex-col gap-2 sm:flex-row sm:items-center'>
        <SearchBar
          value={props.searchValue}
          onChange={props.onSearchChange}
          onClear={props.onSearchClear}
          placeholder={t('Search service name, tags, source...')}
          size='sm'
          className='min-w-0 flex-1'
        />

        <div className='flex shrink-0 items-center gap-2'>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  type='button'
                  variant='outline'
                  size='sm'
                  aria-label={t('Sort')}
                  title={sortLabels[props.sortBy as SortOption] || t('Sort')}
                  className='w-8 px-0'
                />
              }
            >
              <ArrowUpDown className='size-3.5' />
            </DropdownMenuTrigger>
            <DropdownMenuContent align='end' className='w-44'>
              {Object.entries(sortLabels).map(([value, label]) => (
                <DropdownMenuItem
                  key={value}
                  onClick={() => props.onSortChange(value)}
                  className='gap-2'
                >
                  <Check
                    className={cn(
                      'size-4 shrink-0',
                      props.sortBy === value ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  {label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            type='button'
            variant='outline'
            size='sm'
            onClick={() => setMobileFiltersOpen(true)}
            className='gap-1.5 md:hidden'
          >
            <Filter className='size-4' />
            {t('Filter')}
            {props.activeFilterCount > 0 && (
              <Badge className='ml-0.5 size-5 justify-center p-0 text-[10px]'>
                {props.activeFilterCount}
              </Badge>
            )}
          </Button>

          <Popover>
            <PopoverTrigger
              render={
                <Button
                  type='button'
                  variant='outline'
                  size='sm'
                  className='hidden gap-1.5 md:inline-flex'
                />
              }
            >
              <Filter className='size-4' />
              {t('Filter')}
              {props.activeFilterCount > 0 && (
                <Badge className='size-5 justify-center p-0 text-[10px]'>
                  {props.activeFilterCount}
                </Badge>
              )}
            </PopoverTrigger>
            <PopoverContent
              align='end'
              className='max-h-[70vh] w-[420px] overflow-y-auto p-0'
            >
              <PricingSidebar {...props} className='border-0 shadow-none' />
            </PopoverContent>
          </Popover>

          <SegmentedControl
            options={[
              {
                value: VIEW_MODES.CARD,
                icon: Grid2X2,
                tooltip: t('Card view'),
              },
              {
                value: VIEW_MODES.TABLE,
                icon: Table2,
                tooltip: t('Table view'),
              },
            ]}
            value={props.viewMode}
            onChange={handleViewModeChange}
            ariaLabel={t('View mode')}
          />
        </div>
      </div>

      {vendorsWithModels.length > 0 && (
        <VendorPills
          vendors={vendorsWithModels}
          value={props.vendorFilter}
          onChange={props.onVendorChange}
        />
      )}

      {showResultRow && (
        <div
          className='flex flex-wrap items-center gap-1.5'
          aria-label={t('Active filters')}
        >
          {activeFilters.map((filter) => (
            <button
              key={filter.label}
              type='button'
              onClick={filter.clear}
              className='bg-muted text-muted-foreground hover:text-foreground inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs'
            >
              {filter.label}
              <X className='size-3' />
            </button>
          ))}
          {activeFilters.length > 0 && (
            <Button
              type='button'
              variant='ghost'
              size='sm'
              onClick={props.onClearFilters}
              className='h-7 text-xs'
            >
              {t('Clear all')}
            </Button>
          )}
          <span className='text-muted-foreground ml-auto text-xs'>
            <span className='text-foreground font-semibold tabular-nums'>
              {props.filteredCount.toLocaleString()}
            </span>
            {' / '}
            {(props.totalCount ?? props.filteredCount).toLocaleString()}{' '}
            {props.filteredCount === 1 ? t('model') : t('models')}
          </span>
        </div>
      )}

      <Sheet open={mobileFiltersOpen} onOpenChange={setMobileFiltersOpen}>
        <SheetContent
          side='right'
          className={sideDrawerContentClassName('sm:max-w-md')}
        >
          <SheetHeader className={sideDrawerHeaderClassName()}>
            <SheetTitle>{t('Filter')}</SheetTitle>
            <SheetDescription>
              {t('Filter models by provider, group, type, endpoint, and tags.')}
            </SheetDescription>
          </SheetHeader>
          <div className={sideDrawerFormClassName('gap-0')}>
            <PricingSidebar
              quotaTypeFilter={props.quotaTypeFilter}
              endpointTypeFilter={props.endpointTypeFilter}
              vendorFilter={props.vendorFilter}
              groupFilter={props.groupFilter}
              tagFilter={props.tagFilter}
              onQuotaTypeChange={props.onQuotaTypeChange}
              onEndpointTypeChange={props.onEndpointTypeChange}
              onVendorChange={props.onVendorChange}
              onGroupChange={props.onGroupChange}
              onTagChange={props.onTagChange}
              tokenUnit={props.tokenUnit}
              onTokenUnitChange={props.onTokenUnitChange}
              showRechargePrice={props.showRechargePrice}
              onRechargePriceChange={props.onRechargePriceChange}
              vendors={props.vendors}
              groups={props.groups}
              groupRatios={props.groupRatios}
              tags={props.tags}
              models={props.models}
              integrationProfiles={props.integrationProfiles}
              hasActiveFilters={props.hasActiveFilters}
              onClearFilters={props.onClearFilters}
              className='border-0 bg-transparent p-0 shadow-none'
            />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
