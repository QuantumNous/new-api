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
import { ArrowUpDown, Check, Filter, Grid2X2, Table2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/design-system/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/design-system/tabs'
import {
  sideDrawerContentClassName,
  sideDrawerFormClassName,
  sideDrawerHeaderClassName,
} from '@/components/drawer-layout'
import { StatusBadge } from '@/components/status-badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
import type { PricingModel, PricingVendor, TokenUnit } from '../types'
import { PricingSidebar } from './pricing-sidebar'
import { SearchBar } from './search-bar'

export interface PricingToolbarProps {
  searchInput: string
  onSearchChange: (value: string) => void
  onClearSearch: () => void
  filteredCount: number
  totalCount?: number
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
  hasActiveFilters: boolean
  activeFilterCount: number
  onClearFilters: () => void
}

function PriceModeTabs(props: {
  value: 'standard' | 'recharge'
  onChange: (value: 'standard' | 'recharge') => void
}) {
  const { t } = useTranslation()

  return (
    <Tabs
      value={props.value}
      onValueChange={(value) =>
        props.onChange(value as 'standard' | 'recharge')
      }
    >
      <TabsList aria-label={t('Price display mode')}>
        <TabsTrigger value='standard'>{t('Standard')}</TabsTrigger>
        <TabsTrigger value='recharge'>{t('Recharge')}</TabsTrigger>
      </TabsList>
    </Tabs>
  )
}

function TokenUnitTabs(props: {
  value: TokenUnit
  onChange: (value: TokenUnit) => void
}) {
  const { t } = useTranslation()

  return (
    <Tabs
      value={props.value}
      onValueChange={(value) => props.onChange(value as TokenUnit)}
    >
      <TabsList aria-label={t('Token unit')}>
        <TabsTrigger value='M'>1M</TabsTrigger>
        <TabsTrigger value='K'>1K</TabsTrigger>
      </TabsList>
    </Tabs>
  )
}

function ViewModeTabs(props: {
  value: ViewMode
  onChange: (value: ViewMode) => void
}) {
  const { t } = useTranslation()

  return (
    <Tabs
      value={props.value}
      onValueChange={(value) => props.onChange(value as ViewMode)}
    >
      <TabsList aria-label={t('View mode')}>
        <Tooltip>
          <TooltipTrigger
            render={<TabsTrigger value={VIEW_MODES.TABLE} className='px-2' />}
          >
            <Table2 aria-hidden='true' className='size-3.5' />
            <span className='sr-only'>{t('Table view')}</span>
          </TooltipTrigger>
          <TooltipContent side='bottom'>{t('Table view')}</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger
            render={<TabsTrigger value={VIEW_MODES.CARD} className='px-2' />}
          >
            <Grid2X2 aria-hidden='true' className='size-3.5' />
            <span className='sr-only'>{t('Card view')}</span>
          </TooltipTrigger>
          <TooltipContent side='bottom'>{t('Card view')}</TooltipContent>
        </Tooltip>
      </TabsList>
    </Tabs>
  )
}

export function PricingToolbar(props: PricingToolbarProps) {
  const { t } = useTranslation()
  const [filtersOpen, setFiltersOpen] = useState(false)
  const sortLabels = getSortLabels(t)

  return (
    <div>
      <div className='flex flex-col gap-3 sm:flex-row sm:items-center'>
        <SearchBar
          value={props.searchInput}
          onChange={props.onSearchChange}
          onClear={props.onClearSearch}
          placeholder={t('Search model name, provider, endpoint, or tag...')}
          className='w-full sm:max-w-sm'
        />

        <div className='flex flex-wrap items-center gap-2 sm:ml-auto'>
          <Button
            type='button'
            variant='outline'
            onClick={() => setFiltersOpen(true)}
          >
            <Filter aria-hidden='true' />
            {t('Filter')}
            {props.activeFilterCount > 0 && (
              <StatusBadge variant='neutral' size='sm'>
                {props.activeFilterCount}
              </StatusBadge>
            )}
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button type='button' variant='outline' />}
            >
              <ArrowUpDown aria-hidden='true' />
              <span>{sortLabels[props.sortBy as SortOption] || t('Sort')}</span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align='end' className='w-44'>
              {Object.entries(sortLabels).map(([value, label]) => (
                <DropdownMenuItem
                  key={value}
                  onClick={() => props.onSortChange(value)}
                >
                  <Check
                    aria-hidden='true'
                    className={cn(
                      'size-4',
                      props.sortBy === value ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  {label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <PriceModeTabs
            value={props.showRechargePrice ? 'recharge' : 'standard'}
            onChange={(value) =>
              props.onRechargePriceChange(value === 'recharge')
            }
          />
          <TokenUnitTabs
            value={props.tokenUnit}
            onChange={props.onTokenUnitChange}
          />
          <ViewModeTabs
            value={props.viewMode}
            onChange={props.onViewModeChange}
          />
        </div>
      </div>

      <p className='text-muted-foreground mt-3 text-sm'>
        <span className='text-foreground font-medium tabular-nums'>
          {props.filteredCount.toLocaleString()}
        </span>{' '}
        {props.filteredCount === 1 ? t('model') : t('models')}
        {props.hasActiveFilters && props.totalCount != null && (
          <span>
            {' '}
            {t('of')} {props.totalCount.toLocaleString()}
          </span>
        )}
      </p>

      <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
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
              vendors={props.vendors}
              groups={props.groups}
              groupRatios={props.groupRatios}
              tags={props.tags}
              models={props.models}
              hasActiveFilters={props.hasActiveFilters}
              onClearFilters={props.onClearFilters}
              className='border-0 bg-transparent p-0'
            />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
